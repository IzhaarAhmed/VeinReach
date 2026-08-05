import { Notification } from '../models/notification.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { sendMail } from '../config/mailer.js';
import { sendPush } from '../config/fcm.js';
import { getIO } from '../realtime/io.js';
import { logger } from '../utils/logger.js';

/**
 * Notification Engine (spec) — single fan-out point for all channels:
 *   inapp  — persist + 'notification:new' on the user's socket room
 *   email  — Nodemailer (logged when SMTP is unconfigured)
 *   push   — FCM (no-op until a service account is configured)
 *
 * Channel failures are logged, never thrown: a dead SMTP server must not
 * break request creation.
 */
export async function notifyUser(
  userId,
  { type, title, body = '', data = {}, channels = ['inapp'] }
) {
  const user = await User.findById(userId).select('+fcmTokens email fullName');
  if (!user) return null;

  const results = await Promise.allSettled([
    channels.includes('inapp') && inAppChannel(userId, { type, title, body, data }),
    channels.includes('email') && emailChannel(user, { title, body }),
    channels.includes('push') && sendPush(user.fcmTokens, { title, body, data }),
  ]);

  for (const r of results) {
    if (r.status === 'rejected')
      logger.error(`notification channel failed (user=${userId}, type=${type})`, r.reason);
  }
  return results;
}

async function inAppChannel(userId, { type, title, body, data }) {
  const doc = await Notification.create({ user: userId, type, title, body, data });
  getIO()?.to(`user:${userId}`).emit('notification:new', doc.toJSON());
  return doc;
}

function emailChannel(user, { title, body }) {
  return sendMail({
    to: user.email,
    subject: title,
    text: `Hi ${user.fullName},\n\n${body}\n\n— VeinReach`,
    html: `<p>Hi ${user.fullName},</p><p>${body}</p><p>— <strong>VeinReach</strong></p>`,
  });
}

/* ── Inbox queries (used by the notification bell) ─────────────────────── */

export async function listForUser(userId, { limit = 20 } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(capped),
    Notification.countDocuments({ user: userId, readAt: null }),
  ]);
  return { notifications, unreadCount };
}

export async function markRead(userId, notificationId) {
  const doc = await Notification.findOneAndUpdate(
    { _id: notificationId, user: userId, readAt: null },
    { readAt: new Date() },
    { new: true }
  );
  if (!doc) throw ApiError.notFound('Notification not found or already read');
  return doc;
}

export async function markAllRead(userId) {
  const res = await Notification.updateMany(
    { user: userId, readAt: null },
    { readAt: new Date() }
  );
  return { updated: res.modifiedCount };
}
