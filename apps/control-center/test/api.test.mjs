import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../server/app.mjs';
import { createSessionStore, hashPassword, localAuthenticator } from '../server/auth.mjs';
import { GitHubError } from '../server/github.mjs';
import { DB_URL, freshDb, makeUser, makeOrg, addMember } from './helpers.mjs';

const PW = 'correct-horse-battery-staple';
const SHA = 'd'.repeat(40);

describe.skipIf(!DB_URL)('Control Center API vertical slice: auth → GitHub → snapshot → audit', () => {
  let db, server, base, orgA, orgB, ghMode = 'ok';
  const github = {
    async fetchRepoState(repo) {
      if (ghMode === 'ratelimit') throw new GitHubError('GITHUB_RATE_LIMITED', 403, 'API rate limit exceeded', { remaining: 0, resetAt: null });
      return { repo, fetchStatus: 'OK', defaultBranch: 'main', headSha: SHA, branches: [{ name: 'main', sha: SHA }],
        commits: [{ sha: SHA, message: 'm' }], ci: { state: 'SUCCESS', checkRuns: [], error: null }, rateLimit: { remaining: 42 } };
    },
  };

  beforeAll(async () => {
    db = await freshDb();
    const { pool } = db;
    orgA = await makeOrg(pool, 'A'); orgB = await makeOrg(pool, 'B');
    for (const [email, org, role] of [['op@t.local', orgA, 'OPERATOR'], ['viewer@t.local', orgA, 'VIEWER'], ['aud@t.local', orgA, 'AUDITOR'], ['b@t.local', orgB, 'OWNER']]) {
      const id = await makeUser(pool, email);
      await pool.query('insert into app_private.local_credentials values ($1, $2)', [id, await hashPassword(PW)]);
      await addMember(pool, org, id, role);
    }
    const app = createApp({ pool, sessions: createSessionStore(), authenticate: localAuthenticator(pool), github,
      repo: '3XTRINITY-CORPORATION/Frame.-9', loginLimit: 50, snapshotLimit: 2 });
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(async () => { server?.close(); await db?.drop(); });

  const call = (path, { token, method = 'GET', body } = {}) => fetch(base + path, {
    method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const login = async (email) => (await (await call('/api/auth/login', { method: 'POST', body: { email, password: PW } })).json()).token;

  it('rejects wrong password and unknown user with 401', async () => {
    expect((await call('/api/auth/login', { method: 'POST', body: { email: 'op@t.local', password: 'wrong-password-123' } })).status).toBe(401);
    expect((await call('/api/auth/login', { method: 'POST', body: { email: 'nobody@t.local', password: PW } })).status).toBe(401);
  });

  it('rejects unauthenticated and forged tokens with 401', async () => {
    expect((await call('/api/me')).status).toBe(401);
    expect((await call('/api/me', { token: 'x'.repeat(43) })).status).toBe(401);
    expect((await call(`/api/orgs/${orgA}/snapshots`, { method: 'POST' })).status).toBe(401);
  });

  it('OPERATOR creates a snapshot; it persists with an audit SUCCESS event', async () => {
    const t = await login('op@t.local');
    const me = await (await call('/api/me', { token: t })).json();
    expect(me.orgs.map((o) => o.id)).toEqual([orgA]);
    const res = await call(`/api/orgs/${orgA}/snapshots`, { token: t, method: 'POST' });
    expect(res.status).toBe(201);
    const { snapshot } = await res.json();
    expect(snapshot).toMatchObject({ fetch_status: 'OK', head_sha: SHA, rate_limit_remaining: 42 });
    const latest = await (await call(`/api/orgs/${orgA}/snapshots/latest`, { token: t })).json();
    expect(latest.snapshot.id).toBe(snapshot.id);
    const aud = await (await call(`/api/orgs/${orgA}/audit`, { token: await login('aud@t.local') })).json();
    expect(aud.events[0]).toMatchObject({ action: 'repo.snapshot', outcome: 'SUCCESS' });
  });

  it('GitHub rate limit is persisted and shown as a real error (502), audited as FAILURE', async () => {
    ghMode = 'ratelimit';
    const res = await call(`/api/orgs/${orgA}/snapshots`, { token: await login('op@t.local'), method: 'POST' });
    ghMode = 'ok';
    expect(res.status).toBe(502);
    const { snapshot } = await res.json();
    expect(snapshot).toMatchObject({ fetch_status: 'ERROR', branches: [], commits: [], error: { code: 'GITHUB_RATE_LIMITED' } });
    const aud = await (await call(`/api/orgs/${orgA}/audit`, { token: await login('aud@t.local') })).json();
    expect(aud.events[0]).toMatchObject({ outcome: 'FAILURE', detail: { error: 'GITHUB_RATE_LIMITED' } });
  });

  it('VIEWER is denied snapshot (403) and the denial is audited; VIEWER cannot read audit', async () => {
    const t = await login('viewer@t.local');
    expect((await call(`/api/orgs/${orgA}/snapshots`, { token: t, method: 'POST' })).status).toBe(403);
    expect((await call(`/api/orgs/${orgA}/audit`, { token: t })).status).toBe(403);
    const aud = await (await call(`/api/orgs/${orgA}/audit`, { token: await login('aud@t.local') })).json();
    expect(aud.events[0]).toMatchObject({ outcome: 'DENIED' });
  });

  it('cross-tenant access returns 404 and leaks nothing', async () => {
    const t = await login('b@t.local');
    expect((await call(`/api/orgs/${orgA}/snapshots/latest`, { token: t })).status).toBe(404);
    expect((await call(`/api/orgs/${orgA}/snapshots`, { token: t, method: 'POST' })).status).toBe(404);
    expect((await call(`/api/orgs/${orgA}/audit`, { token: t })).status).toBe(404);
    expect((await (await call(`/api/orgs/${orgB}/snapshots/latest`, { token: t })).json()).snapshot).toBeNull();
  });

  it('snapshot creation is rate-limited per user (GitHub quota protection)', async () => {
    // op@ already created 2 snapshots above; limit is 2/min.
    const res = await call(`/api/orgs/${orgA}/snapshots`, { token: await login('op@t.local'), method: 'POST' });
    expect(res.status).toBe(429);
  });

  it('logout invalidates the session', async () => {
    const t = await login('op@t.local');
    expect((await call('/api/auth/logout', { token: t, method: 'POST' })).status).toBe(204);
    expect((await call('/api/me', { token: t })).status).toBe(401);
  });

  it('rejects oversized and malformed bodies without leaking internals', async () => {
    const big = await call('/api/auth/login', { method: 'POST', body: { email: 'a', password: 'x'.repeat(20000) } });
    expect(big.status).toBe(413);
    const bad = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    expect(bad.status).toBe(400);
    expect((await call('/api/orgs/not-a-uuid/audit', { token: await login('aud@t.local') })).status).toBe(400);
  });
});

describe('login rate limit (no DB needed)', () => {
  it('returns 429 after the limit', async () => {
    const app = createApp({ pool: null, sessions: createSessionStore(), authenticate: async () => null, github: {}, repo: 'o/r', loginLimit: 2 });
    const s = app.listen(0); await new Promise((r) => s.once('listening', r));
    const u = `http://127.0.0.1:${s.address().port}/api/auth/login`;
    const post = () => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"email":"a@b","password":"p"}' });
    const codes = [(await post()).status, (await post()).status, (await post()).status];
    s.close();
    expect(codes).toEqual([401, 401, 429]);
  });

  it('every /api route has a per-IP ceiling', async () => {
    const app = createApp({ pool: null, sessions: createSessionStore(), authenticate: async () => null, github: {}, repo: 'o/r', apiLimit: 2 });
    const s = app.listen(0); await new Promise((r) => s.once('listening', r));
    const u = `http://127.0.0.1:${s.address().port}/api/health`;
    const codes = [(await fetch(u)).status, (await fetch(u)).status, (await fetch(u)).status];
    s.close();
    expect(codes).toEqual([200, 200, 429]);
  });
});
