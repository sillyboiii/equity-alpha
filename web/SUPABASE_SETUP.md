# Supabase cloud accounts

QNTL's cloud sync uses Supabase (free tier) for magic-link sign-in and two rows of
per-user state: the watchlist and the paper book. Everything degrades gracefully:
until the keys below are set, the Sign in button simply doesn't render and the app
behaves exactly as it did before.

## 1. Create the project (≈5 min)

1. Go to https://supabase.com and create a free project.
2. Open **Project Settings → API** and copy the **Project URL** and the **anon public key**.
3. On Vercel, add them to the project's **Environment Variables**:

   - `NEXT_PUBLIC_SUPABASE_URL` = `https://xxxx.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJ...`

   For local dev, copy `web/.env.example` to `web/.env.local` and fill the same two values.

4. Redeploy / restart the dev server.

## 2. Create the sync table

In the Supabase dashboard, open **SQL Editor** and run:

```sql
create table if not exists public.qntl_sync (
  user_id   uuid not null references auth.users (id) on delete cascade,
  key       text not null,
  value     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.qntl_sync enable row level security;

create policy "users read own sync"
  on public.qntl_sync for select
  using (auth.uid() = user_id);

create policy "users insert own sync"
  on public.qntl_sync for insert
  with check (auth.uid() = user_id);

create policy "users update own sync"
  on public.qntl_sync for update
  using (auth.uid() = user_id);
```

## How it works

- `AuthProvider` wraps the app and listens to Supabase auth state.
- `AuthButton` (header) offers magic-link sign-in; it hides itself when the env vars are absent.
- `CloudSync` pulls the watchlist + book on sign-in, merges with local, and pushes changes
  back whenever localStorage mutates (custom events `qntl:watchlist` and `qntl:book`).

## Notes

- Auth provider needs email (magic link) enabled: **Authentication → Providers → Email → Enable
  "Secure email change" optional**, magic link is on by default.
- The book merge keeps whichever side has more snapshots, so a fresh sign-in won't clobber a
  device that's been rebalancing all week.
