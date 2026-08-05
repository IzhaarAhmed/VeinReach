import mongoose from 'mongoose';
import { AuditLog } from '../models/audit.model.js';
import { paginate, pageMeta } from '../utils/pagination.js';
import { logger } from '../utils/logger.js';

/**
 * Record an audit event. Fire-and-forget: a logging failure must never break
 * the action being audited, so this swallows its own errors. Callers don't need
 * to await it.
 */
export function record({ actor = null, actorRole, action, targetType, targetId, ip, meta = {} }) {
  return AuditLog.create({ actor, actorRole, action, targetType, targetId, ip, meta }).catch((err) =>
    logger.error(`audit record failed (${action})`, err)
  );
}

/** Convenience: derive actor fields from an Express req. */
export function recordFromReq(req, { action, targetType, targetId, meta } = {}) {
  return record({
    actor: req.user?.id || null,
    actorRole: req.user?.role,
    action,
    targetType,
    targetId,
    ip: req.ip,
    meta,
  });
}

/** Paginated audit trail for the admin console, newest first. */
export async function list(query = {}) {
  const { page, limit, skip } = paginate(query);
  const filter = {};
  // Coerced to primitives: these are free-form, so they cannot be whitelisted,
  // but forcing a string guarantees they can never arrive as a query operator.
  if (query.action) filter.action = String(query.action);
  if (query.actor && mongoose.isValidObjectId(String(query.actor)))
    filter.actor = String(query.actor);

  const [entries, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('actor', 'fullName email role'),
    AuditLog.countDocuments(filter),
  ]);
  return { entries, meta: pageMeta({ page, limit, total }) };
}
