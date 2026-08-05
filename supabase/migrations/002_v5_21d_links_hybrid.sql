-- DEOS V5.21D
-- Synchronisation hybride pilote strictement limitée aux Liens.
-- Aucun autre objet métier DEOS ne doit être stocké ou synchronisé par cette migration.

create extension if not exists pgcrypto;

create or replace function public.deos_current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select wm.workspace_id
  from public.workspace_members wm
  where wm.user_id = auth.uid()
  order by wm.created_at asc
  limit 1;
$$;

create or replace function public.deos_link_payload_is_safe(p_data jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(coalesce(p_data, '{}'::jsonb)) = 'object'
    and not (coalesce(p_data, '{}'::jsonb) ?| array[
      'actions',
      'managers',
      'projects',
      'decisions',
      'priorities',
      'activity',
      'journal',
      'documents',
      'agenda',
      'folders',
      'performance',
      'meetingPreparations',
      'performance_imports',
      'state',
      'settings',
      'remoteSync'
    ]);
$$;

create table if not exists public.deos_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete restrict,
  client_id text not null check (length(trim(client_id)) > 0),
  data jsonb not null default '{}'::jsonb check (public.deos_link_payload_is_safe(data)),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null,
  version integer not null default 1 check (version >= 1),
  unique (workspace_id, client_id)
);

create index if not exists idx_deos_links_workspace on public.deos_links (workspace_id);
create index if not exists idx_deos_links_client_id on public.deos_links (client_id);
create index if not exists idx_deos_links_updated_at on public.deos_links (updated_at desc);
create index if not exists idx_deos_links_deleted_at on public.deos_links (deleted_at);
create index if not exists idx_deos_links_workspace_active on public.deos_links (workspace_id, updated_at desc) where deleted_at is null;

drop trigger if exists trg_deos_links_updated_at on public.deos_links;
create trigger trg_deos_links_updated_at
before update on public.deos_links
for each row execute function public.deos_set_updated_at();

alter table public.deos_links enable row level security;

drop policy if exists deos_links_select on public.deos_links;
create policy deos_links_select
on public.deos_links
for select
using (
  auth.uid() is not null
  and workspace_id = public.deos_current_workspace_id()
  and public.deos_is_workspace_member(workspace_id)
);

drop policy if exists deos_links_insert on public.deos_links;
create policy deos_links_insert
on public.deos_links
for insert
with check (
  auth.uid() is not null
  and owner_id = auth.uid()
  and workspace_id = public.deos_current_workspace_id()
  and public.deos_can_write_workspace(workspace_id)
  and public.deos_link_payload_is_safe(data)
);

drop policy if exists deos_links_update on public.deos_links;
create policy deos_links_update
on public.deos_links
for update
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
  and public.deos_link_payload_is_safe(data)
);

create or replace function public.deos_update_link(
  p_client_id text,
  p_expected_version integer,
  p_data jsonb
)
returns public.deos_links
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workspace_id uuid := public.deos_current_workspace_id();
  v_row public.deos_links;
begin
  if auth.uid() is null then
    raise exception using message = 'AUTH_REQUIRED';
  end if;

  if v_workspace_id is null then
    raise exception using message = 'WORKSPACE_REQUIRED';
  end if;

  if not public.deos_can_write_workspace(v_workspace_id) then
    raise exception using message = 'FORBIDDEN';
  end if;

  if not public.deos_link_payload_is_safe(p_data) then
    raise exception using message = 'INVALID_LINK_PAYLOAD';
  end if;

  update public.deos_links l
     set data = p_data,
         version = l.version + 1,
         deleted_at = null
   where l.workspace_id = v_workspace_id
     and l.client_id = trim(coalesce(p_client_id, ''))
     and l.deleted_at is null
     and l.version = p_expected_version
     and public.deos_can_write_workspace(l.workspace_id)
  returning l.* into v_row;

  if v_row.id is null then
    raise exception using message = 'CONFLICT', detail = 'La version distante du Lien a changé.';
  end if;

  return v_row;
end;
$$;

create or replace function public.deos_soft_delete_link(
  p_client_id text,
  p_expected_version integer
)
returns public.deos_links
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workspace_id uuid := public.deos_current_workspace_id();
  v_row public.deos_links;
begin
  if auth.uid() is null then
    raise exception using message = 'AUTH_REQUIRED';
  end if;

  if v_workspace_id is null then
    raise exception using message = 'WORKSPACE_REQUIRED';
  end if;

  if not public.deos_can_write_workspace(v_workspace_id) then
    raise exception using message = 'FORBIDDEN';
  end if;

  update public.deos_links l
     set deleted_at = timezone('utc', now()),
         version = l.version + 1
   where l.workspace_id = v_workspace_id
     and l.client_id = trim(coalesce(p_client_id, ''))
     and l.deleted_at is null
     and l.version = p_expected_version
     and public.deos_can_write_workspace(l.workspace_id)
  returning l.* into v_row;

  if v_row.id is null then
    raise exception using message = 'CONFLICT', detail = 'La version distante du Lien a changé avant suppression logique.';
  end if;

  return v_row;
end;
$$;

comment on function public.deos_current_workspace_id() is 'Retourne le workspace actif du frontend DEOS pilote, aligné sur la première appartenance utilisateur.';
comment on function public.deos_link_payload_is_safe(jsonb) is 'Refuse tout payload Liens qui ressemble à un état métier global DEOS.';
comment on function public.deos_update_link(text, integer, jsonb) is 'Met à jour un Lien du workspace actif avec contrôle de version et erreur structurée CONFLICT.';
comment on function public.deos_soft_delete_link(text, integer) is 'Suppression logique d un Lien du workspace actif avec contrôle de version et tombstone deleted_at.';
