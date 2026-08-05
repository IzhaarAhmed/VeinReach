import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { User } from '../models/user.model.js';

/** Require a valid access token. Populates req.user = { id, role }. */
export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized('Missing access token'));

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(ApiError.unauthorized('Invalid or expired token'));
  }
}

/** Restrict a route to specific roles. Use after requireAuth. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role))
      return next(ApiError.forbidden('Insufficient role'));
    next();
  };
}

/**
 * Require a verified, non-suspended account for safety-relevant actions
 * (creating requests, accepting donations). Reads the DB — the JWT can't carry
 * a fresh emailVerified flag, and blocking on stale data would be worse.
 *
 * The suspension check matters: suspending a user clears their refresh tokens,
 * but their current access token stays valid until it expires (up to 15 min).
 * Re-checking here costs nothing extra — it rides along on a query this
 * middleware was already making — and closes that window on exactly the
 * actions where an abusive account could still do damage.
 */
export async function requireVerifiedEmail(req, _res, next) {
  try {
    if (!req.user) return next(ApiError.unauthorized());
    const user = await User.findById(req.user.id).select(
      'verification.emailVerified isSuspended'
    );
    if (!user) return next(ApiError.unauthorized('User no longer exists'));
    if (user.isSuspended) return next(ApiError.forbidden('Account suspended'));
    if (!user.verification?.emailVerified)
      return next(
        new ApiError(403, 'Please verify your email address first', {
          code: 'EMAIL_NOT_VERIFIED',
        })
      );
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Require an admin-approved organization for privileged org actions (a blood
 * bank publishing stock, a hospital's portal). The spec requires document
 * verification for hospital/blood-bank accounts before they act as one.
 */
export async function requireVerifiedOrg(req, _res, next) {
  try {
    if (!req.user) return next(ApiError.unauthorized());
    const user = await User.findById(req.user.id).select('verification.status');
    if (!user) return next(ApiError.unauthorized('User no longer exists'));
    if (user.verification?.status !== 'verified')
      return next(
        new ApiError(403, 'Your organization must be verified by an admin first', {
          code: 'ORG_NOT_VERIFIED',
        })
      );
    next();
  } catch (err) {
    next(err);
  }
}
