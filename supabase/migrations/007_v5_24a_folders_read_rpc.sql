-- DEOS V5.24A
-- Lecture distante robuste des Dossiers via RPC dédiée.
-- Cette migration ne modifie aucune donnée métier existante.

create or replace function public.deos_list_folders()
returns setof public.deos_folders
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
      from public.deos_folders p
     where p.workspace_id = v_workspace_id
     order by p.updated_at desc;
end;
$$;

revoke all on function public.deos_list_folders() from public;
grant execute on function public.deos_list_folders() to authenticated;

comment on function public.deos_list_folders() is
  'Liste les Dossiers du workspace actif de l utilisateur authentifie. V5.24A.';

-- Force PostgREST à rafraîchir son cache de schéma après création de la RPC.
notify pgrst, 'reload schema';
