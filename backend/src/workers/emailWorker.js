const { Worker } = require('bullmq');
const env = require('../config/env');
const redis = require('../config/redis');
const { sendMail } = require('../services/mailService');

let worker = null;

function startEmailWorker() {
  if (worker) return worker;

  worker = new Worker(
    env.queue.name,
    async (job) => {
      const { to, subject, body } = job.data;
      // If this throws, BullMQ retries according to the job's attempts/backoff options.
      const result = await sendMail({ to, subject, body });
      return { ...result, sentAt: new Date().toISOString() };
    },
    { connection: redis, concurrency: env.queue.workerConcurrency }
  );

  worker.on('active', (job) => {
    console.log(`[worker] job ${job.id} started (attempt ${job.attemptsMade + 1}/${job.opts.attempts}) -> ${job.data.to}`);
  });

  worker.on('completed', (job, result) => {
    console.log(`[worker] job ${job.id} sent. Preview: ${result.previewUrl || 'n/a'}`);
  });

  worker.on('failed', (job, err) => {
    if (!job) {
      console.error('[worker] failure:', err.message);
      return;
    }
    const willRetry = job.attemptsMade < (job.opts.attempts || 1);
    console.error(
      `[worker] job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${err.message}` +
        (willRetry ? ' -> will retry with backoff' : ' -> giving up')
    );
  });

  worker.on('error', (err) => console.error('[worker] error:', err.message));

  console.log(`[worker] started (queue="${env.queue.name}", concurrency=${env.queue.workerConcurrency})`);
  return worker;
}

const isWorkerRunning = () => Boolean(worker && worker.isRunning());

const stopEmailWorker = async () => {
  if (worker) await worker.close();
};

module.exports = { startEmailWorker, stopEmailWorker, isWorkerRunning };
