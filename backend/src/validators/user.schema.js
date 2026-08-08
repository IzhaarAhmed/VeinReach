import { z } from 'zod';

const coordinates = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

const location = z.object({
  type: z.literal('Point').optional(),
  coordinates,
});

export const updateMeSchema = z
  .object({
    fullName: z.string().min(2).max(100).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    emergencyContact: z.string().max(30).optional(),
    weight: z.number().min(20).max(300).optional(),
    location: location.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const fcmTokenSchema = z.object({
  token: z.string().min(10).max(4096),
});

/**
 * Closing an account. The password re-authenticates an irreversible action, and
 * the literal confirmation phrase makes it impossible to trigger by replaying a
 * bare DELETE — a misrouted click cannot erase a donation history.
 */
export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Your password is required to close the account'),
  confirm: z.literal('DELETE', {
    errorMap: () => ({ message: 'Type DELETE to confirm' }),
  }),
});

// 'ineligible' is system-derived (cooldown/age/weight), never client-set.
export const updateDonorProfileSchema = z
  .object({
    isAvailable: z.boolean().optional(),
    status: z.enum(['available', 'busy', 'offline']).optional(),
    preferredRadiusKm: z.number().min(1).max(200).optional(),
    location: location.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
