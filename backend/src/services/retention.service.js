import { Message } from '../models/message.model.js';
import { Conversation } from '../models/conversation.model.js';
import { Notification } from '../models/notification.model.js';
import { AuditLog } from '../models/audit.model.js';
import { BloodRequest } from '../models/request.model.js';
import { Donation } from '../models/donation.model.js';
import { env } from '../config/env.js';
import * as storage from './storage.service.js';
import { logger } from '../utils/logger.js';

/**
 * Scheduled data-retention sweep — the enforcement half of the retention limits
 * the privacy policy promises (DPDP §8(7), GDPR Art. 5(1)(e)).
 *
 * Deliberately a sweep rather than MongoDB TTL indexes, for three reasons:
 *
 *  1. TTL cannot express a condition. Expired and cancelled requests should age
 *     out; fulfilled ones are ledger records and must not.
 *  2. TTL deletes the document and nothing else, so a purged chat message would
 *     leave its attachment orphaned in R2 forever — the file outliving the row
 *     that pointed at it is precisely the leak retention is meant to close.
 *  3. `expireAfterSeconds` is baked into the index, so making the windows
 *     env-configurable would need an index rebuild on every change, and a failed
 *     rebuild would silently keep enforcing the old value.
 *
 * A day count of 0 or less disables that category, which is how an operator
 * opts out of one window without disabling the whole sweep.
 */

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const enabled = (days) => Number.isFinite(days) && days > 0;

/**
 * Chat messages, their R2 attachments, and the denormalized `lastMessage`
 * snapshot on the conversation.
 *
 * That snapshot is easy to miss and would defeat the whole purge: it holds a
 * copy of the newest message's text, so deleting messages without clearing it
 * leaves the most recent thing anyone said sitting in the conversation row.
 */
export async function purgeOldMessages(days = env.retention.messagesDays) {
  if (!enabled(days)) return { messages: 0, attachments: 0, conversations: 0 };
  const cutoff = daysAgo(days);

  // Delete the files first: if the sweep dies midway, an orphaned row is
  // recoverable and an orphaned object in a bucket nobody indexes is not.
  const withAttachments = await Message.find({
    createdAt: { $lt: cutoff },
    'attachment.key': { $exists: true },
  })
    .select('attachment.key')
    .lean();

  let attachments = 0;
  for (const m of withAttachments) {
    if (!m.attachment?.key) continue;
    await storage.deleteObject(m.attachment.key);
    attachments += 1;
  }

  const { deletedCount = 0 } = await Message.deleteMany({ createdAt: { $lt: cutoff } });

  // Clear stale snapshots, then drop threads that are now empty — who spoke to
  // whom is itself personal data, so an emptied shell should not linger.
  await Conversation.updateMany({ 'lastMessage.at': { $lt: cutoff } }, { $unset: { lastMessage: '' } });

  const stale = await Conversation.find({ updatedAt: { $lt: cutoff } }).select('_id').lean();
  const staleIds = stale.map((c) => c._id);
  const stillUsed = new Set(
    (await Message.find({ conversation: { $in: staleIds } }).select('conversation').lean()).map(
      (m) => String(m.conversation)
    )
  );
  const emptyIds = staleIds.filter((id) => !stillUsed.has(String(id)));
  const { deletedCount: conversations = 0 } = await Conversation.deleteMany({
    _id: { $in: emptyIds },
  });

  return { messages: deletedCount, attachments, conversations };
}

export async function purgeOldNotifications(days = env.retention.notificationsDays) {
  if (!enabled(days)) return 0;
  const { deletedCount = 0 } = await Notification.deleteMany({
    createdAt: { $lt: daysAgo(days) },
  });
  return deletedCount;
}

export async function purgeOldAuditLogs(days = env.retention.auditDays) {
  if (!enabled(days)) return 0;
  const { deletedCount = 0 } = await AuditLog.deleteMany({ createdAt: { $lt: daysAgo(days) } });
  return deletedCount;
}

/**
 * Requests that ended without producing a donation. Their free-text notes and
 * hospital coordinates have no reason to persist.
 *
 * Only `expired` and `cancelled` qualify, and even then a request is spared if
 * any donation references it — a cancelled request can still carry a `no_show`
 * or `rejected` record, and deleting it would strand that row.
 */
export async function purgeOldRequests(days = env.retention.requestsDays) {
  if (!enabled(days)) return 0;

  const candidates = await BloodRequest.find({
    status: { $in: ['expired', 'cancelled'] },
    createdAt: { $lt: daysAgo(days) },
  })
    .select('_id')
    .lean();
  if (candidates.length === 0) return 0;

  const ids = candidates.map((r) => r._id);
  const referenced = new Set(
    (await Donation.find({ request: { $in: ids } }).select('request').lean()).map((d) =>
      String(d.request)
    )
  );
  const purgeable = ids.filter((id) => !referenced.has(String(id)));
  if (purgeable.length === 0) return 0;

  const { deletedCount = 0 } = await BloodRequest.deleteMany({ _id: { $in: purgeable } });
  return deletedCount;
}

/** Run every category. Individual failures are logged, never fatal. */
export async function runRetentionSweep() {
  const summary = {
    messages: 0,
    attachments: 0,
    conversations: 0,
    notifications: 0,
    auditLogs: 0,
    requests: 0,
  };

  const steps = [
    ['messages', async () => Object.assign(summary, await purgeOldMessages())],
    ['notifications', async () => (summary.notifications = await purgeOldNotifications())],
    ['audit logs', async () => (summary.auditLogs = await purgeOldAuditLogs())],
    ['requests', async () => (summary.requests = await purgeOldRequests())],
  ];

  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      logger.error(`retention sweep: ${label} failed`, err);
    }
  }

  return summary;
}
