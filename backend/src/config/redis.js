const IORedis = require('ioredis');
const env = require('./env');

// One shared connection. BullMQ Workers REQUIRE maxRetriesPerRequest: null.
const redis = new IORedis({
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

let lastErrorLog = 0;
redis.on('error', (err) => {
  // Throttle: ioredis emits this on every reconnect attempt.
  const now = Date.now();
  if (now - lastErrorLog > 5000) {
    lastErrorLog = now;
    console.error(`[redis] ${err.message || err.code} (is Redis running? try: docker compose up -d)`);
  }
});
redis.on('ready', () => console.log(`[redis] connected to ${env.redis.host}:${env.redis.port}`));

module.exports = redis;
