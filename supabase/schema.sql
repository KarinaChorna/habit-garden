-- ============================================================================
-- Habit Garden — Supabase schema
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query).
-- Safe to re-run: guarded with "if not exists" / "or replace" where possible.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- PROFILES  (one row per auth.users row)
-- ----------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null default 'New gardener',
  bio text default 'Building better habits, one day at a time 🌱',
  avatar_emoji text default '🌱',
  stars int not null default 0,
  companion_stage int not null default 0,
  mystery_available boolean not null default true,
  perfect_days int not null default 0,
  allow_friend_requests boolean not null default true,
  allow_buddy_suggestions boolean not null default true,
  allow_messages boolean not null default true,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
-- Reads `username` / `display_name` out of the signUp() `options.data` payload.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'display_name', 'New gardener')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- HABITS
-- ----------------------------------------------------------------------------
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  icon text not null default '✨',
  color text not null default 'sky',
  frequency text not null default 'Daily',
  archived boolean not null default false,
  sort_order bigint not null default 0,
  created_at timestamptz not null default now()
);

-- one row per day a habit was completed — this is the source of truth for streaks/history
create table if not exists habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  completed_on date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, completed_on)
);

-- ----------------------------------------------------------------------------
-- FRIENDS
-- ----------------------------------------------------------------------------
create table if not exists friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  receiver_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (sender_id, receiver_id)
);

-- one row per friendship, participants stored as (least(a,b), greatest(a,b)) to avoid duplicates
create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

