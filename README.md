# Habit Garden

A cozy, social habit tracker built with **React, Vite, and Supabase**.

## Features

* **Authentication** — Email/password accounts with Supabase Auth
* **Habits** — Create habits and track daily completions
* **Friends** — Send friend requests and connect with other users
* **Accountability buddies** — Pair habits with a friend to stay accountable
* **Messaging** — Real-time messaging with Supabase Realtime
* **Rewards** — Unlock achievements and cozy-world items
* **Privacy** — Habits and friend data are protected with Supabase Row Level Security (RLS)

## Setup

### 1. Create a Supabase project

1. Create a free project at [Supabase](https://supabase.com/?utm_source=chatgpt.com).
2. Open **SQL Editor → New query**.
3. Copy and run `supabase/schema.sql`.
4. Go to **Project Settings → API** and copy your:

   * Project URL
   * Anon public key

For local testing, you can disable email confirmation under **Authentication → Providers → Email**, or confirm your account through the email Supabase sends you.

### 2. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Then add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 3. Run the app

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal.

To test social features, create a second account using another browser or an incognito window.

## Accountability Buddies

Accountability pairing uses a two-step consent process:

1. Choose one of your habits and send a buddy invitation to a friend.
2. Your friend chooses one of their own habits and confirms the pairing.
3. The two habits are linked, allowing each person to see only the paired habit and its completion history.

Other habits remain private.

## Project Structure

```text
supabase/schema.sql          Database tables, RLS policies, and starter data
src/lib/supabaseClient.js    Supabase client configuration
src/lib/api.js               Database queries and API functions
src/AuthPage.jsx             Sign in / sign up page
src/App.jsx                  Main application and UI
```

## Updating an Existing Project

If you already ran an older version of `schema.sql`, run the latest `supabase/schema.sql` updates in the Supabase SQL Editor.

New projects can simply run the current `schema.sql` from the beginning.
