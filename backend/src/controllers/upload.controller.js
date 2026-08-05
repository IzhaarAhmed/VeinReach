import * as storage from '../services/storage.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ok, asyncHandler } from '../utils/response.js';
import { ORG_ROLES } from '../constants/index.js';

/**
 * Issue a presigned URL the client uploads a file directly to R2 with. The
 * hospital/bloodbank document purpose is restricted to those org roles.
 */
export const presign = asyncHandler(async (req, res) => {
  const { purpose, contentType, sizeBytes } = req.body;

  if (purpose === 'hospital_doc' && !ORG_ROLES.includes(req.user.role))
    throw ApiError.forbidden('Only hospital or blood-bank accounts can upload org documents');

  const result = await storage.createUploadUrl({
    purpose,
    ownerId: req.user.id,
    contentType,
    sizeBytes,
  });
  ok(res, result, 'Upload URL issued');
});
