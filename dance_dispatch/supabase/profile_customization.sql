begin;

alter table public.profiles
  add column if not exists bio text,
  add column if not exists genres text[] not null default '{}';

-- Fail the migration rather than merging accounts if existing values collide.
create unique index if not exists profiles_username_normalized_unique
  on public.profiles (lower(btrim(username))) where username is not null;

-- Auth is authoritative for the confirmed login email.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is distinct from u.email;

create unique index if not exists profiles_email_normalized_unique
  on public.profiles (lower(btrim(email))) where email is not null;

drop policy if exists "Own profile inserts" on public.profiles;
create policy "Own profile inserts" on public.profiles as restrictive for insert to public
  with check (id = auth.uid());
drop policy if exists "Own profile updates" on public.profiles;
create policy "Own profile updates" on public.profiles as restrictive for update to public
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.check_profile_email()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is distinct from (select email from auth.users where id = new.id) then
    raise exception 'Profile email must match the confirmed account email';
  end if;
  return new;
end;
$$;
revoke all on function public.check_profile_email() from public;
drop trigger if exists profiles_check_email on public.profiles;
create trigger profiles_check_email before insert or update of email on public.profiles
  for each row execute function public.check_profile_email();

create or replace function public.sync_auth_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.profiles (id, email, username, full_name)
    values (new.id, new.email, nullif(btrim(new.raw_user_meta_data->>'username'), ''),
      nullif(btrim(new.raw_user_meta_data->>'full_name'), ''))
    on conflict (id) do nothing;
  elsif new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_auth_profile() from public;
drop trigger if exists sync_auth_profile_insert on auth.users;
create trigger sync_auth_profile_insert after insert on auth.users
  for each row execute function public.sync_auth_profile();
drop trigger if exists sync_auth_profile_email on auth.users;
create trigger sync_auth_profile_email after update of email on auth.users
  for each row execute function public.sync_auth_profile();

create or replace function public.profile_email_available(candidate text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and not exists (
    select 1 from public.profiles
    where lower(btrim(email)) = lower(btrim(candidate)) and id <> auth.uid()
  );
$$;
revoke all on function public.profile_email_available(text) from public;
grant execute on function public.profile_email_available(text) to authenticated;

commit;
