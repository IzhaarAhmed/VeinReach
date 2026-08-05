import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Optional Cloudflare R2 (S3-compatible) object storage. Disabled unless all
 * R2_* vars are set. When disabled every storage call degrades to a no-op /
 * clear error so the rest of the app never has to branch — same pattern as the
 * Redis, mailer, and FCM stubs.
 *
 * R2 holds ONLY binary assets (profile images, verification/hospital documents,
 * chat attachments, donation certificates) — never application data.
 */
let handle = null;

/** True when the credentials needed to talk to R2 are present. */
export function r2Enabled() {
  const { accountId, accessKeyId, secretAccessKey, bucket } = env.r2;
  return Boolean(accountId && accessKeyId && secretAccessKey && bucket);
}

export async function initR2() {
  if (!r2Enabled()) {
    logger.warn('Cloudflare R2 not configured — file uploads disabled (dev fallback in use)');
    return null;
  }

  try {
    // Dynamic import so the AWS SDK is only loaded when R2 is actually used.
    const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } =
      await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.r2.accessKeyId,
        secretAccessKey: env.r2.secretAccessKey,
      },
    });

    handle = {
      s3,
      bucket: env.r2.bucket,
      getSignedUrl,
      PutObjectCommand,
      GetObjectCommand,
      DeleteObjectCommand,
    };
    logger.info('Cloudflare R2 ready');
  } catch (err) {
    logger.error('R2 init failed — uploads disabled (is @aws-sdk/client-s3 installed?)', err);
    handle = null;
  }
  return handle;
}

/** The live R2 handle, or null when storage is disabled. */
export function getR2() {
  return handle;
}
