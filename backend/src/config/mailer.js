import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Optional SMTP transport (Nodemailer). If SMTP isn't configured or the
 * credentials fail verification, emails are logged instead of sent so the
 * rest of the app never has to branch — same pattern as the Redis stub.
 */
let transporter = null;

export async function initMailer() {
  if (!env.smtp.host || !env.smtp.user) {
    logger.warn('SMTP not configured — emails will be logged, not sent');
    return null;
  }

  const { default: nodemailer } = await import('nodemailer');
  const candidate = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });

  try {
    await candidate.verify(); // checks connection + login without sending
    transporter = candidate;
    logger.info(`SMTP ready (${env.smtp.host})`);
  } catch (err) {
    logger.error('SMTP verification failed — emails will be logged, not sent', err);
  }
  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    logger.info(`[mail:dev] to=${to} subject="${subject}"\n${text}`);
    return { logged: true };
  }
  return transporter.sendMail({ from: env.smtp.from, to, subject, text, html });
}
