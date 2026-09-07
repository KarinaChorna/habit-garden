# Habit Garden

A cozy, social habit tracker — React + Vite frontend, Supabase for auth, database, and row-level security.

## What's real here

- **Auth**: real email/password accounts via Supabase Auth.
- **Database**: Postgres tables for habits, daily completions, friendships, friend requests, accountability-buddy pairings, messages, and reward/achievement unlocks — see `supabase/schema.sql`.
- **Privacy, enforced at the database layer** (not just hidden in the UI): habits are private by default; a friend can only see the one habit you've explicitly paired with them on; nobody can query anyone else's friend list, not even indirectly — it's blocked by row-level security policies, so it holds even if someone calls the API directly.
- **Realtime**: new messages arrive live via a Supabase Realtime subscription.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. In your project, open **SQL Editor → New query**, paste in the entire contents of `supabase/schema.sql`, and run it. This creates every table, the privacy policies, and the two starter catalogs (cozy-world items and achievements).
3. In **Project Settings → API**, copy your **Project URL** and **anon public key**.

By default Supabase requires email confirmation before a new account can sign in. For faster local testing you can turn this off in **Authentication → Providers → Email → Confirm email**, or just click the confirmation link Supabase emails you.

## 2. Configure the app

```bash
cp .env.example .env
```

Fill in the two values from step 1:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## 3. Run it

```bash
npm install
npm run dev
```

Open the printed local URL, sign up with a username/email/password, and start creating habits. Create a second account (a different browser or an incognito window works well) to test friends, buddy pairing, and messaging between two real accounts.

## How the accountability-buddy handshake works

Because habits are private, one person can never directly read another's habit list to "detect" a shared goal automatically. Instead it's a two-step, consent-based flow — the same pattern as a friend request:

1. You pick one of **your own** habits and send a buddy invitation to a friend (only your habit's name and id ever leave your account).
2. They see the invitation with your habit's name shown in plain text, pick the matching habit from **their own** list, and confirm.
3. Only then does the database link the two habits, and the row-level security policies open up read access to just that one habit (and its completion log) between the two of you — nothing else.

## Project structure

```
supabase/schema.sql     All tables, RLS policies, and starter catalog data
src/lib/supabaseClient.js   Supabase client (reads .env)
src/lib/api.js          Every database query the app makes, in one place
src/AuthPage.jsx         Sign in / sign up screen
src/App.jsx              Everything else: design system, views, and the
                          Garden component that loads data and wires up
                          every interaction to the functions in lib/api.js
```

## Updating an existing project (already ran schema.sql once)

Two things changed since the first version — run these in your SQL Editor if your project predates them:

```sql
-- 1. Fixes a "value out of range for type integer" error when creating tasks
alter table habits alter column sort_order type bigint;

-- 2. Enables signing in with a username instead of an email
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
```

Both are already included in a fresh `supabase/schema.sql` if you're setting up a new project.

## Known simplifications (good next steps)

- Buddy-streak bookkeeping only increments when you complete your habit and your buddy has already completed theirs that day — it doesn't currently decrement retroactively if someone edits a past day.
- The "daily bonus quest" is a single hardcoded quest (send a message to a buddy) rather than a rotating pool — the schema has room to grow this into its own table.
- Seasonal cozy-world items, avatar customization beyond a single emoji, and push notifications aren't wired up yet — `cozy_items` and the notification-preference columns are there to build on.
