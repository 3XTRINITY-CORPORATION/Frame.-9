import { createPool } from './db.mjs';
import { createApp } from './app.mjs';
import { createGitHubClient } from './github.mjs';
import { createSessionStore, localAuthenticator, supabaseAuthenticator } from './auth.mjs';

const env = process.env;
const pool = createPool(env.DATABASE_URL);
const mode = env.AUTH_MODE ?? 'local';
if (mode === 'local' && env.NODE_ENV === 'production') {
  throw new Error('AUTH_MODE=local is for development only; use AUTH_MODE=supabase in production');
}
const authenticate = mode === 'supabase'
  ? supabaseAuthenticator({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY })
  : localAuthenticator(pool);

const app = createApp({
  pool,
  sessions: createSessionStore(),
  authenticate,
  github: createGitHubClient({ token: env.GITHUB_TOKEN || undefined }),
  repo: env.GITHUB_REPO ?? '3XTRINITY-CORPORATION/Frame.-9',
  corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173,https://localhost,capacitor://localhost')
    .split(',').map((s) => s.trim()).filter(Boolean),
});
const port = Number(env.PORT ?? 8787);
app.listen(port, '127.0.0.1', () => console.log(`control-center api on http://127.0.0.1:${port} (auth=${mode})`));
