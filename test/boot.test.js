const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

// Ensure no real provider keys leak into tests.
delete process.env.OPENAI_API_KEY;
delete process.env.XAI_API_KEY;
const TOKEN = 'boot-test-service-token-0123456789abcdef';
process.env.FRAME9_SERVICE_TOKEN = TOKEN;
const auth = { authorization: `Bearer ${TOKEN}` };

test('src/config.js exists and exposes provider config', () => {
  const config = require('../src/config');
  assert.equal(typeof config.port, 'number');
  assert.equal(config.xai.baseUrl, process.env.XAI_BASE_URL || 'https://api.x.ai/v1');
  assert.ok(config.openai.model);
});

test('multiModelRouter parses and reports no providers without keys', () => {
  const router = require('../src/services/multiModelRouter');
  assert.deepEqual(router.getAvailableProviders(), []);
  assert.throws(() => router.selectProvider({}), /No AI providers configured/);
});

async function withServer(fn) {
  const app = require('../src/server');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}

test('app boots: GET / and GET /ai/health respond 200', async () => {
  await withServer(async (base) => {
    const root = await fetch(`${base}/`);
    assert.equal(root.status, 200);
    assert.equal((await root.json()).name, 'Frame.9 AI Gateway');
    const health = await fetch(`${base}/ai/health`, { headers: auth });
    assert.equal(health.status, 200);
    const body = await health.json();
    assert.equal(body.ok, true);
    assert.deepEqual(body.providers, []);
  });
});

test('POST /ai/chat without message is rejected with 400', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/ai/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...auth }, body: '{}'
    });
    assert.equal(res.status, 400);
  });
});

test('npm start entrypoint boots and listens', async () => {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'server.js')], {
    env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  const ok = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), 5000);
    child.stdout.on('data', (d) => { out += d; if (out.includes('Frame.9 AI Gateway started')) { clearTimeout(t); resolve(true); } });
    child.on('exit', () => { clearTimeout(t); resolve(false); });
  });
  child.kill();
  assert.ok(ok, `server did not start: ${out}`);
});
