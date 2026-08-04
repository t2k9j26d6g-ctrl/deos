-- DEOS V5.21C
-- Backend de test uniquement. Aucun secret ne doit etre ajoute au frontend.
-- Cette migration prepare Auth + workspace + table de test distante.

create extension if not exists pgcrypto;

create or replace function public.deos_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'contributor', 'reader')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, user_id)
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  code text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.deos_test_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete restrict,
  label text not null check (length(trim(label)) > 0 and left(lower(trim(label)), 4) = 'test'),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null,
  version integer not null default 1 check (version >= 1)
);

create index if not exists idx_workspace_members_user on public.workspace_members (user_id, workspace_id);
create index if not exists idx_sites_workspace on public.sites (workspace_id);
create index if not exists idx_deos_test_records_workspace on public.deos_test_records (workspace_id, created_at desc);
create index if not exists idx_deos_test_records_owner on public.deos_test_records (owner_id, created_at desc);
create index if not exists idx_deos_test_records_active on public.deos_test_records (workspace_id, deleted_at) where deleted_at is null;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.deos_set_updated_at();

drop trigger if exists trg_workspaces_updated_at on public.workspaces;
create trigger trg_workspaces_updated_at
before update on public.workspaces
for each row execute function public.deos_set_updated_at();

drop trigger if exists trg_sites_updated_at on public.sites;
create trigger trg_sites_updated_at
before update on public.sites
for each row execute function public.deos_set_updated_at();

drop trigger if exists trg_deos_test_records_updated_at on public.deos_test_records;
create trigger trg_deos_test_records_updated_at
before update on public.deos_test_records
for each row execute function public.deos_set_updated_at();

