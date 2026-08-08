import http from 'http';
import { createApp } from './app.js';
import { env, validateEnv } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { initRedis } from './config/redis.js';
import { initMailer } from './config/mailer.js';
import { initFcm } from './config/fcm.js';
import { initR2 } from './config/r2.js';
import { initSms } from './config/sms.js';
import { initSocket } from './realtime/io.js';
import { startRequestWorker, stopRequestWorker } from './workers/request.worker.js';
import { startRetentionWorker, stopRetentionWorker } from './workers/retention.worker.js';
import { ensureAdmins } from './services/bootstrap.service.js';
import { logger } from './utils/logger.js';

async function start() {
  validateEnv(); // fail fast if required vars are missing
  await connectDB();

  // Promote any configured first admins. Never fatal: a bootstrap problem must
  // not stop the API from serving donors and requests.
  await ensureAdmins().catch((err) => logger.error('admin bootstrap failed', err));
  await initRedis();
  await initMailer();
  await initFcm();
  await initR2();
  await initSms();

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);
  startRequestWorker();
  startRetentionWorker();

  server.listen(env.port, () => {
    logger.info(`VeinReach API listening on http://localhost:${env.port}`);
    logger.info(`Environment: ${env.nodeEnv}`);
  });

  const shutdown = async (signal) => {
    logger.warn(`${signal} received — shutting down`);
    stopRequestWorker();
    stopRetentionWorker();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force-exit if graceful close hangs.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  ['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));
}

start().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
