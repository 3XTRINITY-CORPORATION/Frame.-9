-- LOCAL/CI ONLY. Never apply to Supabase/Lovable Cloud: it emulates the parts of
-- the Supabase platform the migrations rely on (auth.users, auth.uid(), roles),
-- plus a dev-only credential table used by AUTH_MODE=local.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant anon, authenticated, service_role to current_user;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create schema if not exists app_private;
revoke all on schema app_private from public;
create table if not exists app_private.local_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  password_hash text not null -- scrypt$N$r$p$salt$hash (never plaintext)
);
