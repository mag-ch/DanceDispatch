-- Allow signed-in users to call the badge activity RPC.
-- Scope the grant to this function only; its argument signature may evolve.
do $grant_record_badge_activity$
declare
  function_oid oid;
  function_found boolean := false;
begin
  for function_oid in
    select procedure.oid
    from pg_proc as procedure
    join pg_namespace as schema on schema.oid = procedure.pronamespace
    where schema.nspname = 'public'
      and procedure.proname = 'record_badge_activity'
      and procedure.prokind = 'f'
  loop
    function_found := true;
    execute format(
      'grant execute on function %s to authenticated',
      function_oid::regprocedure
    );
  end loop;

  if not function_found then
    raise exception 'public.record_badge_activity function was not found';
  end if;
end
$grant_record_badge_activity$;