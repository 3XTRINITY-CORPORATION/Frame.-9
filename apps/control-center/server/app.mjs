import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { withUser } from './db.mjs';
import { GitHubError } from './github.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WRITE_ROLES = ['OWNER', 'ADMIN', 'OPERATOR'];
const AUDIT_ROLES = ['OWNER', 'ADMIN', 'AUDITOR'];

/**
 * @param {{ pool: import('pg').Pool, sessions: ReturnType<import('./auth.mjs').createSessionStore>,
 *   authenticate: (email: string, password: string) => Promise<{id: string, email: string} | null>,
 *   github: { fetchRepoState: (repo: string) => Promise<any> }, repo: string,
 *   corsOrigins?: string[], loginLimit?: number, apiLimit?: number, snapshotLimit?: number }} deps
 */
export function createApp({ pool, sessions, authenticate, github, repo, corsOrigins = [], loginLimit = 10, apiLimit = 300, snapshotLimit = 10 }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  const limiter = (limit, keyGenerator) => rateLimit({
    windowMs: 60_000, limit, standardHeaders: 'draft-8', legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (_req, res) => res.status(429).json({ error: 'RATE_LIMITED' }),
  });
  // Per-IP ceiling on every API route, stricter on login; per-session on
  // snapshot creation (each one costs GitHub API quota).
  const apiLimiter = limiter(apiLimit);
  const loginLimiter = limiter(loginLimit);
  const snapshotLimiter = limiter(snapshotLimit, (req) => `user:${req.user.id}`);

  app.use((req, res, next) => {
    res.set('cache-control', 'no-store');
    res.set('x-content-type-options', 'nosniff');
    const origin = req.get('origin');
    if (origin && corsOrigins.includes(origin)) {
      res.set('access-control-allow-origin', origin);
      res.set('vary', 'Origin');
      res.set('access-control-allow-headers', 'authorization, content-type');
      res.set('access-control-allow-methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use('/api', apiLimiter);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.post('/api/auth/login', loginLimiter, async (req, res, next) => {
    try {
      const { email, password } = req.body ?? {};
      if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 1024) {
        return res.status(400).json({ error: 'INVALID_INPUT' });
      }
      const user = await authenticate(email.trim(), password);
      if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
      const token = sessions.create(user);
      res.json({ token, user: { id: user.id, email: user.email } });
    } catch (err) { next(err); }
  });

  function requireAuth(req, res, next) {
    const m = /^Bearer (.+)$/.exec(req.get('authorization') ?? '');
    const user = m ? sessions.get(m[1]) : null;
    if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    req.user = user;
    req.sessionToken = m[1];
    next();
  }

  function requireOrg(req, res, next) {
    if (!UUID_RE.test(req.params.orgId)) return res.status(400).json({ error: 'INVALID_ORG' });
    next();
  }

  async function roleIn(client, orgId) {
    const { rows } = await client.query(
      'select role from public.organization_members where org_id = $1 and user_id = auth.uid()', [orgId]);
    return rows[0]?.role ?? null;
  }

  app.post('/api/auth/logout', requireAuth, (req, res) => {
    sessions.destroy(req.sessionToken);
    res.status(204).end();
  });

  app.get('/api/me', requireAuth, async (req, res, next) => {
    try {
      const orgs = await withUser(pool, req.user.id, async (c) => (await c.query(
        `select o.id, o.name, m.role from public.organizations o
         join public.organization_members m on m.org_id = o.id and m.user_id = auth.uid()
         order by o.name`)).rows);
      res.json({ user: { id: req.user.id, email: req.user.email }, orgs, repo });
    } catch (err) { next(err); }
  });

  app.get('/api/orgs/:orgId/snapshots/latest', requireAuth, requireOrg, async (req, res, next) => {
    try {
      const out = await withUser(pool, req.user.id, async (c) => {
        const role = await roleIn(c, req.params.orgId);
        if (!role) return null;
        const { rows } = await c.query(
          `select id, repo, fetch_status, default_branch, head_sha, branches, commits, ci, error,
                  rate_limit_remaining, fetched_by, fetched_at
           from public.repo_snapshots where org_id = $1 order by fetched_at desc limit 1`, [req.params.orgId]);
        return { snapshot: rows[0] ?? null };
      });
      if (!out) return res.status(404).json({ error: 'ORG_NOT_FOUND' });
      res.json(out);
    } catch (err) { next(err); }
  });

  app.post('/api/orgs/:orgId/snapshots', requireAuth, snapshotLimiter, requireOrg, async (req, res, next) => {
    const orgId = req.params.orgId;
    try {
      const role = await withUser(pool, req.user.id, (c) => roleIn(c, orgId));
      if (!role) return res.status(404).json({ error: 'ORG_NOT_FOUND' });
      if (!WRITE_ROLES.includes(role)) {
        await withUser(pool, req.user.id, (c) => c.query(
          `insert into public.audit_events(org_id, actor_id, action, target, outcome, detail)
           values ($1, auth.uid(), 'repo.snapshot', $2, 'DENIED', $3)`, [orgId, repo, { role }]));
        return res.status(403).json({ error: 'FORBIDDEN', role });
      }
      let state, error = null;
      try {
        state = await github.fetchRepoState(repo);
      } catch (err) {
        if (!(err instanceof GitHubError)) throw err;
        error = err.toJSON();
      }
      const snapshot = await withUser(pool, req.user.id, async (c) => {
        const { rows } = await c.query(
          `insert into public.repo_snapshots(org_id, repo, fetch_status, default_branch, head_sha, branches, commits, ci, error, rate_limit_remaining, fetched_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, auth.uid())
           returning id, repo, fetch_status, default_branch, head_sha, branches, commits, ci, error, rate_limit_remaining, fetched_by, fetched_at`,
          [orgId, repo, error ? 'ERROR' : state.fetchStatus, state?.defaultBranch ?? null, state?.headSha ?? null,
            JSON.stringify(state?.branches ?? []), JSON.stringify(state?.commits ?? []), JSON.stringify(state?.ci ?? {}),
            error ? JSON.stringify(error) : (state.ci?.error ? JSON.stringify(state.ci.error) : null),
            (error?.rateLimit ?? state?.rateLimit)?.remaining ?? null]);
        await c.query(
          `insert into public.audit_events(org_id, actor_id, action, target, outcome, detail)
           values ($1, auth.uid(), 'repo.snapshot', $2, $3, $4)`,
          [orgId, repo, error ? 'FAILURE' : 'SUCCESS', { snapshotId: rows[0].id, fetchStatus: rows[0].fetch_status, error: error?.code ?? null }]);
        return rows[0];
      });
      res.status(error ? 502 : 201).json({ snapshot });
    } catch (err) { next(err); }
  });

  app.get('/api/orgs/:orgId/audit', requireAuth, requireOrg, async (req, res, next) => {
    try {
      const out = await withUser(pool, req.user.id, async (c) => {
        const role = await roleIn(c, req.params.orgId);
        if (!role) return { status: 404, body: { error: 'ORG_NOT_FOUND' } };
        if (!AUDIT_ROLES.includes(role)) return { status: 403, body: { error: 'FORBIDDEN', role } };
        const { rows } = await c.query(
          `select id, actor_id, action, target, outcome, detail, created_at from public.audit_events
           where org_id = $1 order by created_at desc, id desc limit 50`, [req.params.orgId]);
        return { status: 200, body: { events: rows } };
      });
      res.status(out.status).json(out.body);
    } catch (err) { next(err); }
  });

  app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  // Never leak internals (SQL, stack, tokens) to clients.
  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'INVALID_JSON' });
    console.error('[control-center] internal error:', err?.message);
    res.status(500).json({ error: 'INTERNAL' });
  });
  return app;
}
