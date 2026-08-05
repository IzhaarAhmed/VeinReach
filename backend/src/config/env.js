import dotenv from 'dotenv';

dotenv.config();

/**
 * Centralized environment access. Read process.env exactly once here so the
 * rest of the app imports typed-ish constants instead of strings.
 *
 * NOTE: validation is intentionally NOT run at import time — importing this
 * module (e.g. from a pure service in a unit test) must never kill the process.
 * Call validateEnv() explicitly from the server entrypoint to fail fast.
 */
const REQUIRED = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

/**
 * Assert that the variables needed to actually run the API are present.
 * Logs and exits the process when any are missing. Call once at startup.
 */
export function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `\n[config] Missing required environment variables: ${missing.join(', ')}\n` +
        `Copy .env.example to .env and fill them in.\n`
    );
    process.exit(1);
  }
}

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const bool = (value, fallback) => {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: num(process.env.PORT, 5000),
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  mongoUri: process.env.MONGODB_URI,

  /**
   * Comma-separated addresses promoted to `admin` at startup. Promote-only —
   * these accounts must already exist (see bootstrap.service.js). Safe to leave
   * set: the promotion is idempotent and never demotes.
   */
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  // Whether the refresh cookie requires HTTPS. Defaults to prod behaviour, but
  // can be forced off (e.g. the Docker stack served over plain HTTP on :8080).
  cookieSecure: bool(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production'),

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '30d',
  },

  redisUrl: process.env.REDIS_URL || '',

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'VeinReach <no-reply@veinreach.local>',
  },

  // Firebase service account for push notifications: inline JSON or a file
  // path. Leave empty to disable push (also requires `npm i firebase-admin`).
  fcmServiceAccount: process.env.FCM_SERVICE_ACCOUNT || '',

  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucket: process.env.R2_BUCKET || '',
    publicUrl: process.env.R2_PUBLIC_URL || '',
  },

  uploads: {
    // Max size a client may request a presigned upload URL for.
    maxMb: num(process.env.UPLOAD_MAX_MB, 10),
    // How long presigned PUT/GET URLs stay valid.
    presignTtlSec: num(process.env.UPLOAD_PRESIGN_TTL_SEC, 300),
  },

  // Optional SMS gateway for mobile OTP. provider '' disables real sending
  // (codes are logged in dev). 'twilio' uses the Twilio REST API.
  sms: {
    provider: (process.env.SMS_PROVIDER || '').toLowerCase(),
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.SMS_FROM || '',
  },

  otp: {
    length: num(process.env.OTP_LENGTH, 6),
    ttlMin: num(process.env.OTP_TTL_MIN, 10),
    maxAttempts: num(process.env.OTP_MAX_ATTEMPTS, 5),
    // Minimum seconds between OTP send requests for one user (anti-abuse).
    resendCooldownSec: num(process.env.OTP_RESEND_COOLDOWN_SEC, 60),
  },

  rules: {
    minDonorAge: num(process.env.MIN_DONOR_AGE, 18),
    maxDonorAge: num(process.env.MAX_DONOR_AGE, 65),
    minDonorWeight: num(process.env.MIN_DONOR_WEIGHT, 50),
    cooldownDaysMale: num(process.env.COOLDOWN_DAYS_MALE, 90),
    cooldownDaysFemale: num(process.env.COOLDOWN_DAYS_FEMALE, 120),
    emergencyRadiusKm: num(process.env.EMERGENCY_RADIUS_KM, 20),
    // Minutes a critical request stays unaccepted before the broadcast radius
    // escalates one step (spec: 20 → 50 → 100 km).
    escalationAfterMin: num(process.env.ESCALATION_AFTER_MIN, 15),
    // How often the request lifecycle worker (expiry + escalation) runs.
    workerIntervalSec: num(process.env.WORKER_INTERVAL_SEC, 60),
  },
};

/** Any loopback host, any port — localhost, 127.0.0.1, or IPv6 [::1]. */
const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * Whether a browser Origin may call this API. Shared by the HTTP CORS layer and
 * the Socket.io handshake so the two can never disagree.
 *
 * Production is strict: the origin must be listed in CLIENT_URL. Development
 * additionally accepts any loopback origin, because `localhost:3000` and
 * `127.0.0.1:3000` are different origins to a browser even though they are the
 * same server — and a rejected origin surfaces to the SPA as an unhelpful
 * "cannot reach the server" network error rather than anything diagnosable.
 */
export function isAllowedOrigin(origin) {
  // No Origin header at all: curl, server-to-server, same-origin navigation.
  if (!origin) return true;
  if (env.clientUrls.includes(origin)) return true;
  return !env.isProd && LOOPBACK_ORIGIN.test(origin);
}
