const test = require('node:test');
const assert = require('node:assert/strict');

// Request logging writes to stdout, which can corrupt the node:test IPC stream.
console.log = () => {};
delete process.env.OPENAI_API_KEY;
delete process.env.XAI_API_KEY;
const TOKEN = 'test-service-token-' + 'x'.repeat(24);

const { createApp } = require('../src/server');

async function withApp(opts, fn) {
  const server = createApp(opts).listen(0);
  await new Promise((r) => server.once('listening', r));
  try { return await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}
const post = (url, body, headers = {}) => fetch(url, {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body)
});
const auth = { authorization: `Bearer ${TOKEN}` };

test.beforeEach(() => { process.env.FRAME9_SERVICE_TOKEN = TOKEN; });
test.after(() => { delete process.env.FRAME9_SERVICE_TOKEN; });

test('fail closed: /ai/* returns 503 when FRAME9_SERVICE_TOKEN is unset, even with a bearer', async () => {
  delete process.env.FRAME9_SERVICE_TOKEN;
  await withApp({}, async (base) => {
    for (const [method, path] of [['GET', '/ai/health'], ['GET', '/ai/providers'], ['POST', '/ai/chat'], ['POST', '/ai/grok'], ['POST', '/ai/chatgpt'], ['POST', '/ai/compare']]) {
      const res = await fetch(base + path, { method, headers: { ...auth, 'content-type': 'application/json' }, body: method === 'POST' ? '{"message":"hi"}' : undefined });
      assert.equal(res.status, 503, `${method} ${path}`);
    }
  });
});

test('unauthenticated, malformed and wrong tokens get 401 on every /ai route', async () => {
  await withApp({}, async (base) => {
    for (const headers of [{}, { authorization: TOKEN }, { authorization: 'Basic abc' }, { authorization: 'Bearer wrong' }, { authorization: `Bearer ${TOKEN}x` }]) {
      for (const path of ['/ai/chat', '/ai/grok', '/ai/chatgpt', '/ai/compare']) {
        assert.equal((await post(base + path, { message: 'hi' }, headers)).status, 401, `${path} ${JSON.stringify(headers)}`);
      }
      assert.equal((await fetch(`${base}/ai/health`, { headers })).status, 401);
    }
  });
});

test('valid token passes auth (no provider configured -> 500 from provider layer, not 401/503)', async () => {
  await withApp({}, async (base) => {
    assert.equal((await fetch(`${base}/ai/health`, { headers: auth })).status, 200);
    assert.equal((await fetch(`${base}/ai/providers`, { headers: auth })).status, 200);
    const res = await post(`${base}/ai/chat`, { message: 'hi' }, auth);
    assert.ok(![401, 403, 503].includes(res.status), `got ${res.status}`);
  });
});

test('root endpoint stays public', async () => {
  await withApp({}, async (base) => assert.equal((await fetch(`${base}/`)).status, 200));
});

test('body over 32kb is rejected with 413', async () => {
  await withApp({}, async (base) => {
    const res = await post(`${base}/ai/chat`, { message: 'a'.repeat(40 * 1024) }, auth);
    assert.equal(res.status, 413);
  });
});

test('unauthenticated oversize body is rejected with 401 before parsing', async () => {
  await withApp({}, async (base) => {
    assert.equal((await post(`${base}/ai/chat`, { message: 'a'.repeat(40 * 1024) })).status, 401);
  });
});

test('per-IP rate limit returns 429 with Retry-After', async () => {
  await withApp({ aiRateLimitMax: 3 }, async (base) => {
    const codes = [];
    let last;
    for (let i = 0; i < 4; i++) { last = await fetch(`${base}/ai/health`, { headers: auth }); codes.push(last.status); }
    assert.deepEqual(codes, [200, 200, 200, 429]);
    assert.ok(Number(last.headers.get('retry-after')) > 0, 'Retry-After header');
  });
});

test('rate limit also counts unauthenticated attempts (brute-force guard)', async () => {
  await withApp({ aiRateLimitMax: 2 }, async (base) => {
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await fetch(`${base}/ai/health`)).status);
    assert.deepEqual(codes, [401, 401, 429]);
  });
});

test('input validation rejects bad bodies with 400', async () => {
  await withApp({}, async (base) => {
    const bad = [
      {},
      { message: '' },
      { message: 123 },
      { message: 'x'.repeat(8001) },
      { message: 'hi', provider: 'claude' },
      { messages: [] },
      { messages: [{ role: 'root', content: 'x' }] },
      { messages: Array.from({ length: 51 }, () => ({ role: 'user', content: 'x' })) },
      { message: 'hi', temperature: 5 },
      { message: 'hi', maxTokens: 1e9 },
      { message: 'hi', model: 'm'.repeat(101) },
      { message: 'hi', systemPrompt: 's'.repeat(4001) },
      [1, 2],
    ];
    for (const body of bad) {
      const res = await post(`${base}/ai/chat`, body, auth);
      assert.equal(res.status, 400, JSON.stringify(body).slice(0, 80));
    }
    assert.equal((await post(`${base}/ai/grok`, { message: '' }, auth)).status, 400);
    assert.equal((await post(`${base}/ai/compare`, { message: 7 }, auth)).status, 400);
    assert.equal((await post(`${base}/ai/chat`, '{bad json', auth)).status, 400);
  });
});

test('errors do not leak internals', async () => {
  await withApp({}, async (base) => {
    const res = await post(`${base}/ai/chat`, '{bad json', auth);
    const body = await res.json();
    assert.equal(body.message, undefined);
    assert.ok(!JSON.stringify(body).includes('SyntaxError'));
  });
});
