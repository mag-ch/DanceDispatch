-- Role a host plays for a specific event. NULL means a plain "host".
alter table public.event_hosts
  add column if not exists host_type text null;

alter table public.event_hosts
  drop constraint if exists event_hosts_host_type_check;
alter table public.event_hosts
  add constraint event_hosts_host_type_check
  check (host_type is null or host_type in ('DJ', 'promoter', 'organizer', 'teacher'));
