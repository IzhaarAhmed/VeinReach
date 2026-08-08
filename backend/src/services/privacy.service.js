import crypto from 'crypto';
import { User } from '../models/user.model.js';
import { Donation } from '../models/donation.model.js';
import { BloodRequest } from '../models/request.model.js';
import { Conversation } from '../models/conversation.model.js';
import { Message } from '../models/message.model.js';
import { Notification } from '../models/notification.model.js';
import { Meetup } from '../models/meetup.model.js';
import { Report } from '../models/report.model.js';
import { ANONYMIZED, PRIVACY_POLICY_VERSION } from '../constants/index.js';
import { ApiError } from '../utils/ApiError.js';
import * as storage from './storage.service.js';
import { logger } from '../utils/logger.js';

const idOf = (v) => String(v?._id ?? v);

/* ── Right of access — DPDP §11, GDPR Art. 15 ──────────────────────────────
   One JSON document containing everything the platform holds about the caller.
   Internal R2 object keys are deliberately omitted: they are internal
   identifiers, and a key is a capability (anyone holding it can be presigned a
   download), so an export file is the wrong place to put one. File name, type
   and size are included instead, which is what makes the export legible. */

/**
 * Describe a stored file without leaking the key that grants access to it.
 * Exported so a test can pin that guarantee — the omission is the point.
 */
export const describeAsset = (a) =>
  a && {
    name: a.name ?? a.label ?? null,
    docType: a.docType ?? null,
    contentType: a.contentType ?? null,
    sizeBytes: a.sizeBytes ?? null,
    status: a.status ?? null,
    uploadedAt: a.uploadedAt ?? null,
  };

export async function exportAccount(userId) {
  const user = await User.findById(userId);
  if (!user || user.deletedAt) throw ApiError.notFound('User not found');

  // Conversations first: their ids scope the message query below.
  const conversations = await Conversation.find({ participants: userId })
    .populate('participants', 'fullName')
    .lean();
  const conversationIds = conversations.map((c) => c._id);

  const [asDonor, asRecipient, requests, messages, notifications, reportsFiled, meetups] =
    await Promise.all([
      Donation.find({ donor: userId }).lean(),
      Donation.find({ recipient: userId }).lean(),
      BloodRequest.find({ createdBy: userId }).lean(),
      Message.find({ conversation: { $in: conversationIds } }).sort({ createdAt: 1 }).lean(),
      Notification.find({ user: userId }).sort({ createdAt: -1 }).lean(),
      Report.find({ reporter: userId }).lean(),
      Meetup.find({ $or: [{ donor: userId }, { recipient: userId }] }).lean(),
    ]);

  const donation = (d) => ({
    bloodGroup: d.bloodGroup,
    units: d.units,
    hospitalName: d.hospitalName,
    hospitalAddress: d.hospitalAddress,
    status: d.status,
    verifiedAt: d.verifiedAt,
    createdAt: d.createdAt,
    donorFeedback: d.donorFeedback,
    recipientFeedback: d.recipientFeedback,
    certificateIssuedAt: d.certificate?.issuedAt ?? null,
  });

  return {
    exportedAt: new Date().toISOString(),
    format: 'veinreach.account-export.v1',
    notes: [
      'Chat threads include both sides of the conversation, because a thread is ' +
        'only meaningful in full — and you could already read all of it in the app.',
      'Stored files are described but not embedded. Download them from the app ' +
        'while your account is open; they are deleted when you close it.',
      'Exact coordinates are included here because they are your own data. The ' +
        'platform never shows them to another user.',
    ],

    profile: {
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      bloodGroup: user.bloodGroup,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      weight: user.weight,
      city: user.city,
      state: user.state,
      emergencyContact: user.emergencyContact,
      coordinates: user.location?.coordinates ?? null,
      verification: {
        status: user.verification?.status,
        emailVerified: user.verification?.emailVerified,
        mobileVerified: user.verification?.mobileVerified,
      },
      consent: user.consent ?? null,
      isSuspended: user.isSuspended,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },

    donorProfile: user.donorProfile ?? null,

    files: {
      avatar: describeAsset(user.avatar),
      documents: (user.documents ?? []).map(describeAsset),
    },

    donations: { given: asDonor.map(donation), received: asRecipient.map(donation) },

    bloodRequests: requests.map((r) => ({
      bloodGroup: r.bloodGroup,
      unitsRequired: r.unitsRequired,
      hospitalName: r.hospitalName,
      hospitalAddress: r.hospitalAddress,
      urgency: r.urgency,
      notes: r.notes,
      status: r.status,
      acceptedDonorCount: r.acceptedDonors?.length ?? 0,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
    })),

    conversations: conversations.map((c) => ({
      id: idOf(c._id),
      with: c.participants
        .filter((p) => idOf(p) !== String(userId))
        .map((p) => p.fullName ?? 'Deleted user'),
      status: c.status,
      contactUnlocked: c.contactUnlocked,
      startedAt: c.createdAt,
      messages: messages
        .filter((m) => idOf(m.conversation) === idOf(c._id))
        .map((m) => ({
          sentByYou: idOf(m.sender) === String(userId),
          text: m.text ?? null,
          attachment: describeAsset(m.attachment),
          status: m.status,
          sentAt: m.createdAt,
          readAt: m.readAt,
        })),
    })),

    meetups: meetups.map((m) => ({
      role: idOf(m.donor) === String(userId) ? 'donor' : 'recipient',
      bloodGroup: m.bloodGroup,
      hospital: { name: m.hospital?.name, address: m.hospital?.address },
      status: m.status,
      createdAt: m.createdAt,
      respondedAt: m.respondedAt,
    })),

    notifications: notifications.map((n) => ({
      type: n.type,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt,
      readAt: n.readAt,
    })),

    reportsYouFiled: reportsFiled.map((r) => ({
      targetType: r.targetType,
      category: r.category,
      description: r.description,
      status: r.status,
      createdAt: r.createdAt,
    })),
  };
}

