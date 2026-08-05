import crypto from 'crypto';
import { getR2, r2Enabled } from '../config/r2.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { UPLOAD_PURPOSES } from '../constants/index.js';

const EXT_BY_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'image/svg+xml': 'svg',
};

/** True when object storage is available. */
export const storageEnabled = r2Enabled;

/**
 * Deterministic-ish object key: <purpose>/<owner>/<time>-<rand>.<ext>. The
 * random suffix prevents collisions and makes keys unguessable so a leaked
 * key can't be walked to a neighbour's document.
 */
export function buildKey(purpose, ownerId, contentType) {
  const ext = EXT_BY_TYPE[contentType] || 'bin';
  const rand = crypto.randomBytes(8).toString('hex');
  return `${purpose}/${ownerId}/${Date.now()}-${rand}.${ext}`;
}

/** Public CDN URL for a key, or null when no public base is configured. */
export function publicUrl(key) {
  if (!key) return null;
  const base = (env.r2.publicUrl || '').replace(/\/+$/, '');
  return base ? `${base}/${encodeURI(key)}` : null;
}

function assertPurpose(purpose, contentType) {
  const allowed = UPLOAD_PURPOSES[purpose];
  if (!allowed) throw ApiError.badRequest(`Unknown upload purpose "${purpose}"`);
  if (contentType && !allowed.includes(contentType))
    throw ApiError.badRequest(
      `Unsupported file type "${contentType}" for ${purpose}. Allowed: ${allowed.join(', ')}`
    );
}

/**
 * Issue a presigned PUT URL the browser uploads the file directly to (keeps
 * large binaries off the API). Returns the final key + public URL so the client
 * can attach it once the upload succeeds.
 */
export async function createUploadUrl({ purpose, ownerId, contentType, sizeBytes }) {
  assertPurpose(purpose, contentType);

  const maxBytes = env.uploads.maxMb * 1024 * 1024;
  if (sizeBytes && sizeBytes > maxBytes)
    throw ApiError.badRequest(`File exceeds the ${env.uploads.maxMb} MB limit`);

  if (!r2Enabled())
    throw new ApiError(503, 'File storage is not configured on this server', {
      code: 'STORAGE_DISABLED',
    });

  const r2 = getR2();
  const key = buildKey(purpose, ownerId, contentType);
  const cmd = new r2.PutObjectCommand({
    Bucket: r2.bucket,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await r2.getSignedUrl(r2.s3, cmd, {
    expiresIn: env.uploads.presignTtlSec,
  });

  return {
    uploadUrl,
    key,
    publicUrl: publicUrl(key),
    contentType,
    expiresInSec: env.uploads.presignTtlSec,
  };
}

/**
 * Upload bytes the server generated (e.g. a donation certificate). Returns
 * { key, url } on success, or null when storage is disabled so the caller can
 * fall back (e.g. keep an inline copy in dev).
 */
export async function putObject({ key, body, contentType }) {
  if (!r2Enabled()) return null;
  const r2 = getR2();
  await r2.s3.send(
    new r2.PutObjectCommand({ Bucket: r2.bucket, Key: key, Body: body, ContentType: contentType })
  );
  return { key, url: publicUrl(key) };
}

/**
 * Presigned GET URL for private objects (verification/hospital documents that
 * must not be world-readable). Returns null when storage is disabled.
 */
export async function createDownloadUrl(key, expiresSec = env.uploads.presignTtlSec) {
  if (!key || !r2Enabled()) return null;
  const r2 = getR2();
  const cmd = new r2.GetObjectCommand({ Bucket: r2.bucket, Key: key });
  return r2.getSignedUrl(r2.s3, cmd, { expiresIn: expiresSec });
}

/** Best-effort delete. Never throws — orphan cleanup shouldn't fail a request. */
export async function deleteObject(key) {
  if (!key || !r2Enabled()) return;
  const r2 = getR2();
  await r2.s3
    .send(new r2.DeleteObjectCommand({ Bucket: r2.bucket, Key: key }))
    .catch(() => {});
}
