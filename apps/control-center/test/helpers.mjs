import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { createPool, migrate } from '../server/db.mjs';

export const DB_URL = process.env.TEST_DATABASE_URL;

// Creates an isolated throwaway database with shim + migrations applied.
export async function freshDb() {
  const name = `cc_test_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: DB_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();
  const url = new URL(DB_URL);
  url.pathname = `/${name}`;
  const pool = createPool(url.toString());
  await migrate(pool, { includeLocalShim: true });
  return {
    pool,
    async drop() {
      await pool.end();
      const a = new pg.Client({ connectionString: DB_URL });
      await a.connect();
      await a.query(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

export async function makeUser(pool, email) {
  const { rows } = await pool.query('insert into auth.users(email) values ($1) returning id', [email]);
  return rows[0].id;
}
export async function makeOrg(pool, name) {
  const { rows } = await pool.query('insert into public.organizations(name) values ($1) returning id', [name]);
  return rows[0].id;
}
export async function addMember(pool, orgId, userId, role) {
  await pool.query('insert into public.organization_members(org_id, user_id, role) values ($1, $2, $3)', [orgId, userId, role]);
}
