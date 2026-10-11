# FRAME.9 Control Center (vertical slice v1)

Lives in `apps/control-center/` so the existing FRAME.9 AI gateway at the repo root is untouched.

```
React + Vite UI ──Bearer session──▶ Express API (server/) ──SET ROLE authenticated──▶ Postgres (RLS)
                                         │
                                         └─ read-only GitHub adapter (token only from server env)
```

Slice: **login → GitHub API (branches, commits, check runs on HEAD) → `repo_snapshots` → `audit_events` → dashboard.**
GitHub errors (401/403/404/429/rate limit/unreachable) are stored and shown as errors. The UI never shows example data.

## Run locally (Node 22)

```bash
npm ci
export DATABASE_URL=postgres://postgres@127.0.0.1:5432/frame9_cc
npm run db:migrate -- --local-shim      # shim = emulated Supabase auth schema; LOCAL ONLY
SEED_PASSWORD='<choose ≥12 chars>' node server/seed-local.mjs
npm run server                           # API on 127.0.0.1:8787 (AUTH_MODE=local)
npm run dev                              # UI on :5173, proxies /api
```

Optional server env: `GITHUB_TOKEN` (read-only, server only), `GITHUB_REPO` (default `3XTRINITY-CORPORATION/Frame.-9`),
`CORS_ORIGINS`, `AUTH_MODE=supabase` + `SUPABASE_URL` + `SUPABASE_ANON_KEY`.
`AUTH_MODE=local` refuses to start when `NODE_ENV=production`.

## Database

`supabase/migrations/*.sql` work as Supabase / Lovable Cloud migrations: `profiles`, `organizations`, `organization_members`
(roles OWNER/ADMIN/OPERATOR/AUDITOR/VIEWER), `repo_snapshots` and `audit_events`. RLS is enabled and forced on every table.
- Members can read only their own organization.
- Snapshots need OWNER, ADMIN or OPERATOR, and the writer must be the caller. Snapshots can't be changed after they're written.
- Audit events can only be added, never edited or deleted. Only OWNER, ADMIN and AUDITOR can read them.
- ADMIN can't grant or change OWNER.

`supabase/local/00_supabase_shim.sql` is for local runs and CI only. **Never apply it to Supabase.**

## Tests

`TEST_DATABASE_URL=postgres://… npm test` runs the unit, API and RLS/tenant-isolation tests against a throwaway database.
The DB suites are skipped without it. `LIVE_GITHUB=1` adds a live, unauthenticated read of the public repo.

## Android (Capacitor 8)

- `appId`: **`ee.x3trinity.frame9` (provisional)**. The requested `ee.3xtrinity.frame9` is not a valid Android
  applicationId because every segment must start with a letter, and `cap add android` rejects it.
- Toolchain from the Capacitor 8 template: AGP 8.13.0, Gradle 8.14.3, compile/target SDK 36, min SDK 24, JDK 21 in CI.
- Permissions: `android.permission.INTERNET` only. CI writes the real list to `apk-permissions.txt` next to the APK.
- The debug APK is built by `.github/workflows/frame9-android.yml`. There is no release signing, AAB or Play upload.
- On device, set `VITE_API_BASE` at build time to a reachable API URL. The default is same-origin.

## Pure libraries (`src/lib`)

- `wireguard.ts`: validates config files. Private and preshared keys are never in the server payload.
  Tunnel status is `CONNECTED` only when there is a measured recent handshake; otherwise it is `UNKNOWN` or `NO_HANDSHAKE`.
- `callSecurity.ts`: decides how to screen a call. A RESTRICTED, UNAVAILABLE or PAYPHONE CLI never triggers a lookup.
  Lookups need opt-in, and decisions contain no number data.
- `registry.ts`: typed factory and skill registry with integrity checks. It is data only and starts nothing.

## Not done / blocked

- Lovable "FRAME.9 / Cloud Bound": the project ID, Cloud DB and auth have not been checked (no Lovable access). The migrations haven't been applied there.
- Sessions are stored in memory, so a restart logs everyone out. There is no org/member management UI yet; use SQL or the seed.
