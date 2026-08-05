import {
  expireOverdueRequests,
  escalateCriticalRequests,
} from '../services/request.service.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Request lifecycle worker: expires overdue requests and escalates
 * unaccepted critical ones up the broadcast-radius ladder. A simple
 * interval is fine at this scale; move to a Redis/BullMQ queue when the
 * platform runs multiple backend instances.
 */
let timer = null;

export function startRequestWorker() {
  if (timer) return timer;
  const intervalMs = env.rules.workerIntervalSec * 1000;

  timer = setInterval(async () => {
    try {
      const expired = await expireOverdueRequests();
      const escalated = await escalateCriticalRequests();
      if (expired || escalated)
        logger.info(`request worker: expired=${expired} escalated=${escalated}`);
    } catch (err) {
      logger.error('request worker tick failed', err);
    }
  }, intervalMs);
  timer.unref(); // never keep the process alive on its own

  logger.info(`Request lifecycle worker running every ${env.rules.workerIntervalSec}s`);
  return timer;
}

export function stopRequestWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
