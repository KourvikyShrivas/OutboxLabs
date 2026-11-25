const app = require('./app');
const env = require('./config/env');
const redis = require('./config/redis');
const emailQueue = require('./queues/emailQueue');
const { startEmailWorker, stopEmailWorker } = require('./workers/emailWorker');
const { getTransporter } = require('./services/mailService');

if (env.runWorker) {
  startEmailWorker();
}

// Warm up SMTP at startup so the Ethereal inbox login is printed right away.
getTransporter().catch((err) => {
  console.warn(`[mail] SMTP setup failed: ${err.message} (will retry when the first email is sent)`);
});

const server = app.listen(env.port, () => {
  console.log(`[server] API listening on http://localhost:${env.port}`);
});

let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} received, shutting down...`);
  setTimeout(() => process.exit(1), 10000).unref(); // hard stop if something hangs
  try {
    await new Promise((resolve) => server.close(resolve));
    await stopEmailWorker();
    await emailQueue.close();
    await redis.quit();
  } catch (err) {
    console.error('[server] error during shutdown:', err.message);
  }
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
