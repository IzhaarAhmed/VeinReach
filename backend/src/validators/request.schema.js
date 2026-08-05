import { z } from 'zod';
import { BLOOD_GROUPS, URGENCY_LEVELS } from '../constants/index.js';

const coordinates = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

export const createRequestSchema = z.object({
  bloodGroup: z.enum(BLOOD_GROUPS),
  unitsRequired: z.number().int().positive().max(50),
  hospitalName: z.string().min(2).max(200),
  hospitalAddress: z.string().max(300).optional(),
  hospitalLocation: z.object({
    type: z.literal('Point').optional(),
    coordinates,
  }),
  urgency: z.enum(URGENCY_LEVELS).optional(),
  notes: z.string().max(1000).optional(),
});

export const searchDonorsSchema = z.object({
  bloodGroup: z.enum(BLOOD_GROUPS),
  lng: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
  radiusKm: z.coerce.number().positive().max(500).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});
