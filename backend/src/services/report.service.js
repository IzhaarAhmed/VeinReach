import { REPORT_STATUS } from '../constants/index.js';
import { Report } from '../models/report.model.js';
import { User } from '../models/user.model.js';
import * as requestRepo from '../repositories/request.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { clampScore, PENALTY_MODERATION } from './reputation.service.js';
import { notifyUser } from './notification.service.js';
import { paginate, pageMeta } from '../utils/pagination.js';
import { logger } from '../utils/logger.js';

const idOf = (v) => String(v?._id ?? v);

/**
 * Raise a report against a user or a request. Guards against self-reports and
 * duplicate open reports from the same reporter on the same target.
 */
export async function createReport(reporterId, input) {
  const { targetType, targetUserId, targetRequestId, category, description } = input;

  const doc = {
    reporter: reporterId,
    targetType,
    category,
    description,
  };

  if (targetType === 'user') {
    if (!targetUserId) throw ApiError.badRequest('targetUserId is required for a user report');
    if (String(targetUserId) === String(reporterId))
      throw ApiError.badRequest('You cannot report yourself');
    const target = await User.findActiveById(targetUserId).select('_id');
    if (!target) throw ApiError.notFound('Reported user not found');
    doc.targetUser = targetUserId;
  } else {
    if (!targetRequestId) throw ApiError.badRequest('targetRequestId is required for a request report');
    const request = await requestRepo.findById(targetRequestId);
    if (!request) throw ApiError.notFound('Reported request not found');
    doc.targetRequest = targetRequestId;
  }

  const dupeFilter = {
    reporter: reporterId,
    status: { $in: ['open', 'reviewing'] },
    ...(targetType === 'user'
      ? { targetUser: targetUserId }
      : { targetRequest: targetRequestId }),
  };
  if (await Report.exists(dupeFilter))
    throw ApiError.conflict('You already have an open report on this target');

  const report = await Report.create(doc);
  return report.toJSON();
}

/** A user's own submitted reports, newest first. */
export async function listMyReports(reporterId) {
  return Report.find({ reporter: reporterId }).sort({ createdAt: -1 }).limit(50);
}

/* ── Admin-facing ──────────────────────────────────────────────────────── */

export async function adminList(query = {}) {
  const { page, limit, skip } = paginate(query);
  const filter = {};
  // Whitelisted: never let a raw query value become a filter value.
  if (REPORT_STATUS.includes(query.status)) filter.status = query.status;

  const [reports, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('reporter', 'fullName role')
      .populate('targetUser', 'fullName role isSuspended')
      .populate('targetRequest', 'bloodGroup hospitalName status'),
    Report.countDocuments(filter),
  ]);
  return { reports, meta: pageMeta({ page, limit, total }) };
}

export async function adminGet(reportId) {
  const report = await Report.findById(reportId)
    .populate('reporter', 'fullName role')
    .populate('targetUser', 'fullName role isSuspended')
    .populate('targetRequest', 'bloodGroup hospitalName status');
  if (!report) throw ApiError.notFound('Report not found');
  return report;
}

/**
 * The user a moderation action applies to: the reported user, or (for a request
 * report) the request's creator.
 */
async function subjectUserOf(report) {
  if (report.targetUser) return User.findById(idOf(report.targetUser));
  if (report.targetRequest) {
    const request = await requestRepo.findById(report.targetRequest);
    return request ? User.findById(idOf(request.createdBy)) : null;
  }
  return null;
}

/**
 * Resolve (or dismiss) a report and apply the chosen moderation action.
 * Actions: warn, suspend, unsuspend, reputation_penalty, or none.
 */
export async function adminResolve(adminId, reportId, { status, action = 'none', resolutionNote }) {
  const report = await Report.findById(reportId);
  if (!report) throw ApiError.notFound('Report not found');
  if (['resolved', 'dismissed'].includes(report.status))
    throw ApiError.conflict('Report already handled');

  if (action !== 'none') {
    const subject = await subjectUserOf(report);
    if (!subject) throw ApiError.badRequest('Cannot apply an action — target user no longer exists');
    await applyModeration(subject, action);
  }

  report.status = status;
  report.action = action;
  report.resolutionNote = resolutionNote;
  report.handledBy = adminId;
  report.handledAt = new Date();
  await report.save();
  return report.toJSON();
}

async function applyModeration(user, action) {
  switch (action) {
    case 'suspend':
      user.isSuspended = true;
      user.refreshTokens = []; // force logout everywhere
      await user.save();
      notify(user, 'Account suspended', 'Your account has been suspended following a review. Contact support to appeal.');
      break;
    case 'unsuspend':
      user.isSuspended = false;
      await user.save();
      notify(user, 'Account reinstated', 'Your account has been reinstated. Welcome back.');
      break;
    case 'reputation_penalty':
      if (user.donorProfile) {
        user.donorProfile.reputationScore = clampScore(
          (user.donorProfile.reputationScore || 0) + PENALTY_MODERATION
        );
        await user.save();
      }
      notify(user, 'Reputation adjusted', 'A moderation review lowered your reputation score.');
      break;
    case 'warn':
      notify(user, '⚠️ Warning from VeinReach', 'A report about your activity was upheld. Repeated violations may lead to suspension.');
      break;
    default:
      break;
  }
}

function notify(user, title, body) {
  notifyUser(user._id, { type: 'system', title, body, channels: ['inapp', 'email'] }).catch((err) =>
    logger.error('moderation notification failed', err)
  );
}
