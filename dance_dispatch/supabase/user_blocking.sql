-- Run in the Supabase SQL editor before deploying the blocking UI.
-- Public media URLs and signed-out access remain public.
begin;

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public, anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;

drop policy if exists "Manage own blocks" on public.user_blocks;
create policy "Manage own blocks" on public.user_blocks
  for all to authenticated
  using (blocker_id = (select auth.uid()))
  with check (blocker_id = (select auth.uid()));
drop policy if exists "Blocks cannot be updated" on public.user_blocks;
create policy "Blocks cannot be updated" on public.user_blocks as restrictive for update to public
  using (false) with check (false);

-- Only answers whether the current viewer may see an owner.
create or replace function public.can_view_user(owner_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select owner_id is null or auth.uid() is null or not exists (
    select 1 from public.user_blocks
    where blocker_id = owner_id and blocked_id = auth.uid()
  );
$$;
revoke all on function public.can_view_user(uuid) from public;
grant execute on function public.can_view_user(uuid) to anon, authenticated;

create or replace function public.can_follow_user(target_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and target_id is not null and auth.uid() <> target_id
    and not exists (
      select 1 from public.user_blocks
      where (blocker_id = auth.uid() and blocked_id = target_id)
         or (blocker_id = target_id and blocked_id = auth.uid())
    );
$$;
revoke all on function public.can_follow_user(uuid) from public;
grant execute on function public.can_follow_user(uuid) to authenticated;

-- Serialize a block with either direction of a concurrent follow.
create or replace function public.lock_user_relationship()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare a uuid; b uuid;
begin
  if tg_table_name = 'user_blocks' then
    a := new.blocker_id; b := new.blocked_id;
  else
    a := new.user_id; b := new.followed_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(least(a::text, b::text) || ':' || greatest(a::text, b::text), 0));
  if tg_table_name = 'UserFollowUsers' and exists (
    select 1 from public.user_blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  ) then
    raise exception 'Following is unavailable for this user' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.lock_user_relationship() from public;
drop trigger if exists lock_user_relationship on public.user_blocks;
create trigger lock_user_relationship before insert on public.user_blocks
  for each row execute function public.lock_user_relationship();
drop trigger if exists lock_user_relationship on public."UserFollowUsers";
create trigger lock_user_relationship before insert or update on public."UserFollowUsers"
  for each row execute function public.lock_user_relationship();

create or replace function public.remove_blocked_follows()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  delete from public."UserFollowUsers"
  where (user_id = new.blocker_id and followed_id = new.blocked_id)
     or (user_id = new.blocked_id and followed_id = new.blocker_id);
  return new;
end;
$$;
revoke all on function public.remove_blocked_follows() from public;
drop trigger if exists remove_blocked_follows on public.user_blocks;
create trigger remove_blocked_follows after insert on public.user_blocks
  for each row execute function public.remove_blocked_follows();

-- Restrictive policies combine with the existing permissive policies using AND.
drop policy if exists "Block follow inserts" on public."UserFollowUsers";
create policy "Block follow inserts" on public."UserFollowUsers" as restrictive for insert to public
  with check (user_id = auth.uid() and public.can_follow_user(followed_id));
drop policy if exists "Block follow updates" on public."UserFollowUsers";
create policy "Block follow updates" on public."UserFollowUsers" as restrictive for update to public
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_follow_user(followed_id));
drop policy if exists "Block follow deletes" on public."UserFollowUsers";
create policy "Block follow deletes" on public."UserFollowUsers" as restrictive for delete to public
  using (user_id = auth.uid() or followed_id = auth.uid());
drop policy if exists "Users can remove followers" on public."UserFollowUsers";
create policy "Users can remove followers" on public."UserFollowUsers" for delete to authenticated
  using (followed_id = auth.uid());
drop policy if exists "Hide blocked relationships" on public."UserFollowUsers";
create policy "Hide blocked relationships" on public."UserFollowUsers" as restrictive for select to public
  using (public.can_view_user(user_id) and public.can_view_user(followed_id));

drop policy if exists "Hide blockers" on public.profiles;
create policy "Hide blockers" on public.profiles as restrictive for select to public
  using (public.can_view_user(id));
drop policy if exists "Hide blockers" on public."Reviews";
create policy "Hide blockers" on public."Reviews" as restrictive for select to public
  using (public.can_view_user(user_id));
drop policy if exists "Hide blockers" on public."SavedEvents";
create policy "Hide blockers" on public."SavedEvents" as restrictive for select to public
  using (public.can_view_user(user_id));
drop policy if exists "Hide blockers" on public.review_replies;
create policy "Hide blockers" on public.review_replies as restrictive for select to public
  using (public.can_view_user(user_id) and exists (
    select 1 from public."Reviews" r where r.id = review_id
  ));
drop policy if exists "Hide blockers" on public."UserFollowedHosts";
create policy "Hide blockers" on public."UserFollowedHosts" as restrictive for select to public
  using (public.can_view_user(user_id));
drop policy if exists "Hide blockers" on public."UserFollowedVenues";
create policy "Hide blockers" on public."UserFollowedVenues" as restrictive for select to public
  using (public.can_view_user(user_id));
drop policy if exists "Hide blockers" on public.user_badges;
create policy "Hide blockers" on public.user_badges as restrictive for select to public
  using (public.can_view_user(user_id));
drop policy if exists "Hide blockers" on public."UserPoints";
create policy "Hide blockers" on public."UserPoints" as restrictive for select to public
  using (public.can_view_user(user_id));
drop policy if exists "Hide blockers" on public.event_comparisons;
create policy "Hide blockers" on public.event_comparisons as restrictive for select to public
  using (public.can_view_user(user_id));
drop policy if exists "Hide blockers" on public.event_rankings;
create policy "Hide blockers" on public.event_rankings as restrictive for select to public
  using (public.can_view_user(user_id));
drop policy if exists "Hide blockers" on public.user_plans;
create policy "Hide blockers" on public.user_plans as restrictive for select to public
  using (public.can_view_user(user_id));
drop policy if exists "Hide blockers" on public."UserSubmittedFeedback";
create policy "Hide blockers" on public."UserSubmittedFeedback" as restrictive for select to public
  using (public.can_view_user(user_id));
-- Preserve pre-existing unrestricted operations if this table did not have RLS enabled.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.pending_events'::regclass) then
    drop policy if exists "Previously unrestricted access" on public.pending_events;
    create policy "Previously unrestricted access" on public.pending_events for all to public
      using (true) with check (true);
    alter table public.pending_events enable row level security;
  end if;
end;
$$;
drop policy if exists "Hide blockers" on public.pending_events;
create policy "Hide blockers" on public.pending_events as restrictive for select to public
  using (public.can_view_user(created_by));
drop policy if exists "Hide blockers" on public."SharedItems";
create policy "Hide blockers" on public."SharedItems" as restrictive for select to public
  using (public.can_view_user(sender_id));
drop policy if exists "Hide blockers" on public.user_notifications;
create policy "Hide blockers" on public.user_notifications as restrictive for select to public
  using (public.can_view_user(actor_user_id));

commit;
