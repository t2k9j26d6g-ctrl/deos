-- DEOS V5.23B
-- Lecture distante robuste des Projets via RPC dédiée.
-- Cette migration ne modifie aucune donnée métier existante.

create or replace function public.deos_list_projects()
returns setof public.deos_projects
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
    select p.*
      from public.deos_projects p
     where p.workspace_id = v_workspace_id
     order by p.updated_at desc;
end;
$$;

revoke all on function public.deos_list_projects() from public;
grant execute on function public.deos_list_projects() to authenticated;

comment on function public.deos_list_projects() is
  'Liste les Projets du workspace actif de l utilisateur authentifie. V5.23B.';

-- Force PostgREST à rafraîchir son cache de schéma après création de la RPC.
notify pgrst, 'reload schema';
