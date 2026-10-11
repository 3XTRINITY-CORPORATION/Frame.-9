import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createPool(connectionString) {
  if (!connectionString) throw new Error('DATABASE_URL is required');
  return new pg.Pool({ connectionString, max: 10 });
}

// Run fn inside a transaction as role "authenticated" with auth.uid() = userId,
// so every query is subject to the RLS policies (same model as Supabase).
export async function withUser(pool, userId, fn) {
  if (!UUID_RE.test(String(userId))) throw new Error('invalid user id');
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('set local role authenticated');
    await client.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
      [userId, JSON.stringify({ sub: userId, role: 'authenticated' })]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export function migrationFiles({ includeLocalShim }) {
  const files = [];
  if (includeLocalShim) files.push(join(ROOT, 'local', '00_supabase_shim.sql'));
  for (const f of readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    files.push(join(ROOT, 'migrations', f));
  }
  return files;
}

export async function migrate(pool, { includeLocalShim }) {
  await pool.query('create table if not exists public._cc_migrations (name text primary key, applied_at timestamptz default now())');
  await pool.query('alter table public._cc_migrations enable row level security');
  for (const file of migrationFiles({ includeLocalShim })) {
    const name = file.slice(ROOT.length + 1);
    const { rowCount } = await pool.query('select 1 from public._cc_migrations where name = $1', [name]);
    if (rowCount) continue;
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(readFileSync(file, 'utf8'));
      await client.query('insert into public._cc_migrations(name) values ($1)', [name]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw new Error(`migration ${name} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
}
