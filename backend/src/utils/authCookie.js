import { env } from '../config/env.js';

/**
 * The refresh-token cookie, in one place.
 *
 * `path` matters more than it looks: a cookie can only be cleared with the same
 * path it was set with, and this one is deliberately scoped to the auth routes.
 * Closing an account happens at `/api/v1/users/me`, so that handler needs these
 * exact options to end the session — hence a shared module rather than a copy.
 */
export const REFRESH_COOKIE = 'vr_refresh';

export const refreshCookieOpts = {
  httpOnly: true,
  secure: env.cookieSecure,
  // SameSite=None requires Secure; over plain HTTP fall back to Lax so the
  // cookie is still accepted (e.g. the local Docker stack on :8080).
  sameSite: env.cookieSecure ? 'none' : 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30d
  path: '/api/v1/auth',
};

export const setRefreshCookie = (res, token) =>
  res.cookie(REFRESH_COOKIE, token, refreshCookieOpts);

export const clearRefreshCookie = (res) =>
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOpts, maxAge: undefined });
