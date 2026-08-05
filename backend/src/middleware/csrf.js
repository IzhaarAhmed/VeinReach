import crypto from 'crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * CSRF protection via the double-submit pattern.
 *
 * A random token lives in an httpOnly cookie (sent automatically by the
 * browser) AND is echoed to the client in the `X-CSRF-Token` *response* header
 * (exposed via CORS). The SPA keeps that value in memory and returns it in the
 * `X-CSRF-Token` *request* header on every mutating call. A cross-site attacker
 * can neither read the token (httpOnly cookie + CORS-gated header) nor set a
 * custom request header, so forged requests fail the cookie==header check.
 *
 * Read-only methods and the session-bootstrap endpoints (which are protected by
 * credentials / the refresh token, not an ambient cookie) are exempt.
 */
export const CSRF_COOKIE = 'vr_csrf';
export const CSRF_HEADER = 'X-CSRF-Token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const EXEMPT_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
]);

const cookieOpts = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSecure ? 'none' : 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30d
  path: '/',
};

/**
 * Ensure the client has a CSRF token: reuse the cookie if present, otherwise
 * mint one and set it. Always surfaces the current value in the response header
 * so the SPA can (re)learn it — even cross-origin, where it can't read cookies.
 */
export function issueCsrfToken(req, res, next) {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, token, cookieOpts);
  }
  res.setHeader(CSRF_HEADER, token);
  next();
}

function timingSafeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Reject mutating requests whose header token doesn't match the cookie. */
export function verifyCsrf(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (EXEMPT_PATHS.has(req.path)) return next();

  const cookie = req.cookies?.[CSRF_COOKIE];
  const header = req.get(CSRF_HEADER);
  if (!cookie || !header || !timingSafeEqual(cookie, header))
    return next(
      new ApiError(403, 'Invalid or missing CSRF token — reload and try again', {
        code: 'CSRF_FAILED',
      })
    );
  next();
}
