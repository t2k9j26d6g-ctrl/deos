-- DEOS V5.23A
-- Synchronisation hybride pilote des Projets, séparée du pilote Liens.
-- Aucun autre objet métier DEOS n'est stocké par cette migration.

create extension if not exists pgcrypto;

create or replace function public.deos_project_payload_is_safe(p_data jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(coalesce(p_data, '{}'::jsonb)) = 'object'
    and not (coalesce(p_data, '{}'::jsonb) ?| array[
      'managers','projects','priorities','activity','journal',
      'documents','agenda','folders','performance','meetingPreparations','links',
      'performance_imports','state','settings','remoteSync'
    ]);
$$;

create table if not exists public.deos_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete restrict,
  client_id text not null check (length(trim(client_id)) > 0),
  data jsonb not null default '{}'::jsonb check (public.deos_project_payload_is_safe(data)),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null,
  version integer not null default 1 check (version >= 1),
  unique (workspace_id, client_id)
);

create index if not exists idx_deos_projects_workspace on public.deos_projects (workspace_id);
create index if not exists idx_deos_projects_client_id on public.deos_projects (client_id);
create index if not exists idx_deos_projects_updated_at on public.deos_projects (updated_at desc);
create index if not exists idx_deos_projects_deleted_at on public.deos_projects (deleted_at);
create index if not exists idx_deos_projects_workspace_active on public.deos_projects (workspace_id, updated_at desc) where deleted_at is null;

drop trigger if exists trg_deos_projects_updated_at on public.deos_projects;
create trigger trg_deos_projects_updated_at
before update on public.deos_projects
for each row execute function public.deos_set_updated_at();

alter table public.deos_projects enable row level security;

drop policy if exists deos_projects_select on public.deos_projects;
create policy deos_projects_select on public.deos_projects for select
using (
  auth.uid() is not null
  and workspace_id = public.deos_current_workspace_id()
  and public.deos_is_workspace_member(workspace_id)
);

drop policy if exists deos_projects_insert on public.deos_projects;
create policy deos_projects_insert on public.deos_projects for insert
with check (
  auth.uid() is not null
  and owner_id = auth.uid()
  and workspace_id = public.deos_current_workspace_id()
  and public.deos_can_write_workspace(workspace_id)
  and public.deos_project_payload_is_safe(data)
);

drop policy if exists deos_projects_update on public.deos_projects;
create policy deos_projects_update on public.deos_projects for update
using (
  auth.uid() is not null
  and workspace_id = public.deos_current_workspace_id()
  and public.deos_can_write_workspace(workspace_id)
)
with check (
  auth.uid() is not null
  and owner_id = auth.uid()
  and workspace_id = public.deos_current_workspace_id()
  and public.deos_can_write_workspace(workspace_id)
  and public.deos_project_payload_is_safe(data)
);

create or replace function public.deos_update_project(
  p_client_id text,
  p_expected_version integer,
  p_data jsonb
)
returns public.deos_projects
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workspace_id uuid := public.deos_current_workspace_id();
  v_row public.deos_projects;
begin
  if auth.uid() is null then raise exception using message = 'AUTH_REQUIRED'; end if;
  if v_workspace_id is null then raise exception using message = 'WORKSPACE_REQUIRED'; end if;
  if not public.deos_can_write_workspace(v_workspace_id) then raise exception using message = 'FORBIDDEN'; end if;
  if not public.deos_project_payload_is_safe(p_data) then raise exception using message = 'INVALID_PROJECT_PAYLOAD'; end if;

  update public.deos_projects a
     set data = p_data,
         version = a.version + 1,
         deleted_at = null
   where a.workspace_id = v_workspace_id
     and a.client_id = trim(coalesce(p_client_id, ''))
     and a.deleted_at is null
     and a.version = p_expected_version
     and public.deos_can_write_workspace(a.workspace_id)
  returning a.* into v_row;

  if v_row.id is null then
    raise exception using message = 'CONFLICT', detail = 'La version distante de le Projet a changé.';
  end if;
  return v_row;
end;
$$;

create or replace function public.deos_soft_delete_project(
  p_client_id text,
  p_expected_version integer
)
returns public.deos_projects
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workspace_id uuid := public.deos_current_workspace_id();
  v_row public.deos_projects;
begin
  if auth.uid() is null then raise exception using message = 'AUTH_REQUIRED'; end if;
  if v_workspace_id is null then raise exception using message = 'WORKSPACE_REQUIRED'; end if;
  if not public.deos_can_write_workspace(v_workspace_id) then raise exception using message = 'FORBIDDEN'; end if;

  update public.deos_projects a
     set deleted_at = timezone('utc', now()),
         version = a.version + 1
   where a.workspace_id = v_workspace_id
     and a.client_id = trim(coalesce(p_client_id, ''))
     and a.deleted_at is null
     and a.version = p_expected_version
     and public.deos_can_write_workspace(a.workspace_id)
  returning a.* into v_row;

  if v_row.id is null then
    raise exception using message = 'CONFLICT', detail = 'La version distante de le Projet a changé avant suppression logique.';
  end if;
  return v_row;
end;
$$;

comment on function public.deos_project_payload_is_safe(jsonb) is 'Refuse tout payload Projet ressemblant à un état métier global DEOS.';
comment on function public.deos_update_project(text, integer, jsonb) is 'Met à jour un Projet du workspace actif avec contrôle de version.';
comment on function public.deos_soft_delete_project(text, integer) is 'Suppression logique d un Projet du workspace actif avec contrôle de version.';
