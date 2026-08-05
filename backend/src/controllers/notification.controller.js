import * as notificationService from '../services/notification.service.js';
import { ok, asyncHandler } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  const data = await notificationService.listForUser(req.user.id, {
    limit: req.query.limit,
  });
  ok(res, data, 'Notifications');
});

export const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markRead(req.user.id, req.params.id);
  ok(res, { notification }, 'Marked read');
});

export const markAllRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAllRead(req.user.id);
  ok(res, data, 'All marked read');
});
