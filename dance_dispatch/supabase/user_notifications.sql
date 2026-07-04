create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  actor_user_id uuid null references auth.users (id) on delete set null,
  type text not null,
  title text not null,
  body text not null,
  href text not null default '/notifications',
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

create index if not exists user_notifications_user_unread_idx
  on public.user_notifications (user_id, is_read, created_at desc);

create or replace function public.set_user_notification_read_state()
returns trigger
language plpgsql
as $$
begin
  if new.is_read then
    new.read_at = coalesce(new.read_at, timezone('utc', now()));
  else
    new.read_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists user_notifications_set_read_state on public.user_notifications;

create trigger user_notifications_set_read_state
before insert or update on public.user_notifications
for each row
execute function public.set_user_notification_read_state();

alter table public.user_notifications enable row level security;

grant select, update on public.user_notifications to authenticated;

drop policy if exists "Users can read their own notifications" on public.user_notifications;
create policy "Users can read their own notifications"
on public.user_notifications
for select
using (auth.uid() = user_id);

drop policy if exists "Users can update their own notifications" on public.user_notifications;
create policy "Users can update their own notifications"
on public.user_notifications
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
