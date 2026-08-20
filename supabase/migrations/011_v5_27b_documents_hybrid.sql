-- DEOS V5.27B
-- Synchronisation hybride Documents.
create extension if not exists pgcrypto;

create or replace function public.deos_document_payload_is_safe(p_data jsonb)
returns boolean language sql immutable as $$
  select jsonb_typeof(coalesce(p_data, '{}'::jsonb)) = 'object'
    and not (coalesce(p_data, '{}'::jsonb) ?| array['actions','managers','projects','decisions','priorities','activity','journal','agenda','folders','performance','meetingPreparations','links','performance_imports','state','settings','remoteSync']);
$$;

create table if not exists public.deos_documents (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, owner_id uuid not null references auth.users(id) on delete restrict,
  client_id text not null check(length(trim(client_id))>0), data jsonb not null default '{}'::jsonb check(public.deos_document_payload_is_safe(data)),
  created_at timestamptz not null default timezone('utc',now()), updated_at timestamptz not null default timezone('utc',now()), deleted_at timestamptz null, version integer not null default 1 check(version>=1), unique(workspace_id,client_id)
);
create index if not exists idx_deos_documents_workspace on public.deos_documents(workspace_id);
create index if not exists idx_deos_documents_client_id on public.deos_documents(client_id);
drop trigger if exists trg_deos_documents_updated_at on public.deos_documents;
create trigger trg_deos_documents_updated_at before update on public.deos_documents for each row execute function public.deos_set_updated_at();
alter table public.deos_documents enable row level security;
drop policy if exists deos_documents_select on public.deos_documents;
create policy deos_documents_select on public.deos_documents for select using(auth.uid() is not null and workspace_id=public.deos_current_workspace_id() and public.deos_is_workspace_member(workspace_id));
drop policy if exists deos_documents_insert on public.deos_documents;
create policy deos_documents_insert on public.deos_documents for insert with check(auth.uid() is not null and owner_id=auth.uid() and workspace_id=public.deos_current_workspace_id() and public.deos_can_write_workspace(workspace_id) and public.deos_document_payload_is_safe(data));
drop policy if exists deos_documents_update on public.deos_documents;
create policy deos_documents_update on public.deos_documents for update using(auth.uid() is not null and workspace_id=public.deos_current_workspace_id() and public.deos_can_write_workspace(workspace_id)) with check(auth.uid() is not null and owner_id=auth.uid() and workspace_id=public.deos_current_workspace_id() and public.deos_can_write_workspace(workspace_id) and public.deos_document_payload_is_safe(data));

create or replace function public.deos_update_document(p_client_id text,p_expected_version integer,p_data jsonb) returns public.deos_documents language plpgsql security definer set search_path=public as $$
declare v_row public.deos_documents; begin
 if not public.deos_can_write_workspace(public.deos_current_workspace_id()) then raise exception 'FORBIDDEN'; end if;
 if not public.deos_document_payload_is_safe(p_data) then raise exception 'UNSAFE_PAYLOAD'; end if;
 update public.deos_documents set data=p_data, owner_id=auth.uid(), version=version+1 where workspace_id=public.deos_current_workspace_id() and client_id=trim(p_client_id) and deleted_at is null and version=p_expected_version returning * into v_row;
 if v_row.id is null then raise exception 'CONFLICT'; end if; return v_row; end; $$;
create or replace function public.deos_soft_delete_document(p_client_id text,p_expected_version integer) returns public.deos_documents language plpgsql security definer set search_path=public as $$
declare v_row public.deos_documents; begin
 if not public.deos_can_write_workspace(public.deos_current_workspace_id()) then raise exception 'FORBIDDEN'; end if;
 update public.deos_documents set deleted_at=timezone('utc',now()), owner_id=auth.uid(), version=version+1 where workspace_id=public.deos_current_workspace_id() and client_id=trim(p_client_id) and deleted_at is null and version=p_expected_version returning * into v_row;
 if v_row.id is null then raise exception 'CONFLICT'; end if; return v_row; end; $$;
create or replace function public.deos_list_documents() returns setof public.deos_documents language sql stable security definer set search_path=public as $$ select * from public.deos_documents where auth.uid() is not null and workspace_id=public.deos_current_workspace_id() and public.deos_is_workspace_member(workspace_id) order by updated_at desc; $$;
revoke all on function public.deos_list_documents() from public; grant execute on function public.deos_list_documents() to authenticated;
revoke all on function public.deos_update_document(text,integer,jsonb) from public; grant execute on function public.deos_update_document(text,integer,jsonb) to authenticated;
revoke all on function public.deos_soft_delete_document(text,integer) from public; grant execute on function public.deos_soft_delete_document(text,integer) to authenticated;