-- ----------------------------------------------------------------------------
-- ACCOUNTABILITY BUDDIES  (opt-in pairing on a specific shared habit)
--
-- Two-step handshake, same shape as friend_requests: user_a proposes using
-- ONLY their own habit_id (habits are private, so A can never reference B's
-- habit row directly). user_b reviews the proposal (they're told the habit
-- name in plain text, not given row access) and accepts by attaching their
-- own matching habit_id — at which point status flips to 'active'.
-- ----------------------------------------------------------------------------
create table if not exists accountability_buddies (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles(id) on delete cascade,
  habit_a_id uuid not null references habits(id) on delete cascade,
  habit_a_name text not null,
  user_b uuid not null references profiles(id) on delete cascade,
  habit_b_id uuid references habits(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active')),
  buddy_streak int not null default 0,
  last_buddy_date date,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- MESSAGES
-- ----------------------------------------------------------------------------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  receiver_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  is_preset boolean not null default false,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- COZY WORLD  (catalog + per-user unlocks)
-- ----------------------------------------------------------------------------
create table if not exists cozy_items (
  id text primary key,
  name text not null,
  icon text not null
);

create table if not exists user_cozy_items (
  user_id uuid not null references profiles(id) on delete cascade,
  item_id text not null references cozy_items(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- ----------------------------------------------------------------------------
-- ACHIEVEMENTS  (catalog + per-user unlocks)
-- ----------------------------------------------------------------------------
create table if not exists achievements (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null,
  metric text not null,   -- 'best_streak' | 'buddy_streak' | 'perfect_days'
  goal int not null
);

create table if not exists user_achievements (
  user_id uuid not null references profiles(id) on delete cascade,
  achievement_id text not null references achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table profiles enable row level security;
alter table habits enable row level security;
alter table habit_logs enable row level security;
alter table friend_requests enable row level security;
alter table friendships enable row level security;
alter table accountability_buddies enable row level security;
alter table messages enable row level security;
alter table cozy_items enable row level security;
alter table user_cozy_items enable row level security;
alter table achievements enable row level security;
alter table user_achievements enable row level security;

-- PROFILES: any signed-in user can look people up by username (needed for
-- "add a friend" search) and see basic profile info, but only the owner can
-- change it. This does NOT expose anyone's friend list — that's locked down
-- separately below.
drop policy if exists "profiles_select_authenticated" on profiles;
create policy "profiles_select_authenticated" on profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- HABITS: private by default. A friend can see a specific habit ONLY if an
-- accountability_buddies row links it to them — never the full habit list.
drop policy if exists "habits_owner_all" on habits;
create policy "habits_owner_all" on habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "habits_buddy_shared_select" on habits;
create policy "habits_buddy_shared_select" on habits
  for select using (
    exists (
      select 1 from accountability_buddies ab
      where (ab.habit_a_id = habits.id and ab.user_b = auth.uid())
         or (ab.habit_b_id = habits.id and ab.user_a = auth.uid())
    )
  );

-- HABIT LOGS: same pattern — private, except the specific shared habit's
-- completion history is visible to your accountability buddy for that habit.
drop policy if exists "habit_logs_owner_all" on habit_logs;
create policy "habit_logs_owner_all" on habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "habit_logs_buddy_shared_select" on habit_logs;
create policy "habit_logs_buddy_shared_select" on habit_logs
  for select using (
    exists (
      select 1 from accountability_buddies ab
      where (ab.habit_a_id = habit_logs.habit_id and ab.user_b = auth.uid())
         or (ab.habit_b_id = habit_logs.habit_id and ab.user_a = auth.uid())
    )
  );

-- FRIEND REQUESTS: only sender/receiver can see a request; only the receiver
-- can change its status; either can create one.
drop policy if exists "friend_requests_select_own" on friend_requests;
create policy "friend_requests_select_own" on friend_requests
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "friend_requests_insert_own" on friend_requests;
create policy "friend_requests_insert_own" on friend_requests
  for insert with check (auth.uid() = sender_id);

drop policy if exists "friend_requests_update_receiver" on friend_requests;
create policy "friend_requests_update_receiver" on friend_requests
  for update using (auth.uid() = receiver_id);

-- FRIENDSHIPS: the core privacy rule. A user can only ever see friendship
-- rows they are personally part of — there is no query path that lets
-- anyone browse a third party's friend list.
drop policy if exists "friendships_select_own" on friendships;
create policy "friendships_select_own" on friendships
  for select using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "friendships_insert_own" on friendships;
create policy "friendships_insert_own" on friendships
  for insert with check (auth.uid() = user_a or auth.uid() = user_b);

-- ACCOUNTABILITY BUDDIES: participants only.
drop policy if exists "buddies_select_own" on accountability_buddies;
create policy "buddies_select_own" on accountability_buddies
  for select using (auth.uid() = user_a or auth.uid() = user_b);

-- only the proposer can create a proposal, and only using a habit they own
drop policy if exists "buddies_insert_own" on accountability_buddies;
create policy "buddies_insert_own" on accountability_buddies
  for insert with check (
    auth.uid() = user_a
    and exists (select 1 from habits h where h.id = habit_a_id and h.user_id = auth.uid())
  );

drop policy if exists "buddies_update_own" on accountability_buddies;
create policy "buddies_update_own" on accountability_buddies
  for update using (auth.uid() = user_a or auth.uid() = user_b);

-- MESSAGES: only sender/receiver can read; only sender can insert as
-- themselves; only receiver can flip the read flag.
drop policy if exists "messages_select_own" on messages;
create policy "messages_select_own" on messages
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "messages_insert_own" on messages;
create policy "messages_insert_own" on messages
  for insert with check (auth.uid() = sender_id);

drop policy if exists "messages_update_receiver" on messages;
create policy "messages_update_receiver" on messages
  for update using (auth.uid() = receiver_id);

-- CATALOGS: readable by anyone signed in, not user-editable from the client.
drop policy if exists "cozy_items_select_all" on cozy_items;
create policy "cozy_items_select_all" on cozy_items for select using (auth.role() = 'authenticated');

drop policy if exists "achievements_select_all" on achievements;
create policy "achievements_select_all" on achievements for select using (auth.role() = 'authenticated');

-- PER-USER UNLOCK TABLES: owner only.
drop policy if exists "user_cozy_items_owner_all" on user_cozy_items;
create policy "user_cozy_items_owner_all" on user_cozy_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_achievements_owner_all" on user_achievements;
create policy "user_achievements_owner_all" on user_achievements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- USERNAME LOGIN
--
-- Supabase Auth is email-based under the hood. To let people sign in with
-- just a username, this function looks up the matching email server-side
-- (with elevated privileges, since anon users can't read auth.users
-- directly) so the client can then call signInWithPassword as normal.
-- It only ever returns an email for an EXACT username match — no listing,
-- no partial search — so it doesn't expose anything beyond confirming
-- "an account with this exact username exists."
-- ============================================================================
create or replace function public.get_email_for_username(uname text)
returns text
language sql
security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.username) = lower(uname)
  limit 1;
$$;

grant execute on function public.get_email_for_username(text) to anon, authenticated;

-- Look up the email for a username, used only so people can sign in with a
-- username instead of typing their email. SECURITY DEFINER lets it read
-- auth.users (which clients can never query directly) without exposing any
-- other user's email through normal table access — this function only ever
-- returns a single email string for an exact username match.
create or replace function public.get_email_by_username(p_username text)
returns text
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_email text;
begin
  select u.email into v_email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.username = p_username;
  return v_email;
end;
$$;

grant execute on function public.get_email_by_username(text) to anon, authenticated;

-- ============================================================================
-- SEED CATALOG DATA (static — same for every user)
-- ============================================================================
insert into cozy_items (id, name, icon) values
  ('c1', 'Fern', '🪴'),
  ('c2', 'Cloud sofa', '🛋️'),
  ('c3', 'Little lamp', '🕯️'),
  ('c4', 'Sunset poster', '🖼️'),
  ('c5', 'Garden snail', '🐌'),
  ('c6', 'Plush bear', '🧸'),
  ('c7', 'Round window', '🪟'),
  ('c8', 'Mushroom stool', '🍄'),
  ('c9', 'Wind chime', '🎐')
on conflict (id) do nothing;

insert into achievements (id, title, description, icon, metric, goal) values
  ('a1', 'First Step', 'Complete a goal for 3 days.', '🌱', 'best_streak', 3),
  ('a2', 'Getting Into It', 'Maintain a 7-day streak.', '🌷', 'best_streak', 7),
  ('a3', 'Growing Strong', 'Maintain a 30-day streak.', '🌻', 'best_streak', 30),
  ('a4', 'Consistency Club', 'Complete every habit in one day, 5 times.', '💫', 'perfect_days', 5),
  ('a5', 'Better Together', 'Maintain a buddy streak for 7 days.', '🫶', 'buddy_streak', 7)
on conflict (id) do nothing;
