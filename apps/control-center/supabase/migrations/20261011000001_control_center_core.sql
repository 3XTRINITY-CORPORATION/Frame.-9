-- FRAME.9 Control Center core schema (Supabase / Lovable Cloud compatible).
-- Tenant isolation is enforced by RLS on every table; the API server executes
-- user requests as role "authenticated" with the caller's id as JWT sub.

create type public.org_role as enum ('OWNER', 'ADMIN', 'OPERATOR', 'AUDITOR', 'VIEWER');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 100),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index organization_members_user_idx on public.organization_members(user_id);

create table public.repo_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  repo text not null check (repo ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  fetch_status text not null check (fetch_status in ('OK', 'PARTIAL', 'ERROR')),
  default_branch text,
  head_sha text check (head_sha is null or head_sha ~ '^[0-9a-f]{40}$'),
  branches jsonb not null default '[]'::jsonb,
  commits jsonb not null default '[]'::jsonb,
  ci jsonb not null default '{}'::jsonb,
  error jsonb,
  rate_limit_remaining integer,
  fetched_by uuid not null references auth.users(id),
  fetched_at timestamptz not null default now()
);
create index repo_snapshots_org_time_idx on public.repo_snapshots(org_id, fetched_at desc);

create table public.audit_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null check (action ~ '^[a-z][a-z0-9_.]{1,63}$'),
  target text,
  outcome text not null check (outcome in ('SUCCESS', 'FAILURE', 'DENIED')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_org_time_idx on public.audit_events(org_id, created_at desc);

-- Role lookup helpers. SECURITY DEFINER avoids recursive RLS on
-- organization_members; search_path pinned to prevent hijacking.
create or replace function public.has_org_role(p_org uuid, p_roles public.org_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = auth.uid() and m.role = any (p_roles)
  )
$$;
create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = auth.uid()
  )
$$;
revoke all on function public.has_org_role(uuid, public.org_role[]) from public;
revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.has_org_role(uuid, public.org_role[]) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.repo_snapshots enable row level security;
alter table public.audit_events enable row level security;
alter table public.organizations force row level security;
alter table public.profiles force row level security;
alter table public.organization_members force row level security;
alter table public.repo_snapshots force row level security;
alter table public.audit_events force row level security;

-- Least privilege grants: anon gets nothing; no UPDATE/DELETE on snapshots or audit.
revoke all on public.organizations, public.profiles, public.organization_members,
  public.repo_snapshots, public.audit_events from anon, authenticated;
grant select, update on public.organizations to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert on public.repo_snapshots to authenticated;
grant select, insert on public.audit_events to authenticated;

-- organizations
create policy org_select on public.organizations for select to authenticated
  using (public.is_org_member(id));
create policy org_update on public.organizations for update to authenticated
  using (public.has_org_role(id, array['OWNER','ADMIN']::public.org_role[]))
  with check (public.has_org_role(id, array['OWNER','ADMIN']::public.org_role[]));

-- profiles: own row, or co-members of a shared organization
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from public.organization_members mine
    join public.organization_members theirs on theirs.org_id = mine.org_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- organization_members: members read their org; OWNER manages all rows;
-- ADMIN manages non-OWNER rows only (no escalation to OWNER).
create policy members_select on public.organization_members for select to authenticated
  using (public.is_org_member(org_id));
create policy members_insert on public.organization_members for insert to authenticated
  with check (public.has_org_role(org_id, array['OWNER']::public.org_role[])
    or (public.has_org_role(org_id, array['ADMIN']::public.org_role[]) and role <> 'OWNER'));
create policy members_update on public.organization_members for update to authenticated
  using (public.has_org_role(org_id, array['OWNER']::public.org_role[])
    or (public.has_org_role(org_id, array['ADMIN']::public.org_role[]) and role <> 'OWNER'))
  with check (public.has_org_role(org_id, array['OWNER']::public.org_role[])
    or (public.has_org_role(org_id, array['ADMIN']::public.org_role[]) and role <> 'OWNER'));
create policy members_delete on public.organization_members for delete to authenticated
  using (public.has_org_role(org_id, array['OWNER']::public.org_role[])
    or (public.has_org_role(org_id, array['ADMIN']::public.org_role[]) and role <> 'OWNER'));

-- repo_snapshots: members read; OWNER/ADMIN/OPERATOR create as themselves; immutable.
create policy snapshots_select on public.repo_snapshots for select to authenticated
  using (public.is_org_member(org_id));
create policy snapshots_insert on public.repo_snapshots for insert to authenticated
  with check (fetched_by = auth.uid()
    and public.has_org_role(org_id, array['OWNER','ADMIN','OPERATOR']::public.org_role[]));

-- audit_events: append-only; any member records its own actions;
-- only OWNER/ADMIN/AUDITOR read.
create policy audit_select on public.audit_events for select to authenticated
  using (public.has_org_role(org_id, array['OWNER','ADMIN','AUDITOR']::public.org_role[]));
create policy audit_insert on public.audit_events for insert to authenticated
  with check (actor_id = auth.uid() and public.is_org_member(org_id));
