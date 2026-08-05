import { User } from '../models/user.model.js';
import { env } from '../config/env.js';
import * as audit from './audit.service.js';
import { logger } from '../utils/logger.js';

/**
 * First-admin bootstrap.
 *
 * `admin` is not self-registerable and assigning it requires an existing admin,
 * so a fresh deployment has no way to create one — which blocks the entire
 * organisation-verification path, since hospitals and blood banks can only be
 * onboarded by an admin. This closes that loop.
 *
 * Deliberately PROMOTE-ONLY: it elevates an account that already registered
 * through the normal flow, and never creates one from configuration. Creating
 * an account here would mean an admin password living in the deployment
 * environment (and, sooner or later, in a log or a screenshot), plus a user
 * document carrying invented medical fields to satisfy the donor schema.
 * Promotion sidesteps both — the account already has a bcrypt-hashed password
 * the operator chose and an email they verified.
 *
 * Idempotent: safe to run on every boot. It never demotes, so removing the
 * variable later cannot lock you out of your own console.
 */

/** Split, trim and normalise the configured admin list. Pure — unit tested. */
export function normalizeAdminEmails(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(',');
  return [
    ...new Set(
      list
        .map((e) => String(e).trim().toLowerCase())
        // Cheap sanity filter; a malformed entry should be reported, not queried.
        .filter((e) => e.length > 0 && e.includes('@'))
    ),
  ];
}

/**
 * @param {string|string[]} [emails] defaults to the ADMIN_EMAILS env var
 * @returns {Promise<{promoted:string[], alreadyAdmin:string[], missing:string[], refused:string[]}>}
 */
export async function ensureAdmins(emails = env.adminEmails) {
  const wanted = normalizeAdminEmails(emails);
  const result = { promoted: [], alreadyAdmin: [], missing: [], refused: [] };
  if (wanted.length === 0) return result;

  for (const email of wanted) {
    const user = await User.findOne({ email }).select('email role isSuspended');

    if (!user) {
      result.missing.push(email);
      continue;
    }
    if (user.role === 'admin') {
      result.alreadyAdmin.push(email);
      continue;
    }
    // Never hand the admin console to a suspended account — that would turn
    // the bootstrap into a way to undo a moderation decision.
    if (user.isSuspended) {
      result.refused.push(email);
      continue;
    }

    const previousRole = user.role;
    user.role = 'admin';
    await user.save();
    result.promoted.push(email);

    audit.record({
      action: 'admin.bootstrap_promote',
      targetType: 'user',
      targetId: String(user._id),
      meta: { email, previousRole, source: 'ADMIN_EMAILS' },
    });
    logger.warn(`[bootstrap] promoted ${email} from ${previousRole} to admin`);
  }

  if (result.alreadyAdmin.length)
    logger.info(`[bootstrap] already admin: ${result.alreadyAdmin.join(', ')}`);
  if (result.refused.length)
    logger.error(
      `[bootstrap] refused (suspended account): ${result.refused.join(', ')}`
    );
  if (result.missing.length)
    logger.warn(
      `[bootstrap] no account yet for: ${result.missing.join(', ')} — ` +
        `register that address through the app first, then restart. ` +
        `Promotion never creates accounts.`
    );

  return result;
}
