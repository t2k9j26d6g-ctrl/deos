-- DEOS V5.25A
-- Lecture distante robuste des Managers via RPC dédiée.
-- Cette migration ne modifie aucune donnée métier existante.

create or replace function public.deos_list_managers()
returns setof public.deos_managers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid := public.deos_current_workspace_id();
begin
  if auth.uid() is null then
    raise exception using message = 'AUTH_REQUIRED';
  end if;
  if v_workspace_id is null then
    raise exception using message = 'WORKSPACE_REQUIRED';
  end if;
  if not public.deos_is_workspace_member(v_workspace_id) then
    raise exception using message = 'FORBIDDEN';
  end if;

  return query
    select m.*
      from public.deos_managers m
     where m.workspace_id = v_workspace_id
     order by m.updated_at desc;
end;
$$;

revoke all on function public.deos_list_managers() from public;
grant execute on function public.deos_list_managers() to authenticated;

comment on function public.deos_list_managers() is
  'Liste les Managers du workspace actif de l utilisateur authentifie. V5.25A.';

notify pgrst, 'reload schema';
