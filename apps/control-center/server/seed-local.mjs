// Dev-only seed: one org, one OWNER. Password comes from SEED_PASSWORD (never committed).
import { createPool } from './db.mjs';
import { hashPassword } from './auth.mjs';
const { DATABASE_URL, SEED_EMAIL = 'owner@frame9.local', SEED_PASSWORD } = process.env;
if (!SEED_PASSWORD) { console.error('Set SEED_PASSWORD (>=12 chars)'); process.exit(1); }
const pool = createPool(DATABASE_URL);
const { rows: [u] } = await pool.query(
  'insert into auth.users(email) values ($1) on conflict (email) do update set email = excluded.email returning id', [SEED_EMAIL]);
await pool.query(`insert into app_private.local_credentials(user_id, password_hash) values ($1, $2)
  on conflict (user_id) do update set password_hash = excluded.password_hash`, [u.id, await hashPassword(SEED_PASSWORD)]);
const { rows: [o] } = await pool.query("insert into public.organizations(name) values ('3XTRINITY') returning id");
await pool.query("insert into public.organization_members(org_id, user_id, role) values ($1, $2, 'OWNER')", [o.id, u.id]);
await pool.query('insert into public.profiles(id, display_name) values ($1, $2) on conflict do nothing', [u.id, 'Owner']);
console.log(`seeded ${SEED_EMAIL} as OWNER of org ${o.id}`);
await pool.end();
