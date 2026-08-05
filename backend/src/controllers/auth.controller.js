import * as authService from '../services/auth.service.js';
import * as audit from '../services/audit.service.js';
import { ok, created, asyncHandler } from '../utils/response.js';
import { env } from '../config/env.js';

const REFRESH_COOKIE = 'vr_refresh';
const cookieOpts = {
  httpOnly: true,
  secure: env.cookieSecure,
  // SameSite=None requires Secure; over plain HTTP fall back to Lax so the
  // cookie is still accepted (e.g. the local Docker stack on :8080).
  sameSite: env.cookieSecure ? 'none' : 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30d
  path: '/api/v1/auth',
};

export const register = asyncHandler(async (req, res) => {
  const { refreshToken, ...rest } = await authService.register(req.body);
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts);
  audit.record({ actor: rest.user?.id, actorRole: rest.user?.role, action: 'auth.register', ip: req.ip });
  created(res, rest, 'Registered successfully');
});

export const login = asyncHandler(async (req, res) => {
  const { refreshToken, ...rest } = await authService.login(req.body);
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts);
  audit.record({ actor: rest.user?.id, actorRole: rest.user?.role, action: 'auth.login', ip: req.ip });
  ok(res, rest, 'Logged in');
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  const tokens = await authService.refresh(token);
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOpts);
  ok(res, { accessToken: tokens.accessToken }, 'Token refreshed');
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  await authService.logout(req.user.id, token);
  res.clearCookie(REFRESH_COOKIE, { ...cookieOpts, maxAge: undefined });
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
  res.clearCookie(REFRESH_COOKIE, { ...cookieOpts, maxAge: undefined });
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
