const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const toInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 4000),
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  runWorker: process.env.RUN_WORKER !== 'false',

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: toInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  queue: {
    name: process.env.QUEUE_NAME || 'email-scheduler',
    attempts: toInt(process.env.JOB_ATTEMPTS, 3),
    backoffDelayMs: toInt(process.env.JOB_BACKOFF_DELAY_MS, 5000),
    workerConcurrency: toInt(process.env.WORKER_CONCURRENCY, 5),
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: toInt(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'ReachInbox <no-reply@reachinbox.local>',
  },
};

module.exports = env;
