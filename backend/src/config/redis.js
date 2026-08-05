import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Optional Redis client. If REDIS_URL is unset (or ioredis isn't installed),
 * we export a no-op stub so callers don't need to branch everywhere. This lets
 * rate limiting / presence / cached counts work in dev without Redis running.
 */
let client = null;

const noop = {
  enabled: false,
  async get() {
    return null;
  },
  async set() {},
  async del() {},
  async incr() {
    return 0;
  },
  async expire() {},
  async sadd() {},
  async srem() {},
  async scard() {
    return 0;
  },
  async publish() {},
};

export async function initRedis() {
  if (!env.redisUrl) {
    logger.warn('Redis not configured — using in-memory no-op stub');
    client = noop;
    return client;
  }

  try {
    const { default: Redis } = await import('ioredis');
    const redis = new Redis(env.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
    redis.on('error', (err) => logger.error('Redis error', err));
    await redis.connect();
    redis.enabled = true;
    client = redis;
    logger.info('Redis connected');
  } catch (err) {
    logger.error('Redis init failed — falling back to no-op stub', err);
    client = noop;
  }

  return client;
}

export function getRedis() {
  return client || noop;
}
