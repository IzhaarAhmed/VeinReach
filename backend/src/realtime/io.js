import { Server } from 'socket.io';
import { isAllowedOrigin } from '../config/env.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { getRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

let io = null;

/**
 * Per-instance online set. Backs isUserOnline() so chat can mark messages
 * delivered synchronously without a Redis round-trip. Redis still holds the
 * cross-instance presence set for anything that needs the global view.
 */
const onlineCounts = new Map();

function addOnline(userId) {
  onlineCounts.set(userId, (onlineCounts.get(userId) || 0) + 1);
}
function removeOnline(userId) {
  const n = (onlineCounts.get(userId) || 0) - 1;
  if (n <= 0) onlineCounts.delete(userId);
  else onlineCounts.set(userId, n);
}

/** True when the user has at least one live socket on this instance. */
export function isUserOnline(userId) {
  return onlineCounts.has(String(userId));
}

/** Access the Socket.io server instance from services (null before init). */
export function getIO() {
  return io;
}

/**
 * Initialize Socket.io on the given HTTP server. Authenticates each socket via
 * a JWT access token, tracks presence, and exposes rooms for the real-time
 * donor radar, request updates, and chat (messages + typing + read receipts).
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    // Same origin rule as the HTTP layer, so a browser that can call the API
    // can always open the socket too.
    cors: { origin: (origin, cb) => cb(null, isAllowedOrigin(origin)), credentials: true },
  });

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('unauthorized'));
    try {
      const payload = verifyAccessToken(token);
      socket.user = { id: payload.sub, role: payload.role };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const redis = getRedis();
    const userId = socket.user.id;
    addOnline(userId);
    await redis.sadd('presence:online', userId);
    socket.join(`user:${userId}`);
    logger.debug('socket connected', userId);

    // Client subscribes to a geographic interest (e.g. for radar updates).
    socket.on('radar:subscribe', (room) => {
      if (typeof room === 'string') socket.join(`radar:${room}`);
    });

    // Chat is persisted over REST; sockets carry only ephemeral + receipt events.
    // Typing indicator — relayed straight to the peer, never stored.
    socket.on('chat:typing', ({ conversationId, to, typing } = {}) => {
      if (to)
        io.to(`user:${to}`).emit('chat:typing', {
          conversationId,
          from: userId,
          typing: Boolean(typing),
        });
    });

    // Peer opened the thread — mark read + emit a receipt via the service.
    socket.on('chat:read', async ({ conversationId } = {}) => {
      if (!conversationId) return;
      try {
        const { markRead } = await import('../services/chat.service.js');
        await markRead(userId, conversationId);
      } catch (err) {
        logger.error('socket chat:read failed', err);
      }
    });

    socket.on('disconnect', async () => {
      removeOnline(userId);
      await redis.srem('presence:online', userId);
    });
  });

  return io;
}
