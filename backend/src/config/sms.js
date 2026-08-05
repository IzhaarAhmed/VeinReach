import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Optional SMS gateway for mobile OTP delivery. If no provider is configured
 * (or its credentials are incomplete), messages are logged instead of sent so
 * OTP verification is fully testable in dev — same stub pattern as the mailer.
 *
 * Only 'twilio' is wired today; add providers by extending the switch below.
 */
let sender = null;

export async function initSms() {
  const { provider, accountSid, authToken, from } = env.sms;

  if (provider === 'twilio' && accountSid && authToken && from) {
    try {
      const { default: twilio } = await import('twilio');
      const client = twilio(accountSid, authToken);
      sender = (to, body) => client.messages.create({ to, from, body });
      logger.info('SMS ready (twilio)');
    } catch (err) {
      logger.error('Twilio init failed — OTP codes will be logged, not sent', err);
    }
    return sender;
  }

  logger.warn('SMS not configured — OTP codes will be logged, not sent');
  return null;
}

/**
 * Send an SMS. When no gateway is active the message is logged (dev) so the
 * flow still works end-to-end. Never throws for a delivery failure — the OTP
 * is already persisted; the caller decides how to surface a send error.
 */
export async function sendSms({ to, body }) {
  if (!sender) {
    logger.info(`[sms:dev] to=${to}\n${body}`);
    return { logged: true };
  }
  try {
    await sender(to, body);
    return { sent: true };
  } catch (err) {
    logger.error(`SMS send failed to ${to}`, err);
    return { sent: false, error: err.message };
  }
}
