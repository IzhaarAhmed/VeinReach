import { z } from 'zod';
import { USER_ROLES } from '../constants/index.js';

export const setRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});

export const suspendSchema = z.object({
  suspend: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export const reviewOrgSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(1000).optional(),
});