/* ── Right to erasure — DPDP §12, GDPR Art. 17 ─────────────────────────────
   The account becomes an anonymized tombstone rather than a deleted row.

   Donations reference the donor, the recipient AND the hospital that verified
   them, so removing the user document would silently rewrite two other parties'
   records: a recipient would lose the record of who donated to them, and a
   hospital would lose a donation it attested to. Overwriting every personal
   field achieves erasure — no personal data survives — while leaving the ledger
   answerable. What remains on a tombstone (blood group, donation count) is not
   linkable to a person. */

/**
 * Every personal field on the user document, overwritten in place.
 *
 * Exported for tests: "no personal data survives" is the whole claim this
 * feature makes, and it is only credible if something checks it. A test that
 * greps the serialized tombstone for the original values will fail the moment a
 * new personal field is added to the schema and forgotten here.
 */
export function anonymizeUserDoc(user) {
  user.fullName = ANONYMIZED.fullName;
  user.email = ANONYMIZED.emailFor(user._id);
  user.mobile = ANONYMIZED.mobile;
  user.gender = ANONYMIZED.gender;
  user.dateOfBirth = ANONYMIZED.dateOfBirth;
  user.weight = ANONYMIZED.weight;

  user.city = undefined;
  user.state = undefined;
  user.emergencyContact = undefined;
  // The single most sensitive field: an exact home location.
  user.location = undefined;
  user.avatar = undefined;
  user.documents = [];

  // A tombstone must not be reachable: no password that can be guessed, no live
  // session, no device still receiving push.
  user.refreshTokens = [];
  user.fcmTokens = [];

  user.verification = { status: 'unverified', emailVerified: false, mobileVerified: false };
  user.passwordReset = {};

  // Keep aggregate counters — they carry no identity and the ledger already
  // implies them — but make sure the account can never surface in donor search.
  if (user.donorProfile) {
    user.donorProfile.isAvailable = false;
    user.donorProfile.status = 'offline';
    user.donorProfile.badges = [];
  }

  user.deletedAt = new Date();
}

/**
 * Close the caller's account irreversibly.
 *
 * Requires the current password: this cannot be undone, and a stolen access
 * token should not be enough to erase someone's donation history.
 */
