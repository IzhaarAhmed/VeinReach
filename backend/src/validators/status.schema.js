import { z } from 'zod';
import { REQUEST_STATUS } from '../constants/index.js';

export const setStatusSchema = z.object({
  status: z.enum(REQUEST_STATUS),
});
