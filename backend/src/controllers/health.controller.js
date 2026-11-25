const asyncHandler = require('../utils/asyncHandler');
const redis = require('../config/redis');
const emailQueue = require('../queues/emailQueue');
const { isWorkerRunning } = require('../workers/emailWorker');

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

const getHealth = asyncHandler(async (req, res) => {
  let redisStatus = 'down';
  let queue = null;

  if (redis.status === 'ready') {
    try {
      const pong = await withTimeout(redis.ping(), 2000);
      if (pong === 'PONG') {
        redisStatus = 'up';
        queue = await withTimeout(
          emailQueue.getJobCounts('delayed', 'waiting', 'active', 'completed', 'failed'),
          2000
        );
      }
    } catch (err) {
      redisStatus = 'down';
    }
  }

  const ok = redisStatus === 'up';
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    service: 'reachinbox-backend',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    redis: redisStatus,
    worker: isWorkerRunning() ? 'running' : 'not running in this process',
    queue,
  });
});

module.exports = { getHealth };
