import crypto from 'crypto';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { PRIVACY_POLICY_VERSION } from '../constants/index.js';
import { sendMail } from '../config/mailer.js';
import { sendSms } from '../config/sms.js';
import { logger } from '../utils/logger.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/tokens.js';

const EMAIL_TOKEN_TTL_HOURS = 24;

/* ── Mobile OTP verification ───────────────────────────────────────────── */

const OTP_FIELDS =
  '+verification.mobileOtpHash +verification.mobileOtpExpires ' +
  '+verification.mobileOtpAttempts +verification.mobileOtpLastSentAt';

/** Cryptographically-random numeric code of the configured length. */
function generateOtp() {
  const max = 10 ** env.otp.length;
  return String(crypto.randomInt(0, max)).padStart(env.otp.length, '0');
}

/**
 * Issue (or re-issue) a mobile OTP. Rate-limited per user by a resend cooldown.
 * The code is hashed at rest; the plaintext is only ever sent over SMS (logged
 * in dev). Returns nothing sensitive.
 */
export async function sendMobileOtp(userId) {
  const user = await User.findById(userId).select(`mobile fullName ${OTP_FIELDS}`);
  if (!user) throw ApiError.notFound('User not found');
  if (user.verification.mobileVerified)
    throw ApiError.badRequest('Mobile number already verified');

  const lastSent = user.verification.mobileOtpLastSentAt;
  if (lastSent) {
    const waited = (Date.now() - lastSent.getTime()) / 1000;
    if (waited < env.otp.resendCooldownSec)
      throw ApiError.tooMany(
        `Please wait ${Math.ceil(env.otp.resendCooldownSec - waited)}s before requesting another code`
      );
  }

  const code = generateOtp();
  user.verification.mobileOtpHash = hashToken(code);
  user.verification.mobileOtpExpires = new Date(Date.now() + env.otp.ttlMin * 60 * 1000);
  user.verification.mobileOtpAttempts = 0;
  user.verification.mobileOtpLastSentAt = new Date();
  await user.save();

  if (!env.isProd) logger.info(`[mobile-otp] ${user.mobile} → ${code}`);
  await sendSms({
    to: user.mobile,
    body: `Your VeinReach verification code is ${code}. It expires in ${env.otp.ttlMin} minutes.`,
  });

  return { sent: true, expiresInMin: env.otp.ttlMin };
}

/**
 * Verify a submitted OTP. Enforces expiry and an attempt cap (a wrong code
 * increments attempts; exceeding the cap invalidates the OTP so a new one must
 * be requested). On success the mobile number is marked verified.
 */
export async function verifyMobileOtp(userId, code) {
  const user = await User.findById(userId).select(OTP_FIELDS);
  if (!user) throw ApiError.notFound('User not found');
  if (user.verification.mobileVerified)
    return { mobileVerified: true, alreadyVerified: true };

  const { mobileOtpHash, mobileOtpExpires, mobileOtpAttempts } = user.verification;
  if (!mobileOtpHash || !mobileOtpExpires)
    throw ApiError.badRequest('No active code — request a new one');
  if (mobileOtpExpires < new Date()) {
    clearOtp(user);
    await user.save();
    throw ApiError.badRequest('Code expired — request a new one');
  }
  if (mobileOtpAttempts >= env.otp.maxAttempts) {
    clearOtp(user);
    await user.save();
    throw ApiError.tooMany('Too many incorrect attempts — request a new code');
  }

  if (hashToken(String(code)) !== mobileOtpHash) {
    user.verification.mobileOtpAttempts = mobileOtpAttempts + 1;
    await user.save();
    const left = env.otp.maxAttempts - user.verification.mobileOtpAttempts;
    throw ApiError.badRequest(
      left > 0 ? `Incorrect code — ${left} attempt(s) left` : 'Too many incorrect attempts — request a new code'
    );
  }

  user.verification.mobileVerified = true;
  clearOtp(user);
  await user.save();
  return { mobileVerified: true, alreadyVerified: false };
}

function clearOtp(user) {
  user.verification.mobileOtpHash = undefined;
  user.verification.mobileOtpExpires = undefined;
  user.verification.mobileOtpAttempts = 0;
  user.verification.mobileOtpLastSentAt = undefined;
}

/* ── Password reset (emailed OTP) ──────────────────────────────────────────
   Three steps: request a code, exchange the code for a short-lived ticket,
   then set a new password with that ticket. The middle step exists so a wrong
   code is reported before the user types a new password, and so the code is
   consumed exactly once rather than being replayed on the final request. */

