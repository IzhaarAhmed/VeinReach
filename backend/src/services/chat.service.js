import { Conversation, pairKeyFor } from '../models/conversation.model.js';
import { Message } from '../models/message.model.js';
import { User } from '../models/user.model.js';
import * as requestRepo from '../repositories/request.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { getIO, isUserOnline } from '../realtime/io.js';
import { notifyUser } from './notification.service.js';
import { logger } from '../utils/logger.js';

const idOf = (v) => String(v?._id ?? v);

const peerOf = (conversation, userId) =>
  conversation.participants.map(idOf).find((p) => p !== String(userId));

function assertParticipant(conversation, userId) {
  if (!conversation.participants.map(idOf).includes(String(userId)))
    throw ApiError.forbidden('You are not part of this conversation');
}

/**
 * True when both users are parties to the request — its creator or an accepted
 * donor (spec: reveal contact once involved).
 */
function bothPartiesOf(request, a, b) {
  const parties = new Set([
    idOf(request.createdBy),
    ...request.acceptedDonors.map((d) => idOf(d.donor)),
  ]);
  return parties.has(String(a)) && parties.has(String(b));
}

/**
 * Find or create the 1:1 conversation between the caller and a peer. When a
 * requestId is supplied and both are parties to it, the thread is linked to the
 * request and contact info is unlocked immediately (spec: reveal on accept).
 */
export async function getOrCreateConversation(userId, peerId, { requestId } = {}) {
  if (String(userId) === String(peerId))
    throw ApiError.badRequest('You cannot start a conversation with yourself');

  const peer = await User.findActiveById(peerId).select('_id fullName role avatar');
  if (!peer) throw ApiError.notFound('User not found');

  let unlocked = false;
  let linkedRequest = null;
  if (requestId) {
    const request = await requestRepo.findById(requestId);
    if (request && bothPartiesOf(request, userId, peerId)) {
      unlocked = true;
      linkedRequest = request._id;
    }
  }

  const pairKey = pairKeyFor(userId, peerId);
  let conversation = await Conversation.findOne({ pairKey });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [userId, peerId],
      pairKey,
      request: linkedRequest,
      contactUnlocked: unlocked,
    });
  } else if (unlocked && !conversation.contactUnlocked) {
    conversation.contactUnlocked = true;
    if (!conversation.request) conversation.request = linkedRequest;
    await conversation.save();
  }

  return conversation;
}

/** Conversations the user is in, newest activity first, with peer + unread count. */
export async function listConversations(userId) {
  const conversations = await Conversation.find({ participants: userId })
    .sort({ updatedAt: -1 })
    .limit(50)
    .populate('participants', 'fullName role avatar bloodGroup');

  return Promise.all(
    conversations.map(async (c) => {
      const peer = c.participants.find((p) => idOf(p) !== String(userId));
      const unread = await Message.countDocuments({
        conversation: c._id,
        sender: { $ne: userId },
        readAt: null,
      });
      return {
        id: c._id,
        peer: peer && {
          id: peer._id,
          fullName: peer.fullName,
          role: peer.role,
          bloodGroup: peer.bloodGroup,
          avatarUrl: peer.avatar?.url || null,
        },
        request: c.request,
        contactUnlocked: c.contactUnlocked,
        lastMessage: c.lastMessage,
        unread,
        updatedAt: c.updatedAt,
      };
    })
  );
}

/**
 * Page a conversation's messages (newest first). Viewing marks the peer's
 * messages as read and emits a read receipt.
 */
export async function getMessages(userId, conversationId, { limit = 30, before } = {}) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw ApiError.notFound('Conversation not found');
  assertParticipant(conversation, userId);

  const capped = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const filter = { conversation: conversationId };
  if (before) filter.createdAt = { $lt: new Date(before) };

  const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(capped);

  // Opening the thread reads everything the peer sent.
  await markRead(userId, conversationId).catch((err) => logger.error('markRead failed', err));

  return { messages: messages.reverse(), contactUnlocked: conversation.contactUnlocked };
}

/**
 * Send a message. Persists it, updates the conversation snapshot, and pushes it
 * to the peer in real time. If the peer is online the message is marked
 * delivered immediately (delivery status).
 */
