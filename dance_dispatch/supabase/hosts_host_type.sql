alter table public."Hosts"
  add column if not exists host_type text;

update public."Hosts"
set host_type = 'DJ'
where host_type is null;

alter table public."Hosts"
  alter column host_type set default 'DJ',
  alter column host_type set not null;

alter table public."Hosts"
  drop constraint if exists hosts_host_type_check;
alter table public."Hosts"
  add constraint hosts_host_type_check
  check (host_type in ('DJ', 'Promoter', 'Organizer', 'Teacher', 'Host', 'Judge'));

alter table public.event_hosts
  drop constraint if exists event_hosts_host_type_check;
alter table public.event_hosts
  drop column if exists host_type;
