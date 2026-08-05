import { z } from 'zod';
import {
  REPORT_TARGET_TYPES,
  REPORT_CATEGORIES,
  REPORT_STATUS,
  MODERATION_ACTIONS,
} from '../constants/index.js';

export const createReportSchema = z
  .object({
    targetType: z.enum(REPORT_TARGET_TYPES),
    targetUserId: z.string().min(1).optional(),
    targetRequestId: z.string().min(1).optional(),
    category: z.enum(REPORT_CATEGORIES),
    description: z.string().trim().max(2000).optional(),
  })
  .refine(
    (v) => (v.targetType === 'user' ? !!v.targetUserId : !!v.targetRequestId),
    { message: 'Provide targetUserId for a user report or targetRequestId for a request report' }
  );

export const resolveReportSchema = z.object({
  // Only terminal states are settable here.
  status: z.enum(REPORT_STATUS.filter((s) => ['resolved', 'dismissed'].includes(s))),
  action: z.enum(MODERATION_ACTIONS).optional(),
  resolutionNote: z.string().trim().max(2000).optional(),
});
