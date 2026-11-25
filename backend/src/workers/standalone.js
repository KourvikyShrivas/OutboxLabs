// Optional: run the worker as its own process (npm run worker).
// Use together with RUN_WORKER=false for the API process.
const redis = require('../config/redis');
const { startEmailWorker, stopEmailWorker } = require('./emailWorker');
const { getTransporter } = require('../services/mailService');

startEmailWorker();
getTransporter().catch((err) => console.warn('[mail] SMTP setup failed (will retry on first job):', err.message));

const shutdown = async (signal) => {
  console.log(`[worker] ${signal} received, shutting down...`);
  await stopEmailWorker();
  await redis.quit();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
