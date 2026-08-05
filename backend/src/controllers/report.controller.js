import * as reportService from '../services/report.service.js';
import { ok, created, asyncHandler } from '../utils/response.js';

export const create = asyncHandler(async (req, res) => {
  const report = await reportService.createReport(req.user.id, req.body);
  created(res, { report }, 'Report submitted for review');
});

export const mine = asyncHandler(async (req, res) => {
  const reports = await reportService.listMyReports(req.user.id);
  ok(res, { reports }, 'My reports');
});
