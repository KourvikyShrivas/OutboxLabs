// End-to-end smoke test against a RUNNING backend: npm run smoke
const BASE = process.env.API_URL || 'http://localhost:4000/api';
let failures = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function check(name, condition, extra = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${extra ? ` - ${extra}` : ''}`);
  if (!condition) failures += 1;
}

(async () => {
  console.log(`Testing ${BASE}\n`);

  const health = await call('GET', '/health');
  check('health check is 200 with redis up', health.status === 200 && health.json?.redis === 'up');

  const bad = await call('POST', '/emails', { to: 'not-an-email', subject: '', scheduledAt: 'yesterday' });
  check('invalid payload is rejected with 400', bad.status === 400 && bad.json?.error === 'VALIDATION_ERROR');

  const created = await call('POST', '/emails', {
    to: 'smoke-test@example.com',
    subject: 'Smoke test',
    body: 'Hello from the ReachInbox smoke test.',
    scheduledAt: new Date(Date.now() + 5000).toISOString(),
  });
  const jobId = created.json?.data?.id;
  check('schedule email returns 201 with status "scheduled"', created.status === 201 && created.json?.data?.status === 'scheduled', jobId);

  const later = await call('POST', '/emails', {
    to: 'cancel-me@example.com',
    subject: 'To be cancelled',
    body: 'You should never receive this.',
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  const cancelId = later.json?.data?.id;
  check('schedule second email (1 hour ahead)', later.status === 201 && Boolean(cancelId));

  const cancelled = await call('DELETE', `/emails/${cancelId}`);
  check('cancel returns 200 with status "cancelled"', cancelled.status === 200 && cancelled.json?.data?.status === 'cancelled');

  const inspectCancelled = await call('GET', `/emails/${cancelId}`);
  check('inspect cancelled email shows "cancelled"', inspectCancelled.json?.data?.status === 'cancelled');

  const cancelAgain = await call('DELETE', `/emails/${cancelId}`);
  check('cancelling twice returns 409', cancelAgain.status === 409);

  const missing = await call('GET', '/emails/00000000-0000-4000-8000-000000000000');
  check('unknown id returns 404', missing.status === 404);

  const list = await call('GET', '/emails');
  const ids = (list.json?.data || []).map((j) => j.id);
  check('list contains both emails', ids.includes(jobId) && ids.includes(cancelId), `${ids.length} total`);

  console.log('\nWaiting up to 60s for the 5-second email to be sent by the worker...');
  let final = null;
  for (let i = 0; i < 30; i += 1) {
    await sleep(2000);
    const res = await call('GET', `/emails/${jobId}`);
    final = res.json?.data;
    if (final && ['completed', 'failed'].includes(final.status)) break;
  }
  check('scheduled email reached "completed"', final?.status === 'completed', final?.status);
  if (final?.previewUrl) console.log(`\nEthereal preview: ${final.previewUrl}`);
  if (final?.failedReason) console.log(`Failure reason: ${final.failedReason}`);

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error('Smoke test crashed:', err.message);
  console.error('Is the backend running on', BASE, '?');
  process.exit(1);
});
