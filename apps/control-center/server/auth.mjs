import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const N = 16384, R = 8, P = 1, KEYLEN = 32;

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12) throw new Error('Password must be at least 12 characters');
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(String(password), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p),
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Opaque server-side sessions. Tokens are random 256-bit values; only a
// session map lookup grants identity. Not persisted: restart = re-login.
export function createSessionStore({ ttlMs = 8 * 60 * 60 * 1000, now = () => Date.now() } = {}) {
  const sessions = new Map();
  return {
    create(user) {
      const token = randomBytes(32).toString('base64url');
      sessions.set(token, { user, expiresAt: now() + ttlMs });
      return token;
    },
    get(token) {
      if (typeof token !== 'string' || token.length < 40) return null;
      const s = sessions.get(token);
      if (!s) return null;
      if (s.expiresAt <= now()) { sessions.delete(token); return null; }
      return s.user;
    },
    destroy(token) { sessions.delete(token); },
  };
}

// AUTH_MODE=local: dev/CI credentials in app_private.local_credentials.
export function localAuthenticator(pool) {
  // Dummy hash so unknown emails cost the same as wrong passwords.
  const dummy = hashPassword('dummy-password-for-timing');
  return async (email, password) => {
    const { rows } = await pool.query(
      `select u.id, u.email, c.password_hash from auth.users u
       join app_private.local_credentials c on c.user_id = u.id where lower(u.email) = lower($1)`,
      [email],
    );
    if (rows.length === 0) { await verifyPassword(password, await dummy); return null; }
    return (await verifyPassword(password, rows[0].password_hash)) ? { id: rows[0].id, email: rows[0].email } : null;
  };
}

// AUTH_MODE=supabase: verify with Supabase Auth (GoTrue) password grant.
export function supabaseAuthenticator({ url, anonKey, fetchImpl = globalThis.fetch }) {
  if (!url || !anonKey) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required for AUTH_MODE=supabase');
  return async (email, password) => {
    const res = await fetchImpl(`${url.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.user?.id ? { id: body.user.id, email: body.user.email } : null;
  };
}
