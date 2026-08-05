import * as chatService from '../services/chat.service.js';
import { ok, created, asyncHandler } from '../utils/response.js';

export const startConversation = asyncHandler(async (req, res) => {
  const conversation = await chatService.getOrCreateConversation(
    req.user.id,
    req.body.peerId,
    { requestId: req.body.requestId }
  );
  created(res, { conversation }, 'Conversation ready');
});

export const listConversations = asyncHandler(async (req, res) => {
  const conversations = await chatService.listConversations(req.user.id);
  ok(res, { conversations }, 'Conversations');
});

export const listMessages = asyncHandler(async (req, res) => {
  const data = await chatService.getMessages(req.user.id, req.params.id, req.query);
  ok(res, data, 'Messages');
});

export const sendMessage = asyncHandler(async (req, res) => {
  const message = await chatService.sendMessage(req.user.id, req.params.id, req.body);
  created(res, { message }, 'Message sent');
});

export const markRead = asyncHandler(async (req, res) => {
  const data = await chatService.markRead(req.user.id, req.params.id);
  ok(res, data, 'Marked read');
});

export const getContact = asyncHandler(async (req, res) => {
  const contact = await chatService.getContact(req.user.id, req.params.id);
  ok(res, { contact }, 'Contact details');
});

export const consentContact = asyncHandler(async (req, res) => {
  const data = await chatService.consentContact(req.user.id, req.params.id);
  ok(res, data, 'Consent recorded');
});
