import { io } from 'socket.io-client';
import { getAccessToken } from './api.js';

const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

/** Lazily create an authenticated socket. Call after login. */
export function getSocket() {
  if (socket) return socket;
  socket = io(url, {
    autoConnect: false,
    auth: (cb) => cb({ token: getAccessToken() }),
  });
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}
