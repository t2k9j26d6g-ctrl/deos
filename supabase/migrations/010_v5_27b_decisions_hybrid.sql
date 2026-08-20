-- DEOS V5.27B
-- Synchronisation hybride Decisions.
create extension if not exists pgcrypto;

create or replace function public.deos_decision_payload_is_safe(p_data jsonb)
returns boolean language sql immutable as $$
  select jsonb_typeof(coalesce(p_data, '{}'::jsonb)) = 'object'
    and not (coalesce(p_data, '{}'::jsonb) ?| array['actions','managers','projects','priorities','activity','journal','documents','agenda','folders','performance','meetingPreparations','links','performance_imports','state','settings','remoteSync']);
$$;

create table if not exists public.deos_decisions (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, owner_id uuid not null references auth.users(id) on delete restrict,
  client_id text not null check(length(trim(client_id))>0), data jsonb not null default '{}'::jsonb check(public.deos_decision_payload_is_safe(data)),
  created_at timestamptz not null default timezone('utc',now()), updated_at timestamptz not null default timezone('utc',now()), deleted_at timestamptz null, version integer not null default 1 check(version>=1), unique(workspace_id,client_id)
);
create index if not exists idx_deos_decisions_workspace on public.deos_decisions(workspace_id);
create index if not exists idx_deos_decisions_client_id on public.deos_decisions(client_id);
drop trigger if exists trg_deos_decisions_updated_at on public.deos_decisions;
create trigger trg_deos_decisions_updated_at before update on public.deos_decisions for each row execute function public.deos_set_updated_at();
alter table public.deos_decisions enable row level security;
drop policy if exists deos_decisions_select on public.deos_decisions;
create policy deos_decisions_select on public.deos_decisions for select using(auth.uid() is not null and workspace_id=public.deos_current_workspace_id() and public.deos_is_workspace_member(workspace_id));
drop policy if exists deos_decisions_insert on public.deos_decisions;
create policy deos_decisions_insert on public.deos_decisions for insert with check(auth.uid() is not null and owner_id=auth.uid() and workspace_id=public.deos_current_workspace_id() and public.deos_can_write_workspace(workspace_id) and public.deos_decision_payload_is_safe(data));
drop policy if exists deos_decisions_update on public.deos_decisions;
create policy deos_decisions_update on public.deos_decisions for update using(auth.uid() is not null and workspace_id=public.deos_current_workspace_id() and public.deos_can_write_workspace(workspace_id)) with check(auth.uid() is not null and owner_id=auth.uid() and workspace_id=public.deos_current_workspace_id() and public.deos_can_write_workspace(workspace_id) and public.deos_decision_payload_is_safe(data));

create or replace function public.deos_update_decision(p_client_id text,p_expected_version integer,p_data jsonb) returns public.deos_decisions language plpgsql security definer set search_path=public as $$
declare v_row public.deos_decisions; begin
 if not public.deos_can_write_workspace(public.deos_current_workspace_id()) then raise exception 'FORBIDDEN'; end if;
 if not public.deos_decision_payload_is_safe(p_data) then raise exception 'UNSAFE_PAYLOAD'; end if;
 update public.deos_decisions set data=p_data, owner_id=auth.uid(), version=version+1 where workspace_id=public.deos_current_workspace_id() and client_id=trim(p_client_id) and deleted_at is null and version=p_expected_version returning * into v_row;
 if v_row.id is null then raise exception 'CONFLICT'; end if; return v_row; end; $$;
create or replace function public.deos_soft_delete_decision(p_client_id text,p_expected_version integer) returns public.deos_decisions language plpgsql security definer set search_path=public as $$
declare v_row public.deos_decisions; begin
 if not public.deos_can_write_workspace(public.deos_current_workspace_id()) then raise exception 'FORBIDDEN'; end if;
 update public.deos_decisions set deleted_at=timezone('utc',now()), owner_id=auth.uid(), version=version+1 where workspace_id=public.deos_current_workspace_id() and client_id=trim(p_client_id) and deleted_at is null and version=p_expected_version returning * into v_row;
 if v_row.id is null then raise exception 'CONFLICT'; end if; return v_row; end; $$;
create or replace function public.deos_list_decisions() returns setof public.deos_decisions language sql stable security definer set search_path=public as $$ select * from public.deos_decisions where auth.uid() is not null and workspace_id=public.deos_current_workspace_id() and public.deos_is_workspace_member(workspace_id) order by updated_at desc; $$;
revoke all on function public.deos_list_decisions() from public; grant execute on function public.deos_list_decisions() to authenticated;
revoke all on function public.deos_update_decision(text,integer,jsonb) from public; grant execute on function public.deos_update_decision(text,integer,jsonb) to authenticated;
revoke all on function public.deos_soft_delete_decision(text,integer) from public; grant execute on function public.deos_soft_delete_decision(text,integer) to authenticated;
