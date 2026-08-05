import { api, unwrap } from './api.js';

/**
 * Two-step direct-to-R2 upload: ask the API for a presigned PUT URL, then send
 * the file straight to storage (keeps large binaries off the API). Returns the
 * stored { key, url, contentType } the caller attaches to a resource.
 *
 * Throws a friendly error when storage isn't configured (presign returns 503).
 */
export async function uploadFile(file, purpose) {
  let presign;
  try {
    presign = await unwrap(
      api.post('/uploads/presign', {
        purpose,
        contentType: file.type,
        sizeBytes: file.size,
      })
    );
  } catch (err) {
    if (/not configured/i.test(err.message))
      throw new Error('File uploads are not available — storage is not configured on the server.');
    throw err;
  }

  const res = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error('Upload to storage failed. Please try again.');

  return {
    key: presign.key,
    url: presign.publicUrl,
    contentType: file.type,
    name: file.name,
    sizeBytes: file.size,
  };
}
