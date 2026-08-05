import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import * as storage from './storage.service.js';
import { logger } from '../utils/logger.js';

const PROFILE_FIELDS = ['fullName', 'city', 'state', 'emergencyContact', 'weight'];

export async function updateProfile(userId, input) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  for (const field of PROFILE_FIELDS) {
    if (input[field] !== undefined) user[field] = input[field];
  }
  if (input.location) {
    user.location = { type: 'Point', coordinates: input.location.coordinates };
  }

  await user.save();
  return user.toJSON();
}

/**
 * Guard against attaching another user's uploaded key: presign keys are always
 * <purpose>/<ownerId>/… so a caller may only claim keys under their own prefix.
 */
function assertOwnedKey(key, userId, purposes) {
  const ok = purposes.some((p) => key.startsWith(`${p}/${userId}/`));
  if (!ok) throw ApiError.badRequest('Upload key does not belong to you');
}

/** Set the user's profile image to an already-uploaded R2 key. */
export async function setAvatar(userId, key) {
  assertOwnedKey(key, userId, ['profile_image']);
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  const previousKey = user.avatar?.key;
  user.avatar = { key, url: storage.publicUrl(key), uploadedAt: new Date() };
  await user.save();

  // Best-effort cleanup of the replaced image.
  if (previousKey && previousKey !== key)
    storage.deleteObject(previousKey).catch((err) => logger.error('avatar cleanup failed', err));

  return user.toJSON();
}

const MAX_DOCUMENTS = 10;

/** Attach an uploaded verification / hospital document to the user. */
export async function addDocument(userId, { key, docType, label }) {
  assertOwnedKey(key, userId, ['verification_doc', 'hospital_doc']);
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  if (user.documents.length >= MAX_DOCUMENTS)
    throw ApiError.badRequest(`Document limit reached (${MAX_DOCUMENTS})`);

  user.documents.push({ key, docType, label, status: 'pending', uploadedAt: new Date() });
  // Uploading a document moves an unverified account into the review queue.
  if (user.verification.status === 'unverified') user.verification.status = 'pending';
  await user.save();
  return user.toJSON();
}

/**
 * Short-lived presigned download URL for one of the user's own documents.
 * Documents are private, so we never expose their keys — only time-boxed URLs.
 */
export async function getDocumentUrl(userId, documentId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  const doc = user.documents.id(documentId);
  if (!doc) throw ApiError.notFound('Document not found');

  const url = await storage.createDownloadUrl(doc.key);
  if (!url) throw new ApiError(503, 'File storage is not configured on this server');
  return { url, expiresInSec: undefined };
}

/** Register an FCM device token for push notifications (deduped, capped). */
const MAX_FCM_TOKENS = 5;

export async function addFcmToken(userId, token) {
  const user = await User.findById(userId).select('+fcmTokens');
  if (!user) throw ApiError.notFound('User not found');

  user.fcmTokens = [...new Set([...user.fcmTokens, token])].slice(-MAX_FCM_TOKENS);
  await user.save();
  return { registered: true };
}

/** Detach a device token (logout on a shared browser). Idempotent. */
export async function removeFcmToken(userId, token) {
  await User.updateOne({ _id: userId }, { $pull: { fcmTokens: token } });
  return { removed: true };
}

/**
 * Update donor availability/status/radius (and optionally location in the
 * same call, so the UI toggle is a single round trip).
 *
 * `isAvailable` and `status` are kept in lockstep — the geo search filters on
 * isAvailable while eligibility also reads status, so letting them diverge
 * (available=true, status=offline) would make donors silently invisible.
 */
export async function updateDonorProfile(userId, input) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  if (user.role !== 'donor')
    throw ApiError.forbidden('Only donor accounts have a donor profile');

  if (input.location) {
    user.location = { type: 'Point', coordinates: input.location.coordinates };
  }
  if (input.preferredRadiusKm !== undefined) {
    user.donorProfile.preferredRadiusKm = input.preferredRadiusKm;
  }

  if (input.status !== undefined) {
    user.donorProfile.status = input.status;
    user.donorProfile.isAvailable = input.status === 'available';
  } else if (input.isAvailable !== undefined) {
    user.donorProfile.isAvailable = input.isAvailable;
    user.donorProfile.status = input.isAvailable ? 'available' : 'offline';
  }

  // An available donor with no coordinates can never appear in geo search —
  // fail loudly instead of letting them believe they are discoverable.
  if (user.donorProfile.isAvailable && !user.location?.coordinates?.length) {
    throw ApiError.badRequest(
      'A location is required to become available. Include location in this request or update your profile first.'
    );
  }

  await user.save();
  return user.toJSON();
}
