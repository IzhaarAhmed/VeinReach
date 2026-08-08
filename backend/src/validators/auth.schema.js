import { z } from 'zod';
import { BLOOD_GROUPS, GENDERS, SELF_REGISTER_ROLES } from '../constants/index.js';

const coordinates = z
  .tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
  .describe('[longitude, latitude]');

export const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  mobile: z.string().min(6).max(20),
  password: z.string().min(8).max(128),
  bloodGroup: z.enum(BLOOD_GROUPS),
  gender: z.enum(GENDERS),
  dateOfBirth: z.coerce.date(),
  weight: z.number().positive().max(500),
  city: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  emergencyContact: z.string().max(40).optional(),
  role: z.enum(SELF_REGISTER_ROLES).optional(),
  location: z
    .object({ type: z.literal('Point').optional(), coordinates })
    .optional(),

  /**
   * Explicit consent to the privacy policy. Required, and required to be `true`
   * rather than merely present — the platform collects health data (blood group)
   * and precise location, so consent has to be an affirmative act (DPDP §6,
   * GDPR Art. 7). The accepted policy version is recorded on the account.
   */
  acceptPrivacy: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the privacy policy to register' }),
  }),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  token: z.string().min(32).max(128),
});

export const verifyOtpSchema = z.object({
  // Accept the code as a string or a JSON number (coerced), 4–8 digits.
  code: z.coerce.string().regex(/^\d{4,8}$/, 'Code must be 4–8 digits'),
});

/* ── Password reset ─────────────────────────────────────────────────────── */

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const verifyResetOtpSchema = z.object({
  email: z.string().email(),
  code: z.coerce.string().regex(/^\d{4,8}$/, 'Code must be 4–8 digits'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  // 32 random bytes, hex-encoded by the server.
  ticket: z.string().min(32).max(128),
  // Same floor as registration — a reset must never weaken the policy.
  password: z.string().min(8).max(128),
});
