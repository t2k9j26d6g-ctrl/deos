-- DEOS V5.24A
-- Synchronisation hybride pilote des Dossiers, séparée du pilote Liens.
-- Aucun autre objet métier DEOS n'est stocké par cette migration.

create extension if not exists pgcrypto;

create or replace function public.deos_folder_payload_is_safe(p_data jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(coalesce(p_data, '{}'::jsonb)) = 'object'
    and not (coalesce(p_data, '{}'::jsonb) ?| array[
      'managers','folders','priorities','activity','journal',
      'documents','agenda','folders','performance','meetingPreparations','links',
      'performance_imports','state','settings','remoteSync'
    ]);
$$;

create table if not exists public.deos_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete restrict,
  client_id text not null check (length(trim(client_id)) > 0),
  data jsonb not null default '{}'::jsonb check (public.deos_folder_payload_is_safe(data)),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null,
  version integer not null default 1 check (version >= 1),
  unique (workspace_id, client_id)
);

create index if not exists idx_deos_folders_workspace on public.deos_folders (workspace_id);
create index if not exists idx_deos_folders_client_id on public.deos_folders (client_id);
create index if not exists idx_deos_folders_updated_at on public.deos_folders (updated_at desc);
create index if not exists idx_deos_folders_deleted_at on public.deos_folders (deleted_at);
create index if not exists idx_deos_folders_workspace_active on public.deos_folders (workspace_id, updated_at desc) where deleted_at is null;

drop trigger if exists trg_deos_folders_updated_at on public.deos_folders;
create trigger trg_deos_folders_updated_at
before update on public.deos_folders
for each row execute function public.deos_set_updated_at();

alter table public.deos_folders enable row level security;

drop policy if exists deos_folders_select on public.deos_folders;
create policy deos_folders_select on public.deos_folders for select
using (
  auth.uid() is not null
  and workspace_id = public.deos_current_workspace_id()
  and public.deos_is_workspace_member(workspace_id)
);

drop policy if exists deos_folders_insert on public.deos_folders;
create policy deos_folders_insert on public.deos_folders for insert
with check (
  auth.uid() is not null
  and owner_id = auth.uid()
  and workspace_id = public.deos_current_workspace_id()
  and public.deos_can_write_workspace(workspace_id)
  and public.deos_folder_payload_is_safe(data)
);

drop policy if exists deos_folders_update on public.deos_folders;
create policy deos_folders_update on public.deos_folders for update
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
  and public.deos_folder_payload_is_safe(data)
);

create or replace function public.deos_update_folder(
  p_client_id text,
  p_expected_version integer,
  p_data jsonb
)
returns public.deos_folders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workspace_id uuid := public.deos_current_workspace_id();
  v_row public.deos_folders;
begin
  if auth.uid() is null then raise exception using message = 'AUTH_REQUIRED'; end if;
  if v_workspace_id is null then raise exception using message = 'WORKSPACE_REQUIRED'; end if;
  if not public.deos_can_write_workspace(v_workspace_id) then raise exception using message = 'FORBIDDEN'; end if;
  if not public.deos_folder_payload_is_safe(p_data) then raise exception using message = 'INVALID_FOLDER_PAYLOAD'; end if;

  update public.deos_folders a
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
    raise exception using message = 'CONFLICT', detail = 'La version distante de le Dossier a changé.';
  end if;
  return v_row;
end;
$$;

create or replace function public.deos_soft_delete_folder(
  p_client_id text,
  p_expected_version integer
)
returns public.deos_folders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workspace_id uuid := public.deos_current_workspace_id();
  v_row public.deos_folders;
begin
  if auth.uid() is null then raise exception using message = 'AUTH_REQUIRED'; end if;
  if v_workspace_id is null then raise exception using message = 'WORKSPACE_REQUIRED'; end if;
  if not public.deos_can_write_workspace(v_workspace_id) then raise exception using message = 'FORBIDDEN'; end if;

  update public.deos_folders a
     set deleted_at = timezone('utc', now()),
         version = a.version + 1
   where a.workspace_id = v_workspace_id
     and a.client_id = trim(coalesce(p_client_id, ''))
     and a.deleted_at is null
     and a.version = p_expected_version
     and public.deos_can_write_workspace(a.workspace_id)
  returning a.* into v_row;

  if v_row.id is null then
    raise exception using message = 'CONFLICT', detail = 'La version distante de le Dossier a changé avant suppression logique.';
  end if;
  return v_row;
end;
$$;

comment on function public.deos_folder_payload_is_safe(jsonb) is 'Refuse tout payload Dossier ressemblant à un état métier global DEOS.';
comment on function public.deos_update_folder(text, integer, jsonb) is 'Met à jour un Dossier du workspace actif avec contrôle de version.';
comment on function public.deos_soft_delete_folder(text, integer) is 'Suppression logique d un Dossier du workspace actif avec contrôle de version.';
