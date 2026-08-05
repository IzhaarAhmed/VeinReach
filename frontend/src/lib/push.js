import { api } from './api.js';

/**
 * Web push via Firebase Cloud Messaging. Everything degrades gracefully:
 * if the VITE_FIREBASE_* vars are unset or the browser doesn't support
 * push, these functions quietly do nothing.
 */
const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

const configured = Boolean(
  cfg.apiKey && cfg.projectId && cfg.messagingSenderId && cfg.appId && vapidKey
);

let currentToken = null;

const browserSupports = () =>
  'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window;

/** True when the "Enable push" button should be offered to the user. */
export function canOfferPush() {
  return configured && browserSupports() && Notification.permission === 'default';
}

/** True when permission is already granted and we can register silently. */
export function pushAlreadyGranted() {
  return configured && browserSupports() && Notification.permission === 'granted';
}

/**
 * Request permission (no-op if already granted), obtain an FCM device token
 * and register it with the backend. Returns true on success.
 * Call from a user gesture the first time — browsers punish unsolicited
 * permission prompts.
 */
export async function enablePush() {
  if (!configured || !browserSupports()) return false;
  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return false;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    // The SW reads its config from these query params — see public/firebase-messaging-sw.js
    const query = new URLSearchParams(cfg).toString();
    const swReg = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${query}`
    );

    const app = getApps()[0] || initializeApp(cfg);
    const token = await getToken(getMessaging(app), {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });
    if (!token) return false;

    await api.post('/users/me/fcm-token', { token });
    currentToken = token;
    return true;
  } catch (err) {
    console.warn('[push] registration failed:', err?.message || err);
    return false;
  }
}

/**
 * Detach this browser's device token from the account (call on logout so the
 * next user on this machine doesn't receive the previous user's alerts).
 */
export async function disablePush() {
  if (!currentToken) return;
  const token = currentToken;
  currentToken = null;
  try {
    await api.delete('/users/me/fcm-token', { data: { token } });
  } catch {
    /* best effort — the backend also caps and rotates stale tokens */
  }
}
