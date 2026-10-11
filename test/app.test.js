const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/index');

const TOKEN = 'test-token-not-a-secret';

async function withServer(app, fn) {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

function chat(base, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  return fetch(`${base}/api/chat`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

function stubApp(calls = [], opts = {}) {
  return createApp({
    generateText: async (args) => { calls.push(args); return 'stubbed reply'; },
    defaultProvider: 'auto',
    ...opts
  });
}

test.beforeEach(() => { process.env.FRAME9_SERVICE_TOKEN = TOKEN; });
test.after(() => { delete process.env.FRAME9_SERVICE_TOKEN; });

test('modules resolve (regression: Cannot find module ./config)', () => {
  assert.doesNotThrow(() => require('../src/services/aiProvider'));
  assert.equal(typeof require('../src/services/aiProvider').generateText, 'function');
  assert.equal(typeof createApp, 'function');
  assert.doesNotThrow(() => createApp());
});

test('GET /health is public and exposes no config', async () => {
  await withServer(stubApp(), async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { ok: true, service: 'Frame.9 AI gateway' });
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});

test('POST /api/chat fails closed with 503 when FRAME9_SERVICE_TOKEN is unset', async () => {
  delete process.env.FRAME9_SERVICE_TOKEN;
  const calls = [];
  await withServer(stubApp(calls), async (base) => {
    const res = await chat(base, { message: 'hi' }, 'anything');
    assert.equal(res.status, 503);
  });
  assert.equal(calls.length, 0);
});

test('POST /api/chat returns 401 for missing, malformed or wrong token', async () => {
  const calls = [];
  await withServer(stubApp(calls), async (base) => {
    assert.equal((await chat(base, { message: 'hi' })).status, 401);
    assert.equal((await chat(base, { message: 'hi' }, 'wrong')).status, 401);
    assert.equal((await chat(base, { message: 'hi' }, `${TOKEN}x`)).status, 401);
    const basic = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${TOKEN}` },
      body: JSON.stringify({ message: 'hi' })
    });
    assert.equal(basic.status, 401);
  });
  assert.equal(calls.length, 0);
});

test('POST /api/chat returns 400 for invalid payloads', async () => {
  const calls = [];
  await withServer(stubApp(calls), async (base) => {
    for (const body of [
      {},
      { message: '' },
      { message: 42 },
      { message: 'x'.repeat(8001) },
      { message: 'hi', provider: 'evil' },
      { messages: [] },
      { messages: [{ role: 'user', content: 7 }] },
      { messages: [{ role: 'root', content: 'hi' }] },
      { message: 'hi', systemPrompt: 5 },
      '[1,2]',
      '{not json'
    ]) {
      const res = await chat(base, body, TOKEN);
      assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
    }
  });
  assert.equal(calls.length, 0);
});

test('POST /api/chat returns 413 for oversized body', async () => {
  await withServer(stubApp(), async (base) => {
    const res = await chat(base, { message: 'x'.repeat(40 * 1024) }, TOKEN);
    assert.equal(res.status, 413);
  });
});

test('POST /api/chat returns 429 over the per-IP limit', async () => {
  const calls = [];
  await withServer(stubApp(calls, { rateLimit: { windowMs: 60_000, max: 3 } }), async (base) => {
    const statuses = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await chat(base, { message: 'hi' }, TOKEN)).status);
    assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
  });
  assert.equal(calls.length, 3);
});

test('valid token reaches the provider (outbound AI call stubbed)', async () => {
  const calls = [];
  await withServer(stubApp(calls), async (base) => {
    const res = await chat(base, { provider: 'grok', message: 'hello', model: 'grok-2-latest' }, TOKEN);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, provider: 'grok', response: 'stubbed reply' });
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].provider, 'grok');
  assert.equal(calls[0].text, 'hello');
});

test('provider errors are not leaked to the client', async () => {
  const app = createApp({ generateText: async () => { throw new Error('upstream said: key sk-should-not-leak'); } });
  const origError = console.error;
  console.error = () => {};
  try {
    await withServer(app, async (base) => {
      const res = await chat(base, { message: 'hi' }, TOKEN);
      assert.equal(res.status, 502);
      assert.doesNotMatch(await res.text(), /should-not-leak/);
    });
  } finally {
    console.error = origError;
  }
});
