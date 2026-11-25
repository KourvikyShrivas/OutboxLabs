const { Queue } = require('bullmq');
const env = require('../config/env');
const redis = require('../config/redis');

// Delayed jobs live in Redis, so they survive backend restarts.
// No cron anywhere: BullMQ moves each job to "waiting" when its delay expires.
const emailQueue = new Queue(env.queue.name, {
  connection: redis,
  defaultJobOptions: {
    attempts: env.queue.attempts,
    backoff: { type: 'exponential', delay: env.queue.backoffDelayMs },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 },
  },
});

emailQueue.on('error', (err) => console.error('[queue] error:', err.message));

module.exports = emailQueue;