const RESET_FIELDS =
  '+passwordReset.otpHash +passwordReset.otpExpires +passwordReset.attempts ' +
  '+passwordReset.lastSentAt +passwordReset.ticketHash +passwordReset.ticketExpires';

const RESET_TICKET_TTL_MIN = 10;

/**
 * The nested `passwordReset` object is absent on users created before this
 * field existed, so never assume it is there before writing to it.
 */
function resetSlot(user) {
  if (!user.passwordReset) user.passwordReset = {};
  return user.passwordReset;
}

function clearPasswordReset(user) {
  const slot = resetSlot(user);
  slot.otpHash = undefined;
  slot.otpExpires = undefined;
  slot.attempts = 0;
  slot.lastSentAt = undefined;
  slot.ticketHash = undefined;
  slot.ticketExpires = undefined;
}

async function sendPasswordResetEmail(user, code) {
  const ttl = env.otp.ttlMin;
  await sendMail({
    to: user.email,
    subject: `${code} is your VeinReach password reset code`,
    text:
      `Hi ${user.fullName},\n\n` +
      `Your VeinReach password reset code is ${code}\n\n` +
      `It expires in ${ttl} minutes and can only be used once.\n\n` +
      `If you didn't ask to reset your password, you can ignore this email — ` +
      `your password has not been changed.`,
    html:
      `<p>Hi ${user.fullName},</p>` +
      `<p>Your VeinReach password reset code is:</p>` +
      `<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>` +
      `<p>It expires in ${ttl} minutes and can only be used once.</p>` +
      `<p>If you didn't ask to reset your password, you can ignore this email — ` +
      `your password has not been changed.</p>`,
  });
}

async function sendPasswordChangedEmail(user) {
  await sendMail({
    to: user.email,
    subject: 'Your VeinReach password was changed',
    text:
      `Hi ${user.fullName},\n\n` +
      `Your VeinReach password was just changed, and you've been signed out ` +
      `on all devices.\n\n` +
      `If this wasn't you, reset your password immediately and contact support.`,
    html:
      `<p>Hi ${user.fullName},</p>` +
      `<p>Your VeinReach password was just changed, and you've been signed out ` +
      `on all devices.</p>` +
      `<p>If this wasn't you, reset your password immediately and contact support.</p>`,
  });
}

/**
 * Step 1 — email a reset code.
 *
 * Always resolves with the same payload whether or not the address is
 * registered: a different response (or a cooldown error) would turn this into
 * an account-enumeration oracle. Abuse is bounded by the route rate limiter
 * plus the silent per-user resend cooldown.
 */
export async function requestPasswordReset(email) {
  const generic = { sent: true, expiresInMin: env.otp.ttlMin };

  const user = await User.findOne({ email }).select(
    `email fullName isSuspended ${RESET_FIELDS}`
  );
  if (!user || user.isSuspended) return generic;

  const lastSent = user.passwordReset?.lastSentAt;
  if (lastSent) {
    const waited = (Date.now() - lastSent.getTime()) / 1000;
    // Surfacing the remaining cooldown would confirm the account exists, so
    // just decline to send again and report the same generic result.
    if (waited < env.otp.resendCooldownSec) return generic;
  }

  const code = generateOtp();
  const slot = resetSlot(user);
  slot.otpHash = hashToken(code);
  slot.otpExpires = new Date(Date.now() + env.otp.ttlMin * 60 * 1000);
  slot.attempts = 0;
  slot.lastSentAt = new Date();
  // Requesting a new code invalidates any ticket already handed out.
  slot.ticketHash = undefined;
  slot.ticketExpires = undefined;
  await user.save();

  if (!env.isProd) logger.info(`[password-reset] ${user.email} → ${code}`);

  // Fire-and-forget, exactly like the registration email — and here it is also
  // a security requirement, not just latency. Awaiting the SMTP round trip
  // makes a registered address respond seconds slower than an unknown one,
  // which hands an attacker the very enumeration oracle the generic response
  // above exists to close. It also blocks the HTTP response on a third-party
  // service that can stall indefinitely.
  sendPasswordResetEmail(user, code).catch((err) =>
    logger.error('password reset email failed', err)
  );

  return generic;
}

/**
 * Step 2 — exchange a valid code for a single-use reset ticket.
 *
 * An unknown address fails with exactly the same error as a wrong code, so
 * this step leaks nothing either.
 */
