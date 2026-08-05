import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  verifyOtpSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
} from '../validators/auth.schema.js';

const router = Router();

// Stricter limiter on auth endpoints to blunt credential stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: {}, message: 'Too many attempts, try later' },
});

// Tighter still for OTP: cap send/verify bursts (the service also enforces a
// per-user resend cooldown + attempt cap).
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: {}, message: 'Too many OTP requests, try later' },
});

router.post('/register', authLimiter, validate(registerSchema), ctrl.register);
router.post('/login', authLimiter, validate(loginSchema), ctrl.login);
router.post('/refresh', authLimiter, ctrl.refresh);
router.post('/logout', requireAuth, ctrl.logout);
router.get('/me', requireAuth, ctrl.me);
router.post('/verify-email', authLimiter, validate(verifyEmailSchema), ctrl.verifyEmail);
router.post('/resend-verification', authLimiter, requireAuth, ctrl.resendVerification);
/* Password reset — all public (the caller is by definition locked out) and all
   behind the OTP limiter, since each one either mails a code or guesses one. */
router.post('/forgot-password', otpLimiter, validate(forgotPasswordSchema), ctrl.forgotPassword);
router.post('/verify-reset-otp', otpLimiter, validate(verifyResetOtpSchema), ctrl.verifyResetOtp);
router.post('/reset-password', otpLimiter, validate(resetPasswordSchema), ctrl.resetPassword);

router.post('/send-otp', otpLimiter, requireAuth, ctrl.sendMobileOtp);
router.post('/verify-otp', otpLimiter, requireAuth, validate(verifyOtpSchema), ctrl.verifyMobileOtp);

export default router;
