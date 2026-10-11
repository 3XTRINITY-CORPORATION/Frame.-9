import { createPool, migrate } from './db.mjs';
// --local-shim applies supabase/local/00_supabase_shim.sql first (local/CI only).
const pool = createPool(process.env.DATABASE_URL);
await migrate(pool, { includeLocalShim: process.argv.includes('--local-shim') });
await pool.end();
console.log('migrations applied');
