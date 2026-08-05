import { z } from 'zod';
import { UPLOAD_PURPOSES } from '../constants/index.js';

const PURPOSES = Object.keys(UPLOAD_PURPOSES);

export const presignSchema = z.object({
  purpose: z.enum(PURPOSES),
  contentType: z.string().min(3).max(100),
  // Optional client-declared size for an early limit check (bytes).
  sizeBytes: z.number().int().positive().optional(),
});

/** Attach an already-uploaded object key to the user's profile image. */
export const setAvatarSchema = z.object({
  key: z.string().min(3).max(300),
});

/** Attach an uploaded verification / hospital document to the user. */
export const addDocumentSchema = z.object({
  key: z.string().min(3).max(300),
  docType: z.enum(['id_proof', 'medical', 'hospital_license', 'bloodbank_license', 'other']),
  label: z.string().max(120).optional(),
});
