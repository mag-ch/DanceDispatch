-- Apply after user_blocking.sql. Followers may still follow again unless blocked.
begin;

drop policy if exists "Block follow deletes" on public."UserFollowUsers";
create policy "Block follow deletes" on public."UserFollowUsers" as restrictive for delete to public
  using (user_id = auth.uid() or followed_id = auth.uid());

drop policy if exists "Users can remove followers" on public."UserFollowUsers";
create policy "Users can remove followers" on public."UserFollowUsers" for delete to authenticated
  using (followed_id = auth.uid());

commit;
