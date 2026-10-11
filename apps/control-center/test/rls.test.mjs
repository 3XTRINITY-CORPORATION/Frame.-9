import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { withUser } from '../server/db.mjs';
import { DB_URL, freshDb, makeUser, makeOrg, addMember } from './helpers.mjs';

const SHA = 'a'.repeat(40);
const snap = (orgId) => ({
  text: `insert into public.repo_snapshots(org_id, repo, fetch_status, head_sha, fetched_by)
         values ($1, '3XTRINITY-CORPORATION/Frame.-9', 'OK', $2, auth.uid()) returning id`,
  values: [orgId, SHA],
});

describe.skipIf(!DB_URL)('RLS + tenant isolation (local Postgres)', () => {
  let db, pool, orgA, orgB, owner, admin, operator, auditor, viewer, ownerB, outsider, snapB;

  beforeAll(async () => {
    db = await freshDb();
    pool = db.pool;
    orgA = await makeOrg(pool, 'Org A');
    orgB = await makeOrg(pool, 'Org B');
    [owner, admin, operator, auditor, viewer, ownerB, outsider] = await Promise.all(
      ['owner', 'admin', 'operator', 'auditor', 'viewer', 'ownerb', 'outsider'].map((n) => makeUser(pool, `${n}@t.local`)));
    await addMember(pool, orgA, owner, 'OWNER');
    await addMember(pool, orgA, admin, 'ADMIN');
    await addMember(pool, orgA, operator, 'OPERATOR');
    await addMember(pool, orgA, auditor, 'AUDITOR');
    await addMember(pool, orgA, viewer, 'VIEWER');
    await addMember(pool, orgB, ownerB, 'OWNER');
    snapB = await withUser(pool, ownerB, async (c) => (await c.query(snap(orgB))).rows[0].id);
    await withUser(pool, ownerB, (c) => c.query(
      `insert into public.audit_events(org_id, actor_id, action, outcome) values ($1, auth.uid(), 'repo.snapshot', 'SUCCESS')`, [orgB]));
  });
  afterAll(async () => { await db?.drop(); });

  const q = (user, text, values) => withUser(pool, user, (c) => c.query(text, values));

  it('anon role has no access to any table', async () => {
    const c = await pool.connect();
    try {
      await c.query('begin; set local role anon');
      await expect(c.query('select * from public.repo_snapshots')).rejects.toThrow(/permission denied/);
    } finally { await c.query('rollback'); c.release(); }
  });

  it('authenticated with no sub sees no rows', async () => {
    const c = await pool.connect();
    try {
      await c.query('begin; set local role authenticated');
      expect((await c.query('select * from public.organizations')).rowCount).toBe(0);
      expect((await c.query('select * from public.repo_snapshots')).rowCount).toBe(0);
    } finally { await c.query('rollback'); c.release(); }
  });

  it('member sees only own org; cross-tenant rows are invisible', async () => {
    const orgs = (await q(owner, 'select id from public.organizations')).rows.map((r) => r.id);
    expect(orgs).toEqual([orgA]);
    expect((await q(owner, 'select * from public.repo_snapshots where id = $1', [snapB])).rowCount).toBe(0);
    expect((await q(owner, 'select * from public.audit_events where org_id = $1', [orgB])).rowCount).toBe(0);
    expect((await q(owner, 'select * from public.organization_members where org_id = $1', [orgB])).rowCount).toBe(0);
  });

  it('outsider sees nothing and cannot add themselves to an org', async () => {
    expect((await q(outsider, 'select * from public.organizations')).rowCount).toBe(0);
    await expect(q(outsider, `insert into public.organization_members(org_id, user_id, role) values ($1, auth.uid(), 'OWNER')`, [orgA]))
      .rejects.toThrow(/row-level security/);
  });

  it('OPERATOR can insert snapshot; VIEWER and AUDITOR cannot', async () => {
    expect((await q(operator, snap(orgA).text, snap(orgA).values)).rowCount).toBe(1);
    await expect(q(viewer, snap(orgA).text, snap(orgA).values)).rejects.toThrow(/row-level security/);
    await expect(q(auditor, snap(orgA).text, snap(orgA).values)).rejects.toThrow(/row-level security/);
  });

  it('cannot write a snapshot into another tenant', async () => {
    await expect(q(owner, snap(orgB).text, snap(orgB).values)).rejects.toThrow(/row-level security/);
  });

  it('cannot spoof fetched_by or audit actor_id', async () => {
    await expect(q(operator, `insert into public.repo_snapshots(org_id, repo, fetch_status, fetched_by)
      values ($1, 'a/b', 'OK', $2)`, [orgA, owner])).rejects.toThrow(/row-level security/);
    await expect(q(operator, `insert into public.audit_events(org_id, actor_id, action, outcome)
      values ($1, $2, 'repo.snapshot', 'SUCCESS')`, [orgA, owner])).rejects.toThrow(/row-level security/);
  });

  it('snapshots and audit events are immutable (no UPDATE/DELETE)', async () => {
    await expect(q(owner, `update public.repo_snapshots set fetch_status = 'ERROR'`)).rejects.toThrow(/permission denied/);
    await expect(q(owner, 'delete from public.repo_snapshots')).rejects.toThrow(/permission denied/);
    await expect(q(owner, `update public.audit_events set outcome = 'SUCCESS'`)).rejects.toThrow(/permission denied/);
    await expect(q(owner, 'delete from public.audit_events')).rejects.toThrow(/permission denied/);
  });

  it('audit read limited to OWNER/ADMIN/AUDITOR', async () => {
    await q(viewer, `insert into public.audit_events(org_id, actor_id, action, outcome) values ($1, auth.uid(), 'repo.view', 'SUCCESS')`, [orgA]);
    expect((await q(auditor, 'select * from public.audit_events where org_id = $1', [orgA])).rowCount).toBeGreaterThan(0);
    expect((await q(admin, 'select * from public.audit_events where org_id = $1', [orgA])).rowCount).toBeGreaterThan(0);
    expect((await q(viewer, 'select * from public.audit_events')).rowCount).toBe(0);
    expect((await q(operator, 'select * from public.audit_events')).rowCount).toBe(0);
  });

  it('ADMIN cannot grant or modify OWNER; OWNER can', async () => {
    const newbie = await makeUser(pool, 'newbie@t.local');
    await expect(q(admin, `insert into public.organization_members(org_id, user_id, role) values ($1, $2, 'OWNER')`, [orgA, newbie]))
      .rejects.toThrow(/row-level security/);
    await expect(q(admin, `update public.organization_members set role = 'OWNER' where user_id = $1 and org_id = $2`, [viewer, orgA]))
      .rejects.toThrow(/row-level security/);
    const demoted = await q(admin, `update public.organization_members set role = 'VIEWER' where user_id = $1 and org_id = $2`, [owner, orgA]);
    expect(demoted.rowCount).toBe(0);
    expect((await q(admin, `insert into public.organization_members(org_id, user_id, role) values ($1, $2, 'VIEWER')`, [orgA, newbie])).rowCount).toBe(1);
    expect((await q(owner, `update public.organization_members set role = 'OPERATOR' where user_id = $1 and org_id = $2`, [newbie, orgA])).rowCount).toBe(1);
  });

  it('OPERATOR/VIEWER cannot manage members', async () => {
    const x = await makeUser(pool, 'x@t.local');
    await expect(q(operator, `insert into public.organization_members(org_id, user_id, role) values ($1, $2, 'VIEWER')`, [orgA, x]))
      .rejects.toThrow(/row-level security/);
    expect((await q(viewer, 'delete from public.organization_members where org_id = $1', [orgA])).rowCount).toBe(0);
  });

  it('local credential table is not reachable by authenticated', async () => {
    await expect(q(owner, 'select * from app_private.local_credentials')).rejects.toThrow(/permission denied/);
  });
});
