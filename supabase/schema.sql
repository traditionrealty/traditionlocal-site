-- Tradition Local member accounts
-- Run once in Supabase: SQL Editor, New query, paste this file, Run.
-- Safe to run again; it only creates what is missing.

-- 1. One profile row per member, linked to their sign in account
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text,
  phone text,
  area_of_interest text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Tradition Local members. Filled in from the Join form; members edit it on /members.';

-- 2. Lock it down: members can only see and edit their own row
alter table public.profiles enable row level security;

drop policy if exists "Members can read their own profile" on public.profiles;
create policy "Members can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Members can create their own profile" on public.profiles;
create policy "Members can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Members can update their own profile" on public.profiles;
create policy "Members can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Members cannot change their stored email or timestamps through the profile form
revoke update on public.profiles from authenticated;
grant update (first_name, last_name, phone, area_of_interest) on public.profiles to authenticated;

-- 3. Create the profile automatically when someone joins
create or replace function public.handle_new_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name, email, phone, area_of_interest)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'area_of_interest', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_member_created on auth.users;
create trigger on_member_created
  after insert on auth.users
  for each row execute function public.handle_new_member();

-- 4. Keep updated_at current
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
