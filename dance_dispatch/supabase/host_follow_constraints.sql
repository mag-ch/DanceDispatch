-- Allow multiple users to follow each host, but only one follow per user and host.
begin;

do $$
declare
  host_attnum smallint;
  constraint_row record;
  index_row record;
begin
  select attnum into strict host_attnum
  from pg_attribute
  where attrelid = 'public."UserFollowedHosts"'::regclass
    and attname = 'host_id' and not attisdropped;

  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public."UserFollowedHosts"'::regclass
      and (
        (contype = 'u' and conkey = array[host_attnum]::smallint[])
        or (contype = 'f' and conkey = array[host_attnum]::smallint[]
            and confrelid = 'public."Venues"'::regclass)
      )
  loop
    execute format('alter table public."UserFollowedHosts" drop constraint %I', constraint_row.conname);
  end loop;

  for index_row in
    select indexrelid::regclass as index_name
    from pg_index
    where indrelid = 'public."UserFollowedHosts"'::regclass
      and indisunique and not indisprimary
      and indnkeyatts = 1 and indkey[0] = host_attnum
      and not exists (select 1 from pg_constraint where conindid = indexrelid)
  loop
    execute format('drop index %s', index_row.index_name);
  end loop;
end;
$$;

create unique index if not exists user_followed_hosts_user_host_key
  on public."UserFollowedHosts" (user_id, host_id);

commit;
