import * as userService from '../services/user.service.js';
import { ok, asyncHandler } from '../utils/response.js';

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
