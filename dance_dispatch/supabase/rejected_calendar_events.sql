-- Apply before deploying the calendar rejection and sync changes.
begin;

create table if not exists public.rejected_calendar_events (
  google_cal_id text primary key check (length(btrim(google_cal_id)) > 0),
  rejected_at timestamptz not null default now()
);

alter table public.rejected_calendar_events enable row level security;
revoke all on public.rejected_calendar_events from public, anon, authenticated;
revoke delete on public.rejected_calendar_events from service_role;
grant select, insert on public.rejected_calendar_events to service_role;

-- Orphans have no local event to approve. Preserve their original timestamps.
insert into public.rejected_calendar_events (google_cal_id, rejected_at)
select google_cal_id, coalesce(min(created_at), now())
from public.pending_events
where event_id is null and google_cal_id is not null and length(btrim(google_cal_id)) > 0
group by google_cal_id
on conflict (google_cal_id) do nothing;

delete from public.pending_events
where event_id is null and google_cal_id is not null and length(btrim(google_cal_id)) > 0;

-- Both operations serialize on the same calendar ID, including when no event exists yet.
create or replace function public.reject_pending_event(p_event_id bigint)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $$
declare
  calendar_id text;
  pending_exclude boolean;
begin
  select coalesce(e.google_cal_id, p.google_cal_id) into calendar_id
  from public."Events" e left join public.pending_events p on p.event_id = e.id
  where e.id = p_event_id;
  if calendar_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(calendar_id, 0));
  end if;

  select p.exclude into pending_exclude
  from public.pending_events p
  join public."Events" e on e.id = p.event_id
  where e.id = p_event_id
  for update of p, e;
  if not found or pending_exclude is distinct from false then
    return false;
  end if;

  if calendar_id is not null and length(btrim(calendar_id)) > 0 then
    insert into public.rejected_calendar_events (google_cal_id)
    values (calendar_id)
    on conflict (google_cal_id) do nothing;
  end if;

  delete from public."Events" where id = p_event_id;
  return true;
end;
$$;

-- Remove the earlier restore-capable overload if this migration was already applied.
drop function if exists public.import_google_calendar_event(jsonb, bigint[], boolean);

create or replace function public.import_google_calendar_event(
  p_event jsonb,
  p_host_ids bigint[]
)
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  calendar_id text := p_event->>'google_cal_id';
  new_event_id bigint;
begin
  if calendar_id is null or length(btrim(calendar_id)) = 0 then
    raise exception 'Google Calendar ID is required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(calendar_id, 0));

  if exists (select 1 from public.rejected_calendar_events where google_cal_id = calendar_id) then
    return 'excluded';
  end if;

  if exists (select 1 from public."Events" where google_cal_id = calendar_id)
     or exists (select 1 from public.pending_events where google_cal_id = calendar_id) then
    return 'existing';
  end if;

  insert into public."Events" (google_cal_id, title, start, "end", location, description, flyer_url, price, external_url)
  values (
    calendar_id, p_event->>'title', (p_event->>'start')::timestamptz,
    (p_event->>'end')::timestamptz, (p_event->>'location')::bigint,
    p_event->>'description', null, null, p_event->>'external_url'
  ) returning id into new_event_id;

  insert into public.pending_events (google_cal_id, event_id, exclude)
  values (calendar_id, new_event_id, false);

  insert into public.event_hosts (event_id, host_id)
  select new_event_id, host_id from (select distinct unnest(p_host_ids) as host_id) hosts;
  return 'inserted';
end;
$$;

revoke all on function public.reject_pending_event(bigint) from public, anon, authenticated;
revoke all on function public.import_google_calendar_event(jsonb, bigint[]) from public, anon, authenticated;
grant execute on function public.reject_pending_event(bigint) to service_role;
grant execute on function public.import_google_calendar_event(jsonb, bigint[]) to service_role;

commit;
