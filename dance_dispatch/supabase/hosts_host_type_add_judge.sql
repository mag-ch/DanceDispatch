alter table public."Hosts"
  drop constraint if exists hosts_host_type_check;
alter table public."Hosts"
  add constraint hosts_host_type_check
  check (host_type in ('DJ', 'Promoter', 'Organizer', 'Teacher', 'Host', 'Judge'));
