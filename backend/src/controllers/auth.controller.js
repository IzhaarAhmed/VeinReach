import * as authService from '../services/auth.service.js';
import * as audit from '../services/audit.service.js';
import { ok, created, asyncHandler } from '../utils/response.js';
import {
  REFRESH_COOKIE,
  setRefreshCookie,
  clearRefreshCookie,
} from '../utils/authCookie.js';

export const register = asyncHandler(async (req, res) => {
  const { refreshToken, ...rest } = await authService.register(req.body);
  setRefreshCookie(res, refreshToken);
  audit.record({ actor: rest.user?.id, actorRole: rest.user?.role, action: 'auth.register', ip: req.ip });
  created(res, rest, 'Registered successfully');
});

export const login = asyncHandler(async (req, res) => {
  const { refreshToken, ...rest } = await authService.login(req.body);
  setRefreshCookie(res, refreshToken);
  audit.record({ actor: rest.user?.id, actorRole: rest.user?.role, action: 'auth.login', ip: req.ip });
  ok(res, rest, 'Logged in');
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  const tokens = await authService.refresh(token);
  setRefreshCookie(res, tokens.refreshToken);
  ok(res, { accessToken: tokens.accessToken }, 'Token refreshed');
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  await authService.logout(req.user.id, token);
  clearRefreshCookie(res);
  audit.recordFromReq(req, { action: 'auth.logout' });
  ok(res, {}, 'Logged out');
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.id);
  ok(res, { user }, 'Profile');
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { user, alreadyVerified } = await authService.verifyEmail(req.body);
  ok(res, { user, alreadyVerified }, alreadyVerified ? 'Email already verified' : 'Email verified');
});

export const resendVerification = asyncHandler(async (req, res) => {
  await authService.resendVerification(req.user.id);
  ok(res, {}, 'Verification email sent');
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const data = await authService.requestPasswordReset(req.body.email);
  audit.record({ action: 'auth.password_reset_requested', ip: req.ip });
  // Deliberately identical whether or not the address is registered.
  ok(res, data, 'If that email is registered, a reset code is on its way');
});

export const verifyResetOtp = asyncHandler(async (req, res) => {
  const data = await authService.verifyPasswordResetOtp(req.body.email, req.body.code);
  ok(res, data, 'Code verified');
});

export const resetPassword = asyncHandler(async (req, res) => {
  const data = await authService.resetPassword(req.body);
  // Any refresh cookie in this browser points at a now-revoked session.
  clearRefreshCookie(res);
  audit.record({ action: 'auth.password_reset_completed', ip: req.ip });
  ok(res, data, 'Password updated — you can log in with your new password');
});

export const sendMobileOtp = asyncHandler(async (req, res) => {
  const data = await authService.sendMobileOtp(req.user.id);
  ok(res, data, 'Verification code sent');
});

export const verifyMobileOtp = asyncHandler(async (req, res) => {
  const data = await authService.verifyMobileOtp(req.user.id, req.body.code);
  if (!data.alreadyVerified) audit.recordFromReq(req, { action: 'auth.mobile_verified' });
  ok(res, data, data.alreadyVerified ? 'Mobile already verified' : 'Mobile number verified');
});
