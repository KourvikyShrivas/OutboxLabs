const { randomUUID } = require('crypto');
const emailQueue = require('../queues/emailQueue');
const redis = require('../config/redis');
const env = require('../config/env');
const AppError = require('../utils/AppError');

// BullMQ removes a cancelled job, so we keep a small snapshot in a Redis hash
// to be able to show the "cancelled" status afterwards (also survives restarts).
const CANCELLED_KEY = `reachinbox:${env.queue.name}:cancelled`;

const BULL_STATES = ['delayed', 'waiting', 'prioritized', 'active', 'completed', 'failed'];
const STATUSES = ['scheduled', 'retrying', 'waiting', 'active', 'completed', 'failed', 'cancelled'];
const CANCELLABLE_STATES = ['delayed', 'waiting', 'prioritized'];
const LIST_LIMIT_PER_STATE = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertRedisReady() {
  if (redis.status !== 'ready') {
    throw new AppError(503, 'REDIS_UNAVAILABLE', 'Redis is not reachable. Start it with: docker compose up -d');
  }
}

function assertValidId(id) {
  // Prevents using arbitrary strings as Redis key suffixes.
  if (!UUID_RE.test(id)) throw new AppError(404, 'NOT_FOUND', 'Scheduled email not found');
}

// BullMQ state -> status shown to API clients
function toStatus(state, job) {
  switch (state) {
    case 'delayed':
      return job.attemptsMade > 0 ? 'retrying' : 'scheduled'; // delayed after a failed attempt = waiting for backoff
    case 'waiting':
    case 'prioritized':
    case 'paused':
    case 'waiting-children':
      return 'waiting';
    case 'active':
    case 'completed':
    case 'failed':
      return state;
    default:
      return 'waiting';
  }
}

const iso = (ms) => (ms ? new Date(ms).toISOString() : null);

function serialize(job, state, { includeBody = false } = {}) {
  const out = {
    id: job.id,
    to: job.data.to,
    subject: job.data.subject,
    scheduledAt: job.data.scheduledAt,
    status: toStatus(state, job),
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts || 1,
    createdAt: iso(job.timestamp),
    processedAt: iso(job.processedOn),
    finishedAt: iso(job.finishedOn),
    failedReason: job.failedReason || null,
    messageId: job.returnvalue?.messageId || null,
    previewUrl: job.returnvalue?.previewUrl || null,
  };
  if (includeBody) out.body = job.data.body;
  return out;
}

async function scheduleEmail({ to, subject, body, scheduledAt, attempts, backoffDelayMs }) {
  assertRedisReady();

  const when = new Date(scheduledAt);
  const delay = Math.max(0, when.getTime() - Date.now());

  const job = await emailQueue.add(
    'send-email',
    { to, subject, body, scheduledAt: when.toISOString() },
    {
      jobId: randomUUID(),
      delay,
      attempts: attempts ?? env.queue.attempts,
      backoff: { type: 'exponential', delay: backoffDelayMs ?? env.queue.backoffDelayMs },
    }
  );

  const state = await job.getState();
  return serialize(job, state, { includeBody: true });
}

async function getCancelledJobs() {
  const all = await redis.hgetall(CANCELLED_KEY);
  return Object.values(all).map((v) => JSON.parse(v));
}

async function listEmails({ status } = {}) {
  if (status && !STATUSES.includes(status)) {
    throw new AppError(400, 'INVALID_STATUS', `status must be one of: ${STATUSES.join(', ')}`);
  }
  assertRedisReady();

  const [perState, cancelled] = await Promise.all([
    Promise.all(
      BULL_STATES.map(async (state) => {
        const jobs = await emailQueue.getJobs([state], 0, LIST_LIMIT_PER_STATE - 1, false);
        return jobs.filter(Boolean).map((job) => serialize(job, state));
      })
    ),
    getCancelledJobs(),
  ]);

  const byId = new Map();
  perState.flat().forEach((j) => byId.set(j.id, j));
  cancelled.forEach((c) => {
    const { body, ...rest } = c; // list view omits the body
    if (!byId.has(rest.id)) byId.set(rest.id, rest);
  });

  let jobs = [...byId.values()];
  if (status) jobs = jobs.filter((j) => j.status === status);
  jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return jobs;
}

async function getEmail(id) {
  assertValidId(id);
  assertRedisReady();

  const job = await emailQueue.getJob(id);
  if (job) {
    const state = await job.getState();
    return serialize(job, state, { includeBody: true });
  }

  const cancelled = await redis.hget(CANCELLED_KEY, id);
  if (cancelled) return JSON.parse(cancelled);

  throw new AppError(404, 'NOT_FOUND', 'Scheduled email not found');
}

async function cancelEmail(id) {
  assertValidId(id);
  assertRedisReady();

  const job = await emailQueue.getJob(id);
  if (!job) {
    if (await redis.hexists(CANCELLED_KEY, id)) {
      throw new AppError(409, 'ALREADY_CANCELLED', 'This email was already cancelled');
    }
    throw new AppError(404, 'NOT_FOUND', 'Scheduled email not found');
  }

  const state = await job.getState();
  if (!CANCELLABLE_STATES.includes(state)) {
    throw new AppError(409, 'NOT_CANCELLABLE', `Email is already ${toStatus(state, job)} and can no longer be cancelled`);
  }

  const snapshot = {
    ...serialize(job, state, { includeBody: true }),
    status: 'cancelled',
    finishedAt: new Date().toISOString(),
  };

  // Write the snapshot first so the job never "disappears" between the two steps.
  await redis.hset(CANCELLED_KEY, id, JSON.stringify(snapshot));
  try {
    await job.remove();
  } catch (err) {
    await redis.hdel(CANCELLED_KEY, id);
    throw new AppError(409, 'NOT_CANCELLABLE', 'Email is being processed right now and could not be cancelled');
  }

  return snapshot;
}

module.exports = { scheduleEmail, listEmails, getEmail, cancelEmail, STATUSES };
