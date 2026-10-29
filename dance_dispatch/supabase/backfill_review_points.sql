-- One-off backfill: UserPoints review rows exist, but the matching point_activity_events rows
-- were never written (record_badge_activity failed). Mirror them so user_badge_stats and badges update.
-- Idempotent via dedupe_key (same format as awardPoints: action:userId:entityId).
-- Triggers handle the rest: apply_badge_activity_event -> user_badge_stats -> trg_evaluate_badges_for_user.
-- Adjust the casts if source_id is not text.

begin;

insert into public.point_activity_events (
  user_id, event_type, action_key, points_delta,
  source_table, source_id, metadata, dedupe_key
)
select
  up.user_id, 'activity', up.action, up.points,
  'UserPoints', up.entity_id::text, '{"backfill": true}'::jsonb,
  up.action || ':' || up.user_id || ':' || up.entity_id
from public."UserPoints" up
where up.action = 'review'
  and up.entity_id is not null
  and not exists (
    select 1
    from public.point_activity_events pae
    where pae.dedupe_key = up.action || ':' || up.user_id || ':' || up.entity_id
  );

commit;
