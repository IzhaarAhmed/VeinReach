import * as adminService from '../services/admin.service.js';
import * as reportService from '../services/report.service.js';
import * as analytics from '../services/analytics.service.js';
import * as audit from '../services/audit.service.js';
import { ok, asyncHandler } from '../utils/response.js';

/* ── Users ─────────────────────────────────────────────────────────────── */

export const listUsers = asyncHandler(async (req, res) => {
  const data = await adminService.listUsers(req.query);
  ok(res, data, 'Users');
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await adminService.getUser(req.params.id);
  ok(res, { user }, 'User');
});

export const getUserDocumentUrl = asyncHandler(async (req, res) => {
  const data = await adminService.getUserDocumentUrl(req.params.id, req.params.docId);
  ok(res, data, 'Document URL');
});

export const setUserRole = asyncHandler(async (req, res) => {
  const user = await adminService.setUserRole(req.user.id, req.params.id, req.body.role);
  audit.recordFromReq(req, {
    action: 'admin.role_change',
    targetType: 'user',
    targetId: req.params.id,
    meta: { role: req.body.role },
  });
  ok(res, { user }, 'Role updated');
});

export const setSuspended = asyncHandler(async (req, res) => {
  const user = await adminService.setSuspended(
    req.user.id,
    req.params.id,
    req.body.suspend,
    req.body.reason
  );
  audit.recordFromReq(req, {
    action: req.body.suspend ? 'admin.suspend' : 'admin.unsuspend',
    targetType: 'user',
    targetId: req.params.id,
    meta: { reason: req.body.reason },
  });
  ok(res, { user }, req.body.suspend ? 'User suspended' : 'User reinstated');
});

export const reviewOrganization = asyncHandler(async (req, res) => {
  const user = await adminService.reviewOrganization(req.user.id, req.params.id, req.body);
  audit.recordFromReq(req, {
    action: 'admin.org_review',
    targetType: 'user',
    targetId: req.params.id,
    meta: { decision: req.body.decision },
  });
  ok(res, { user }, 'Organization reviewed');
});

/* ── Reports ───────────────────────────────────────────────────────────── */

export const listReports = asyncHandler(async (req, res) => {
  const data = await reportService.adminList(req.query);
  ok(res, data, 'Reports');
});

export const getReport = asyncHandler(async (req, res) => {
  const report = await reportService.adminGet(req.params.id);
  ok(res, { report }, 'Report');
});

export const resolveReport = asyncHandler(async (req, res) => {
  const report = await reportService.adminResolve(req.user.id, req.params.id, req.body);
  audit.recordFromReq(req, {
    action: 'admin.report_resolve',
    targetType: 'report',
    targetId: req.params.id,
    meta: { status: req.body.status, action: req.body.action },
  });
  ok(res, { report }, 'Report resolved');
});

/* ── Analytics ─────────────────────────────────────────────────────────── */

export const stats = asyncHandler(async (_req, res) => {
  const data = await analytics.platformStats();
  ok(res, data, 'Platform statistics');
});

export const trends = asyncHandler(async (req, res) => {
  const data = await analytics.trends({ days: req.query.days });
  ok(res, data, 'Platform trends');
});

/* ── Audit log ─────────────────────────────────────────────────────────── */

export const listAudit = asyncHandler(async (req, res) => {
  const data = await audit.list(req.query);
  ok(res, data, 'Audit log');
});
