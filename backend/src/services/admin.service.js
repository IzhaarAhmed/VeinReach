import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import * as storage from './storage.service.js';
import { notifyUser } from './notification.service.js';
import { paginate, pageMeta } from '../utils/pagination.js';
import { USER_ROLES, ORG_ROLES, VERIFICATION_STATUS } from '../constants/index.js';
import { logger } from '../utils/logger.js';

/** Paginated, filterable user directory for the admin console. */
export async function listUsers(query = {}) {
  const { page, limit, skip } = paginate(query);
  const filter = {};
  if (query.role && USER_ROLES.includes(query.role)) filter.role = query.role;
  if (query.status === 'suspended') filter.isSuspended = true;
  if (query.status === 'active') filter.isSuspended = false;
  // Whitelisted rather than passed through: mongoSanitize already strips
  // operators, but a filter value should never be attacker-shaped in the first
  // place, and neither layer should be the only thing standing in the way.
  if (VERIFICATION_STATUS.includes(query.verification))
    filter['verification.status'] = query.verification;
  if (query.q) {
    const rx = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ fullName: rx }, { email: rx }];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return { users: users.map((u) => u.toJSON()), meta: pageMeta({ page, limit, total }) };
}

export async function getUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return user.toJSON();
}

/** Presigned URL for reviewing any user's verification document. */
export async function getUserDocumentUrl(userId, documentId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  const doc = user.documents.id(documentId);
  if (!doc) throw ApiError.notFound('Document not found');
  const url = await storage.createDownloadUrl(doc.key);
  if (!url) throw new ApiError(503, 'File storage is not configured on this server');
  return { url };
}

/** Change a user's role. Admins cannot change their own role (lock-out guard). */
export async function setUserRole(adminId, userId, role) {
  if (String(adminId) === String(userId))
    throw ApiError.badRequest('You cannot change your own role');
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  const previous = user.role;
  user.role = role;
  await user.save();
  logger.info(`admin ${adminId} changed user ${userId} role ${previous} → ${role}`);

  notifyUser(userId, {
    type: 'system',
    title: 'Your account role changed',
    body: `An administrator set your account role to "${role}".`,
    channels: ['inapp', 'email'],
  }).catch((err) => logger.error('role-change notification failed', err));

  return user.toJSON();
}

/** Suspend or reinstate a user. Suspension also revokes all sessions. */
export async function setSuspended(adminId, userId, suspend, reason) {
  if (String(adminId) === String(userId))
    throw ApiError.badRequest('You cannot suspend yourself');
  const user = await User.findById(userId).select('+refreshTokens');
  if (!user) throw ApiError.notFound('User not found');

  user.isSuspended = suspend;
  if (suspend) user.refreshTokens = [];
  await user.save();

  notifyUser(userId, {
    type: 'system',
    title: suspend ? 'Account suspended' : 'Account reinstated',
    body: suspend
      ? `Your account has been suspended${reason ? `: ${reason}` : ''}. Contact support to appeal.`
      : 'Your account has been reinstated. Welcome back.',
    channels: ['inapp', 'email'],
  }).catch((err) => logger.error('suspend notification failed', err));

  return user.toJSON();
}

/**
 * Approve or reject an organization (hospital / blood bank) after reviewing its
 * uploaded documents (spec: Admin — verify organizations).
 */
export async function reviewOrganization(adminId, userId, { decision, note }) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  if (!ORG_ROLES.includes(user.role))
    throw ApiError.badRequest('Only hospital or blood-bank accounts require organization verification');

  const verified = decision === 'approve';
  user.verification.status = verified ? 'verified' : 'rejected';
  // Reflect the decision on the submitted documents too.
  user.documents.forEach((d) => {
    d.status = verified ? 'verified' : 'rejected';
  });
  await user.save();

  notifyUser(userId, {
    type: 'system',
    title: verified ? '✅ Organization verified' : 'Organization verification rejected',
    body: verified
      ? 'Your organization has been verified. You now have full portal access.'
      : `Your verification was rejected${note ? `: ${note}` : ''}. Please re-submit valid documents.`,
    channels: ['inapp', 'email'],
  }).catch((err) => logger.error('org-review notification failed', err));

  logger.info(`admin ${adminId} ${decision}d org ${userId}`);
  return user.toJSON();
}
