-- Points breakdown reference. Keep in sync with POINTS in lib/points.ts and the leaderboard legend.
-- UserPoints.action and point_activity_events.action_key store these keys; total_points in
-- user_badge_stats already sums points_delta, so new actions need no trigger changes.
--
-- If UserPoints has a unique constraint on (user_id, action, entity_id), composite entity ids are used:
--   review_dj    -> '<eventId>:<hostId>'
--   review_venue -> '<eventId>:<venueId>'
--   review_media -> '<eventId>'

create table if not exists public.point_actions (
  action_key  text primary key,
  points      integer not null check (points >= 0),
  description text not null
);

alter table public.point_actions enable row level security;
grant select on public.point_actions to anon, authenticated;

drop policy if exists "Anyone can read point actions" on public.point_actions;
create policy "Anyone can read point actions"
on public.point_actions
for select
to anon, authenticated
using (true);

insert into public.point_actions (action_key, points, description) values
  ('rsvp',         10, 'Save an event'),
  ('share',         5, 'Share an event (per recipient)'),
  ('review',       20, 'Submit a review for an event'),
  ('review_dj',    15, 'Review a DJ/host (per DJ, per event)'),
  ('review_venue', 15, 'Review the venue (per event)'),
  ('review_media', 10, 'Attach photo/video to a review (once per event)'),
  ('referral',     50, 'Refer a new user'),
  ('submit_event', 50, 'Submit an event')
on conflict (action_key) do update
  set points = excluded.points, description = excluded.description;