export async function verifyPasswordResetOtp(email, code) {
  const invalid = () => ApiError.badRequest('Invalid or expired code');

  const user = await User.findOne({ email }).select(RESET_FIELDS);
  if (!user) throw invalid();

  const { otpHash, otpExpires, attempts = 0 } = user.passwordReset ?? {};
  if (!otpHash || !otpExpires) throw invalid();

  if (otpExpires < new Date()) {
    clearPasswordReset(user);
    await user.save();
    throw ApiError.badRequest('Code expired — request a new one');
  }

  if (attempts >= env.otp.maxAttempts) {
    clearPasswordReset(user);
    await user.save();
    throw ApiError.tooMany('Too many incorrect attempts — request a new code');
  }

  if (hashToken(String(code)) !== otpHash) {
    resetSlot(user).attempts = attempts + 1;
    await user.save();
    const left = env.otp.maxAttempts - user.passwordReset.attempts;
    throw ApiError.badRequest(
      left > 0
        ? `Incorrect code — ${left} attempt(s) left`
        : 'Too many incorrect attempts — request a new code'
    );
  }

  // Correct: burn the code and hand back a ticket for the final step.
  const ticket = crypto.randomBytes(32).toString('hex');
  const slot = resetSlot(user);
  slot.otpHash = undefined;
  slot.otpExpires = undefined;
  slot.attempts = 0;
  slot.ticketHash = hashToken(ticket);
  slot.ticketExpires = new Date(Date.now() + RESET_TICKET_TTL_MIN * 60 * 1000);
  await user.save();

  return { ticket, expiresInMin: RESET_TICKET_TTL_MIN };
}

/** Step 3 — set the new password and end every existing session. */
export async function resetPassword({ email, ticket, password }) {
  const invalid = () =>
    ApiError.badRequest('Reset session is invalid or has expired — start again');

  const user = await User.findOne({ email }).select(
    `+passwordHash +refreshTokens ${RESET_FIELDS}`
  );
  if (!user) throw invalid();

  const { ticketHash, ticketExpires } = user.passwordReset ?? {};
  if (!ticketHash || !ticketExpires) throw invalid();
  if (ticketExpires < new Date()) {
    clearPasswordReset(user);
    await user.save();
    throw invalid();
  }
  if (hashToken(ticket) !== ticketHash) throw invalid();

  await user.setPassword(password);
  clearPasswordReset(user);
  // Whoever forced the reset may have live sessions; none of them are
  // trustworthy now, so revoke every refresh token.
  user.refreshTokens = [];
  await user.save();

  sendPasswordChangedEmail(user).catch((err) =>
    logger.error('password changed email failed', err)
  );

  return { email: user.email };
}