export async function sendMessage(userId, conversationId, { text, attachment }) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw ApiError.notFound('Conversation not found');
  assertParticipant(conversation, userId);

  if (attachment?.key && !attachment.key.startsWith(`chat_attachment/${userId}/`))
    throw ApiError.badRequest('Attachment does not belong to you');

  const peerId = peerOf(conversation, userId);
  const delivered = isUserOnline(peerId);

  const message = await Message.create({
    conversation: conversationId,
    sender: userId,
    text: text?.trim() || undefined,
    attachment: attachment?.key ? attachment : undefined,
    status: delivered ? 'delivered' : 'sent',
    deliveredAt: delivered ? new Date() : undefined,
  });

  conversation.lastMessage = {
    text: message.text || (message.attachment ? '📎 Attachment' : ''),
    hasAttachment: Boolean(message.attachment),
    sender: userId,
    at: message.createdAt,
  };
  await conversation.save();

  const io = getIO();
  const payload = { conversationId, message: message.toJSON() };
  io?.to(`user:${peerId}`).emit('chat:message', payload);
  io?.to(`user:${userId}`).emit('chat:message', payload); // echo to sender's other devices

  // Persistent nudge for an offline peer (in-app; push if they have devices).
  if (!delivered) {
    const sender = await User.findById(userId).select('fullName');
    notifyUser(peerId, {
      type: 'chat_message',
      title: `💬 New message from ${sender?.fullName || 'someone'}`,
      body: message.text ? message.text.slice(0, 140) : 'Sent an attachment',
      data: { conversationId },
      channels: ['inapp', 'push'],
    }).catch((err) => logger.error('chat notification failed', err));
  }

  return message.toJSON();
}

/** Mark all of the peer's unread messages as read; emit a receipt to the peer. */
export async function markRead(userId, conversationId) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw ApiError.notFound('Conversation not found');
  assertParticipant(conversation, userId);

  const now = new Date();
  const res = await Message.updateMany(
    { conversation: conversationId, sender: { $ne: userId }, readAt: null },
    // Reading also implies delivered, for anything that skipped that step.
    { $set: { status: 'read', readAt: now }, $min: { deliveredAt: now } }
  );

  if (res.modifiedCount > 0) {
    const peerId = peerOf(conversation, userId);
    getIO()
      ?.to(`user:${peerId}`)
      .emit('chat:receipt', { conversationId, status: 'read', by: String(userId), at: now });
  }
  return { updated: res.modifiedCount };
}

/**
 * Reveal the peer's contact info — allowed only once the gate is unlocked
 * (linked request, or both parties consented). Returns masked guidance otherwise.
 */
export async function getContact(userId, conversationId) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw ApiError.notFound('Conversation not found');
  assertParticipant(conversation, userId);

  if (!conversation.contactUnlocked)
    throw new ApiError(403, 'Contact details are hidden until both parties consent', {
      code: 'CONTACT_LOCKED',
    });

  const peerId = peerOf(conversation, userId);
  const peer = await User.findActiveById(peerId).select('fullName mobile email emergencyContact');
  if (!peer) throw ApiError.notFound('User not found');
  return {
    fullName: peer.fullName,
    mobile: peer.mobile,
    email: peer.email,
    emergencyContact: peer.emergencyContact,
  };
}

/**
 * Record the caller's consent to share contact info. When both participants
 * have consented the gate unlocks for the thread.
 */
export async function consentContact(userId, conversationId) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw ApiError.notFound('Conversation not found');
  assertParticipant(conversation, userId);

  const consents = new Set(conversation.consents.map(String));
  consents.add(String(userId));
  conversation.consents = [...consents];

  const everyoneConsented = conversation.participants.every((p) => consents.has(idOf(p)));
  if (everyoneConsented) conversation.contactUnlocked = true;
  await conversation.save();

  const peerId = peerOf(conversation, userId);
  getIO()
    ?.to(`user:${peerId}`)
    .emit('chat:consent', { conversationId, contactUnlocked: conversation.contactUnlocked });

  return { contactUnlocked: conversation.contactUnlocked, consents: conversation.consents };
}
