import { readFile } from 'fs/promises';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Optional Firebase Cloud Messaging. Disabled (no-op) unless BOTH are true:
 *   1. FCM_SERVICE_ACCOUNT is set (inline JSON or a path to the JSON file)
 *   2. firebase-admin is installed (`npm i firebase-admin` — kept out of
 *      package.json so the heavy dependency is opt-in)
 */
let messaging = null;

export async function initFcm() {
  if (!env.fcmServiceAccount) {
    logger.warn('FCM not configured — push notifications disabled');
    return null;
  }

  try {
    const raw = env.fcmServiceAccount.trim().startsWith('{')
      ? env.fcmServiceAccount
      : await readFile(env.fcmServiceAccount, 'utf8');
    const serviceAccount = JSON.parse(raw);

    // Modular subpath imports — the legacy `admin.credential.cert` namespace
    // isn't exposed through a dynamic ESM import of 'firebase-admin' (v11+).
    const { initializeApp, cert } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');
    const app = initializeApp({ credential: cert(serviceAccount) });
    messaging = getMessaging(app);
    logger.info('FCM ready');
  } catch (err) {
    logger.error(
      'FCM init failed — push disabled (is firebase-admin installed and the service account valid?)',
      err
    );
  }
  return messaging;
}

/** Send a push to a set of device tokens. Silently no-ops when FCM is off. */
export async function sendPush(tokens, { title, body, data = {} }) {
  if (!messaging || !tokens?.length) return null;

  // FCM requires all data values to be strings.
  const stringData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)])
  );

  return messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: stringData,
  });
}