function issueTokens(user) {
  const payload = { sub: user._id.toString(), role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

/** Set a fresh one-time email verification token on the user (not saved). */
function issueEmailToken(user) {
  const raw = crypto.randomBytes(32).toString('hex');
  user.verification.emailTokenHash = hashToken(raw);
  user.verification.emailTokenExpires = new Date(
    Date.now() + EMAIL_TOKEN_TTL_HOURS * 60 * 60 * 1000
  );
  return raw;
}

async function sendVerificationEmail(user, rawToken) {
  const url = `${env.clientUrls[0]}/verify-email?email=${encodeURIComponent(
    user.email
  )}&token=${rawToken}`;
  // Dev convenience: the link is always retrievable from the server log.
  if (!env.isProd) logger.info(`[verify-email] ${user.email} → ${url}`);
  await sendMail({
    to: user.email,
    subject: 'Verify your VeinReach email',
    text:
      `Hi ${user.fullName},\n\n` +
      `Confirm your email address to activate your VeinReach account:\n${url}\n\n` +
      `The link expires in ${EMAIL_TOKEN_TTL_HOURS} hours. ` +
      `If you didn't create this account, you can ignore this email.`,
    html:
      `<p>Hi ${user.fullName},</p>` +
      `<p>Confirm your email address to activate your VeinReach account:</p>` +
      `<p><a href="${url}">Verify my email</a></p>` +
      `<p>The link expires in ${EMAIL_TOKEN_TTL_HOURS} hours. ` +
      `If you didn't create this account, you can ignore this email.</p>`,
  });
}

export async function register(input) {
  const existing = await User.findOne({ email: input.email });
  if (existing) throw ApiError.conflict('Email already registered');

  const user = new User({
    fullName: input.fullName,
    email: input.email,
    mobile: input.mobile,
    bloodGroup: input.bloodGroup,
    gender: input.gender,
    dateOfBirth: input.dateOfBirth,
    weight: input.weight,
    city: input.city,
    state: input.state,
    emergencyContact: input.emergencyContact,
    role: input.role || 'donor',
    location: input.location
      ? { type: 'Point', coordinates: input.location.coordinates }
      : undefined,
    // Record which policy text was accepted, not merely that a box was ticked —
    // "they agreed to something, once" is not evidence of anything later.
    consent: { privacyVersion: PRIVACY_POLICY_VERSION, acceptedAt: new Date() },
  });
  await user.setPassword(input.password);

  const tokens = issueTokens(user);
  user.refreshTokens = [hashToken(tokens.refreshToken)];
  const emailToken = issueEmailToken(user);
  await user.save();

  // Fire-and-forget: a mail failure must never fail registration.
  sendVerificationEmail(user, emailToken).catch((err) =>
    logger.error('verification email failed', err)
  );

  return { user: user.toJSON(), ...tokens };
}

export async function verifyEmail({ email, token }) {
  const user = await User.findOne({ email }).select(
    '+verification.emailTokenHash +verification.emailTokenExpires'
  );
  if (!user) throw ApiError.badRequest('Invalid verification link');
  if (user.verification.emailVerified)
    return { user: user.toJSON(), alreadyVerified: true };

  const { emailTokenHash, emailTokenExpires } = user.verification;
  if (!emailTokenHash || hashToken(token) !== emailTokenHash)
    throw ApiError.badRequest('Invalid verification link');
  if (!emailTokenExpires || emailTokenExpires < new Date())
    throw ApiError.badRequest('Verification link expired — request a new one');

  user.verification.emailVerified = true;
  user.verification.emailTokenHash = undefined;
  user.verification.emailTokenExpires = undefined;
  await user.save();

  return { user: user.toJSON(), alreadyVerified: false };
}

export async function resendVerification(userId) {
  const user = await User.findById(userId).select(
    '+verification.emailTokenHash +verification.emailTokenExpires'
  );
  if (!user) throw ApiError.notFound('User not found');
  if (user.verification.emailVerified)
    throw ApiError.badRequest('Email already verified');

  const emailToken = issueEmailToken(user);
  await user.save();
  await sendVerificationEmail(user, emailToken);
}

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash +refreshTokens');
  if (!user) throw ApiError.unauthorized('Invalid credentials');
  // A closed account fails exactly like an unknown one. Saying "this account was
  // deleted" would confirm the address had been registered, which is the same
  // enumeration oracle the password-reset flow goes to lengths to avoid — and a
  // tombstone's email is rewritten anyway, so this is belt-and-braces.
  if (user.deletedAt) throw ApiError.unauthorized('Invalid credentials');
  if (user.isSuspended) throw ApiError.forbidden('Account suspended');

  const valid = await user.verifyPassword(password);
  if (!valid) throw ApiError.unauthorized('Invalid credentials');

  const tokens = issueTokens(user);
  user.refreshTokens.push(hashToken(tokens.refreshToken));
  await user.save();

  return { user: user.toJSON(), ...tokens };
}

/** Rotate refresh token: validate, invalidate the old one, issue a fresh pair. */
export async function refresh(oldRefreshToken) {
  if (!oldRefreshToken) throw ApiError.unauthorized('Missing refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(oldRefreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  const user = await User.findById(payload.sub).select('+refreshTokens');
  if (!user) throw ApiError.unauthorized('User no longer exists');
  if (user.deletedAt) throw ApiError.unauthorized('This account has been closed');
  // Suspending already clears stored refresh tokens, so this is belt-and-braces
  // — but it means a session cannot be revived if that clearing ever fails.
  if (user.isSuspended) throw ApiError.forbidden('Account suspended');

  const oldHash = hashToken(oldRefreshToken);
  if (!user.refreshTokens.includes(oldHash)) {
    // Token reuse or already-rotated token — revoke all sessions defensively.
    user.refreshTokens = [];
    await user.save();
    throw ApiError.unauthorized('Refresh token revoked');
  }

  const tokens = issueTokens(user);
  user.refreshTokens = user.refreshTokens
    .filter((t) => t !== oldHash)
    .concat(hashToken(tokens.refreshToken));
  await user.save();

  return tokens;
}

export async function logout(userId, refreshTokenToRevoke) {
  const user = await User.findById(userId).select('+refreshTokens');
  if (!user) return;
  if (refreshTokenToRevoke) {
    const hash = hashToken(refreshTokenToRevoke);
    user.refreshTokens = user.refreshTokens.filter((t) => t !== hash);
  } else {
    user.refreshTokens = [];
  }
  await user.save();
}

export async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user || user.deletedAt) throw ApiError.notFound('User not found');
  return user.toJSON();
}
