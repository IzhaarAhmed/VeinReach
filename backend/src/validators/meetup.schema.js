import { z } from 'zod';
import { BLOOD_GROUPS } from '../constants/index.js';

export const createMeetupSchema = z.object({
  donorId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid donor id'),
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  bloodGroup: z.enum(BLOOD_GROUPS),
});

export const respondMeetupSchema = z.object({
  accept: z.boolean(),
});
