-- Badge system functions, snapshotted from the Supabase project.
--
-- Bodies are copied verbatim from the live database. Parameter types, return types and the
-- trigger bindings were NOT available and are inferred (marked "VERIFY"). Before running this
-- file against a database, compare with the live definitions:
--   select pg_get_functiondef(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('apply_badge_activity_event','record_badge_activity',
--                       'evaluate_badges_for_user','trg_evaluate_badges_for_user',
--                       'trg_backfill_badge_requirement');
--   select pg_get_triggerdef(oid) from pg_trigger where not tgisinternal
--     and tgrelid in ('public.point_activity_events'::regclass,
--                     'public.user_badge_stats'::regclass,
--                     'public.badge_requirements'::regclass);
--
-- Tables referenced (definitions not captured here): point_activity_events, user_badge_stats,
-- user_badges, badge_requirements, badges.
--
-- Valid badge_requirements.requirement_type values (must match evaluate_badges_for_user's CASE,
-- otherwise the comparison is NULL and the badge silently never unlocks):
--   points_total, reviews_count, rsvps_count, referrals_count, share_count, submit_event_count

-- Guard against misspelled requirement types (e.g. singular review_count).
-- Fix existing rows first:
--   update public.badge_requirements set requirement_type = 'reviews_count'   where requirement_type = 'review_count';
--   update public.badge_requirements set requirement_type = 'rsvps_count'     where requirement_type = 'rsvp_count';
--   update public.badge_requirements set requirement_type = 'referrals_count' where requirement_type = 'referral_count';
alter table public.badge_requirements
  drop constraint if exists badge_requirements_type_check;
alter table public.badge_requirements
  add constraint badge_requirements_type_check
  check (requirement_type in (
    'points_total', 'reviews_count', 'rsvps_count',
    'referrals_count', 'share_count', 'submit_event_count'
  ));

-- Trigger function on point_activity_events (AFTER INSERT, VERIFY).
create or replace function public.apply_badge_activity_event()
returns trigger
language plpgsql
as $$
begin
  insert into public.user_badge_stats (user_id)
  values (new.user_id)
  on conflict (user_id) do nothing;

  update public.user_badge_stats
  set
    total_points       = total_points + greatest(new.points_delta, 0),
    rsvp_count         = rsvp_count         + case when new.action_key = 'rsvp'         then 1 else 0 end,
    review_count       = review_count       + case when new.action_key = 'review'       then 1 else 0 end,
    referral_count     = referral_count     + case when new.action_key = 'referral'     then 1 else 0 end,
    share_count        = share_count        + case when new.action_key = 'share'        then 1 else 0 end,
    submit_event_count = submit_event_count + case when new.action_key = 'submit_event' then 1 else 0 end
  where user_id = new.user_id;

  return new;
end;
$$;

-- RPC called by lib/points.ts (VERIFY parameter types and defaults).
-- Execute is granted to authenticated in record_badge_activity_permissions.sql.
create or replace function public.record_badge_activity(
  p_user_id uuid,
  p_action_key text,
  p_points_delta integer,
  p_source_table text,
  p_source_id text,
  p_dedupe_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.point_activity_events (
    user_id, event_type, action_key, points_delta,
    source_table, source_id, metadata, dedupe_key
  )
  values (
    p_user_id, 'activity', p_action_key, coalesce(p_points_delta, 0),
    p_source_table, p_source_id, coalesce(p_metadata, '{}'::jsonb), p_dedupe_key
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Unlocks every badge whose requirement the user's stats satisfy (VERIFY signature).
create or replace function public.evaluate_badges_for_user(
  p_user_id uuid,
  p_changed_types text[] default null
)
returns void
language plpgsql
as $$
declare
  v_stats public.user_badge_stats%rowtype;
begin
  select * into v_stats from public.user_badge_stats where user_id = p_user_id;
  if not found then return; end if;

  insert into public.user_badges (user_id, badge_id, unlock_source)
  select p_user_id, br.badge_id, 'auto_rule'
  from public.badge_requirements br
  where (p_changed_types is null or br.requirement_type = any(p_changed_types))
    and case br.requirement_type
          when 'points_total'        then v_stats.total_points
          when 'reviews_count'       then v_stats.review_count
          when 'rsvps_count'         then v_stats.rsvp_count
          when 'referrals_count'     then v_stats.referral_count
          when 'share_count'         then v_stats.share_count
          when 'submit_event_count'  then v_stats.submit_event_count
        end >= br.min_value
  on conflict (user_id, badge_id) do nothing;
end;
$$;

-- Trigger function on user_badge_stats (AFTER INSERT OR UPDATE, VERIFY).
create or replace function public.trg_evaluate_badges_for_user()
returns trigger
language plpgsql
as $$
declare
  v_changed text[];
begin
  if tg_op = 'UPDATE' then
    v_changed := array_remove(array[
      case when new.total_points       is distinct from old.total_points       then 'points_total'        end,
      case when new.review_count       is distinct from old.review_count       then 'reviews_count'       end,
      case when new.rsvp_count         is distinct from old.rsvp_count         then 'rsvps_count'         end,
      case when new.referral_count     is distinct from old.referral_count     then 'referrals_count'     end,
      case when new.share_count        is distinct from old.share_count        then 'share_count'         end,
      case when new.submit_event_count is distinct from old.submit_event_count then 'submit_event_count' end
    ], null);

    if cardinality(v_changed) = 0 then
      return new;
    end if;
  end if;

  perform public.evaluate_badges_for_user(new.user_id, v_changed);
  return new;
end;
$$;

-- Trigger function on badge_requirements (AFTER INSERT, VERIFY): grants a new badge to existing users.
create or replace function public.trg_backfill_badge_requirement()
returns trigger
language plpgsql
as $$
begin
  insert into public.user_badges (user_id, badge_id, unlock_source)
  select s.user_id, new.badge_id, 'auto_rule'
  from public.user_badge_stats s
  where case new.requirement_type
          when 'points_total'        then s.total_points
          when 'reviews_count'       then s.review_count
          when 'rsvps_count'         then s.rsvp_count
          when 'referrals_count'     then s.referral_count
          when 'share_count'         then s.share_count
          when 'submit_event_count'  then s.submit_event_count
        end >= new.min_value
  on conflict (user_id, badge_id) do nothing;

  return new;
end;
$$;
