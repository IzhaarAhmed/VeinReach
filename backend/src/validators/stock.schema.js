import { z } from 'zod';
import { BLOOD_GROUPS, STOCK_LEVELS } from '../constants/index.js';

const coordinates = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

const location = z.object({ type: z.literal('Point').optional(), coordinates });

export const upsertStockSchema = z
  .object({
    organizationName: z.string().trim().max(160).optional(),
    address: z.string().trim().max(300).optional(),
    location: location.optional(),
    inventory: z
      .array(
        z.object({
          bloodGroup: z.enum(BLOOD_GROUPS),
          units: z.number().int().min(0).max(100000).optional(),
          level: z.enum(STOCK_LEVELS).optional(),
        })
      )
      .max(8)
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const publishShortageSchema = z.object({
  bloodGroup: z.enum(BLOOD_GROUPS),
  level: z.enum(['low', 'critical', 'out']).optional(),
  radiusKm: z.number().min(1).max(200).optional(),
  note: z.string().trim().max(300).optional(),
});

export const nearbyStockSchema = z.object({
  lng: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
  radiusKm: z.coerce.number().min(1).max(200).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  shortagesOnly: z.coerce.boolean().optional(),
});
