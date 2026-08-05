/* global firebase, importScripts */
/**
 * Firebase Cloud Messaging service worker — receives push notifications while
 * the app tab is closed or in the background.
 *
 * The Firebase web config is passed as query params at registration time
 * (see src/lib/push.js), so this static file never needs editing.
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const params = new URLSearchParams(self.location.search);
firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // Payloads with `notification` are displayed automatically by the SDK —
  // only render data-only messages ourselves to avoid duplicates.
  if (payload.notification) return;
  const title = payload.data?.title || 'VeinReach';
  self.registration.showNotification(title, {
    body: payload.data?.body || '',
    icon: '/favicon.svg',
    data: payload.data || {},
  });
});

// Focus (or open) the app when a notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const existing = wins.find((w) => w.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow('/dashboard');
    })
  );
});
