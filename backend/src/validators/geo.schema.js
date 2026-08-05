import { z } from 'zod';

export const hospitalSearchSchema = z.object({
  q: z.string().min(2).max(200),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().positive().max(20).optional(),
});