create or replace function public.deos_workspace_role(p_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select wm.role
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.deos_is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.deos_can_write_workspace(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.deos_workspace_role(p_workspace_id) in ('owner', 'admin', 'contributor'), false);
$$;

comment on function public.deos_workspace_role(uuid) is 'Retourne le role de l utilisateur courant dans un workspace.';
comment on function public.deos_is_workspace_member(uuid) is 'Controle central RLS: appartenance au workspace courant.';
comment on function public.deos_can_write_workspace(uuid) is 'Controle central RLS: ecriture reservee owner/admin/contributor.';

create or replace function public.deos_initialize_workspace(
  p_display_name text,
  p_workspace_name text,
  p_site_name text,
  p_site_code text default null
)
returns table (
  profile_id uuid,
  workspace_id uuid,
  site_id uuid,
  member_role text,
  created_workspace boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_site_id uuid;
  v_existing_workspace uuid;
  v_existing_site uuid;
  v_existing_role text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  insert into public.profiles (id, display_name)
  values (v_user_id, coalesce(nullif(trim(p_display_name), ''), 'Utilisateur DEOS test'))
  on conflict (id) do update
  set display_name = excluded.display_name,
      updated_at = timezone('utc', now());

  select wm.workspace_id, wm.role
    into v_existing_workspace, v_existing_role
  from public.workspace_members wm
  where wm.user_id = v_user_id
  order by wm.created_at asc
  limit 1;

  if v_existing_workspace is not null then
    select s.id
      into v_existing_site
    from public.sites s
    where s.workspace_id = v_existing_workspace
    order by s.created_at asc
    limit 1;

    return query
    select v_user_id, v_existing_workspace, v_existing_site, coalesce(v_existing_role, 'reader'), false;
    return;
  end if;

  insert into public.workspaces (name, created_by)
  values (coalesce(nullif(trim(p_workspace_name), ''), 'Workspace DEOS test'), v_user_id)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'owner');

  insert into public.sites (workspace_id, name, code)
  values (
    v_workspace_id,
    coalesce(nullif(trim(p_site_name), ''), 'Site DEOS test'),
    coalesce(nullif(trim(p_site_code), ''), 'TEST')
  )
  returning id into v_site_id;

  return query
  select v_user_id, v_workspace_id, v_site_id, 'owner', true;
end;
$$;

comment on function public.deos_initialize_workspace(text, text, text, text) is 'Creation securisee du premier profil/workspace/site + owner associe. Le frontend ne peut pas s attribuer owner sur un workspace existant.';

create or replace function public.deos_update_test_record(
  p_record_id uuid,
  p_expected_version integer,
  p_label text default null,
  p_payload jsonb default null
)
returns public.deos_test_records
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.deos_test_records;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.deos_test_records r
     set label = coalesce(nullif(trim(p_label), ''), r.label),
         payload = coalesce(p_payload, r.payload),
         version = r.version + 1
   where r.id = p_record_id
     and r.deleted_at is null
     and r.version = p_expected_version
     and public.deos_can_write_workspace(r.workspace_id)
  returning r.* into v_row;

  if v_row.id is null then
    raise exception 'CONFLICT';
  end if;

  return v_row;
end;
$$;

create or replace function public.deos_soft_delete_test_record(
  p_record_id uuid,
  p_expected_version integer
)
returns public.deos_test_records
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.deos_test_records;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.deos_test_records r
     set deleted_at = timezone('utc', now()),
         version = r.version + 1
   where r.id = p_record_id
     and r.deleted_at is null
     and r.version = p_expected_version
     and public.deos_can_write_workspace(r.workspace_id)
  returning r.* into v_row;

  if v_row.id is null then
    raise exception 'CONFLICT';
  end if;

  return v_row;
end;
$$;

revoke all on table public.profiles from anon;
revoke all on table public.workspaces from anon;
revoke all on table public.workspace_members from anon;
revoke all on table public.sites from anon;
revoke all on table public.deos_test_records from anon;

revoke all on table public.profiles from authenticated;
revoke all on table public.workspaces from authenticated;
revoke all on table public.workspace_members from authenticated;
revoke all on table public.sites from authenticated;
revoke all on table public.deos_test_records from authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.workspaces to authenticated;
grant select, insert, update on public.workspace_members to authenticated;
grant select, insert, update on public.sites to authenticated;
grant select, insert, update on public.deos_test_records to authenticated;

grant execute on function public.deos_workspace_role(uuid) to authenticated;
grant execute on function public.deos_is_workspace_member(uuid) to authenticated;
grant execute on function public.deos_can_write_workspace(uuid) to authenticated;
grant execute on function public.deos_initialize_workspace(text, text, text, text) to authenticated;
grant execute on function public.deos_update_test_record(uuid, integer, text, jsonb) to authenticated;
grant execute on function public.deos_soft_delete_test_record(uuid, integer) to authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.sites enable row level security;
alter table public.deos_test_records enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member
on public.workspaces
for select
to authenticated
using (public.deos_is_workspace_member(id));

drop policy if exists workspaces_insert_owner on public.workspaces;
create policy workspaces_insert_owner
on public.workspaces
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists workspaces_update_owner_admin on public.workspaces;
create policy workspaces_update_owner_admin
on public.workspaces
for update
to authenticated
using (coalesce(public.deos_workspace_role(id) in ('owner', 'admin'), false))
with check (coalesce(public.deos_workspace_role(id) in ('owner', 'admin'), false));

drop policy if exists workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_member
on public.workspace_members
for select
to authenticated
using (public.deos_is_workspace_member(workspace_id));

drop policy if exists workspace_members_insert_owner_admin on public.workspace_members;
create policy workspace_members_insert_owner_admin
on public.workspace_members
for insert
to authenticated
with check (coalesce(public.deos_workspace_role(workspace_id) in ('owner', 'admin'), false));

drop policy if exists workspace_members_update_owner_admin on public.workspace_members;
create policy workspace_members_update_owner_admin
on public.workspace_members
for update
to authenticated
using (coalesce(public.deos_workspace_role(workspace_id) in ('owner', 'admin'), false))
with check (coalesce(public.deos_workspace_role(workspace_id) in ('owner', 'admin'), false));

drop policy if exists sites_select_member on public.sites;
create policy sites_select_member
on public.sites
for select
to authenticated
using (public.deos_is_workspace_member(workspace_id));

drop policy if exists sites_insert_owner_admin on public.sites;
create policy sites_insert_owner_admin
on public.sites
for insert
to authenticated
with check (coalesce(public.deos_workspace_role(workspace_id) in ('owner', 'admin'), false));

drop policy if exists sites_update_owner_admin on public.sites;
create policy sites_update_owner_admin
on public.sites
for update
to authenticated
using (coalesce(public.deos_workspace_role(workspace_id) in ('owner', 'admin'), false))
with check (coalesce(public.deos_workspace_role(workspace_id) in ('owner', 'admin'), false));

drop policy if exists deos_test_records_select_member on public.deos_test_records;
create policy deos_test_records_select_member
on public.deos_test_records
for select
to authenticated
using (public.deos_is_workspace_member(workspace_id));

drop policy if exists deos_test_records_insert_writer on public.deos_test_records;
create policy deos_test_records_insert_writer
on public.deos_test_records
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and public.deos_can_write_workspace(workspace_id)
  and left(lower(trim(label)), 4) = 'test'
  and jsonb_typeof(payload) = 'object'
);

drop policy if exists deos_test_records_update_writer on public.deos_test_records;
create policy deos_test_records_update_writer
on public.deos_test_records
for update
to authenticated
using (public.deos_can_write_workspace(workspace_id))
with check (
  public.deos_can_write_workspace(workspace_id)
  and left(lower(trim(label)), 4) = 'test'
  and jsonb_typeof(payload) = 'object'
);

comment on table public.profiles is 'Profil utilisateur minimal DEOS test, lie a auth.users.';
comment on table public.workspaces is 'Workspace de test. Isolation RLS par appartenance workspace_members.';
comment on table public.workspace_members is 'Roles de test: owner/admin/contributor/reader.';
comment on table public.sites is 'Premier niveau site dans un workspace.';
comment on table public.deos_test_records is 'Table de validation distante V5.21C. Aucune donnee metier DEOS ne doit y etre envoyee.';