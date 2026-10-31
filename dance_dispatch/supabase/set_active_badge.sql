-- Lets a user choose which unlocked badge is displayed, without granting
-- direct UPDATE access to user_badges.
create or replace function public.set_active_badge(p_badge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.user_badges
    where user_id = auth.uid() and badge_id = p_badge_id
  ) then
    raise exception 'badge not unlocked';
  end if;

  update public.user_badges set active = false
  where user_id = auth.uid() and active;

  update public.user_badges set active = true
  where user_id = auth.uid() and badge_id = p_badge_id;
end;
$$;

revoke all on function public.set_active_badge(uuid) from public, anon;
grant execute on function public.set_active_badge(uuid) to authenticated;

-- At most one active badge per user.
create unique index if not exists user_badges_one_active_per_user
  on public.user_badges (user_id) where active;
