import { z } from 'zod';

export const feedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});