export async function deleteAccount(userId, { password }) {
  const user = await User.findById(userId).select('+passwordHash +refreshTokens +fcmTokens');
  if (!user || user.deletedAt) throw ApiError.notFound('User not found');

  if (!(await user.verifyPassword(password)))
    throw ApiError.unauthorized('Password is incorrect');

  // Erasure must not be able to leave the platform unmoderated. This blocks
  // only the *last* admin, so the right itself is never denied — appoint a
  // second admin and the deletion goes through.
  if (user.role === 'admin') {
    const others = await User.countDocuments({
      role: 'admin',
      deletedAt: null,
      _id: { $ne: user._id },
    });
    if (others === 0)
      throw new ApiError(
        409,
        'You are the only admin. Promote another admin before closing this account.',
        { code: 'LAST_ADMIN' }
      );
  }

  const uid = user._id;

  /* Collect the object-storage keys to purge before the documents that
     reference them are gone. Certificates are keyed by donor and print the
     donor's name, so only the ones where this user donated are theirs to
     delete — a certificate from a donation they *received* belongs to someone
     else. Clearing the sub-document is safe: getCertificateUrl regenerates on
     demand, and the reissued copy names "Deleted user". */
  const keys = [];
  if (user.avatar?.key) keys.push(user.avatar.key);
  for (const doc of user.documents ?? []) if (doc.key) keys.push(doc.key);

  const conversations = await Conversation.find({ participants: uid }).select('_id').lean();
  const conversationIds = conversations.map((c) => c._id);

  const withAttachments = await Message.find({
    conversation: { $in: conversationIds },
    'attachment.key': { $exists: true },
  })
    .select('attachment.key')
    .lean();
  for (const m of withAttachments) if (m.attachment?.key) keys.push(m.attachment.key);

  const donatedByUser = await Donation.find({ donor: uid }).select('certificate.key').lean();
  for (const d of donatedByUser) if (d.certificate?.key) keys.push(d.certificate.key);

  /* Requests that produced a donation are part of the ledger and stay (pointing
     at the tombstone). Ones that never did are the user's own unfulfilled
     asks — free-text notes and a hospital location — and go. */
  const requestIds = (await BloodRequest.find({ createdBy: uid }).select('_id').lean()).map(
    (r) => r._id
  );
  const requestsWithDonations = new Set(
    (await Donation.find({ request: { $in: requestIds } }).select('request').lean()).map((d) =>
      idOf(d.request)
    )
  );
  const purgeableRequestIds = requestIds.filter((id) => !requestsWithDonations.has(idOf(id)));

  /* Deleting a 1:1 conversation removes it for the other participant too. That
     is deliberate and disclosed in the policy: a thread with a tombstone is
     unusable, and the messages themselves routinely contain exactly what the
     user asked to erase — their phone number, their address, their name. */
  const [messagesDeleted, conversationsDeleted, notificationsDeleted, requestsDeleted, meetupsDeleted] =
    await Promise.all([
      Message.deleteMany({ conversation: { $in: conversationIds } }),
      Conversation.deleteMany({ _id: { $in: conversationIds } }),
      Notification.deleteMany({ user: uid }),
      BloodRequest.deleteMany({ _id: { $in: purgeableRequestIds } }),
      Meetup.deleteMany({ $or: [{ donor: uid }, { recipient: uid }] }),
    ]);

  /* Free-text the user wrote about other people, and vice versa. Ratings are
     numeric and stay, so two-way reputation keeps its basis. */
  await Promise.all([
    Donation.updateMany({ donor: uid }, { $unset: { 'donorFeedback.comment': '', certificate: '' } }),
    Donation.updateMany({ recipient: uid }, { $unset: { 'recipientFeedback.comment': '' } }),
  ]);

  // Reports are moderation records and outlive the account, but the reporter's
  // own narrative is their personal data, so it goes.
  await Report.updateMany({ reporter: uid }, { $unset: { description: '' } });

  anonymizeUserDoc(user);
  // A random unusable password, so no credential can ever match the tombstone.
  await user.setPassword(crypto.randomBytes(32).toString('hex'));
  await user.save();

  // Best effort, and last: a storage hiccup must not leave the account half
  // erased in the database, which is the copy that actually matters.
  Promise.all(keys.map((k) => storage.deleteObject(k))).catch((err) =>
    logger.error('account deletion: object storage cleanup failed', err)
  );

  const summary = {
    messagesDeleted: messagesDeleted.deletedCount,
    conversationsDeleted: conversationsDeleted.deletedCount,
    notificationsDeleted: notificationsDeleted.deletedCount,
    requestsDeleted: requestsDeleted.deletedCount,
    meetupsDeleted: meetupsDeleted.deletedCount,
    filesQueuedForDeletion: keys.length,
    donationsAnonymized: donatedByUser.length,
  };
  logger.info(`account ${uid} closed and anonymized: ${JSON.stringify(summary)}`);
  return summary;
}

/** Whether this account has accepted the current policy text. */
export function hasCurrentConsent(user) {
  return user?.consent?.privacyVersion === PRIVACY_POLICY_VERSION;
}
