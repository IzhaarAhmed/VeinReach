import * as userService from '../services/user.service.js';
import * as privacyService from '../services/privacy.service.js';
import * as audit from '../services/audit.service.js';
import { ok, asyncHandler } from '../utils/response.js';
import { clearRefreshCookie } from '../utils/authCookie.js';

export const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  ok(res, { user }, 'Profile updated');
});

export const updateDonorProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateDonorProfile(req.user.id, req.body);
  ok(res, { user }, 'Donor profile updated');
});

export const setAvatar = asyncHandler(async (req, res) => {
  const user = await userService.setAvatar(req.user.id, req.body.key);
  ok(res, { user }, 'Profile image updated');
});

export const addDocument = asyncHandler(async (req, res) => {
  const user = await userService.addDocument(req.user.id, req.body);
  ok(res, { user }, 'Document uploaded for verification');
});

export const getDocumentUrl = asyncHandler(async (req, res) => {
  const data = await userService.getDocumentUrl(req.user.id, req.params.docId);
  ok(res, data, 'Document download URL');
});

export const addFcmToken = asyncHandler(async (req, res) => {
  const data = await userService.addFcmToken(req.user.id, req.body.token);
  ok(res, data, 'Device registered for push notifications');
});

export const removeFcmToken = asyncHandler(async (req, res) => {
  const data = await userService.removeFcmToken(req.user.id, req.body.token);
  ok(res, data, 'Device unregistered');
});

/**
 * Download everything we hold about the caller (DPDP §11, GDPR Art. 15).
 * Sent as an attachment so the browser saves a file rather than rendering a
 * wall of JSON, and marked no-store so it never lands in a shared HTTP cache.
 */
export const exportMyData = asyncHandler(async (req, res) => {
  const data = await privacyService.exportAccount(req.user.id);
  const stamp = new Date().toISOString().slice(0, 10);

  audit.recordFromReq(req, { action: 'privacy.export', targetType: 'user', targetId: req.user.id });

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="veinreach-data-${stamp}.json"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(data, null, 2));
});

/**
 * Close the caller's account (DPDP §12, GDPR Art. 17). Irreversible.
 *
 * Audited only after the deletion succeeds — logging first would record an
 * "account deleted" event for every mistyped password. The entry names the
 * account and nothing else: writing down what was erased would recreate it.
 * The tombstone keeps the same _id, so the actor reference still resolves.
 */
export const deleteMyAccount = asyncHandler(async (req, res) => {
  const summary = await privacyService.deleteAccount(req.user.id, { password: req.body.password });

  audit.recordFromReq(req, {
    action: 'privacy.account_deleted',
    targetType: 'user',
    targetId: req.user.id,
  });

  clearRefreshCookie(res);
  ok(res, summary, 'Your account has been closed and your personal data erased');
});
