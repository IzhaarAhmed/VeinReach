import { runRetentionSweep } from '../services/retention.service.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Data-retention worker. Same shape as the request lifecycle worker: a plain
 * interval, which is right at this scale and should become a proper scheduled
 * job once the API runs on more than one instance (today every instance would
 * sweep independently — harmless, since deletes are idempotent, but wasteful).
 *
 * Note the free-tier caveat from DEPLOY.md: Render stops the container after
 * ~15 minutes idle, so on the free plan this only runs while the API happens to
 * be awake. A keep-alive ping fixes that, and it is the reason to want one.
 */
let timer = null;

export function startRetentionWorker() {
  if (timer) return timer;
  if (!env.retention.enabled) {
    logger.warn('Retention worker disabled (RETENTION_ENABLED=false) — nothing will age out');
    return null;
  }

  const intervalMs = Math.max(1, env.retention.sweepIntervalHours) * 60 * 60 * 1000;

  const tick = async () => {
    try {
      const s = await runRetentionSweep();
      const total = s.messages + s.notifications + s.auditLogs + s.requests;
      if (total > 0) logger.info(`retention sweep: ${JSON.stringify(s)}`);
    } catch (err) {
      logger.error('retention sweep tick failed', err);
    }
  };

  // Run once shortly after boot rather than waiting a full interval — on a host
  // that restarts often, a 24h timer might otherwise never fire at all.
  const kickoff = setTimeout(tick, 60 * 1000);
  kickoff.unref();

  timer = setInterval(tick, intervalMs);
  timer.unref(); // never keep the process alive on its own

  const { messagesDays, notificationsDays, auditDays, requestsDays } = env.retention;
  logger.info(
    `Retention worker running every ${env.retention.sweepIntervalHours}h ` +
      `(messages ${messagesDays}d, notifications ${notificationsDays}d, ` +
      `audit ${auditDays}d, requests ${requestsDays}d)`
  );
  return timer;
}

export function stopRetentionWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
