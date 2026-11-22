# V4 backend plan (Supabase)

Nothing here is connected yet. Only the public **anon key** ever goes in frontend code; never the service-role key.

## Setup
1. Create a Supabase project. Auth > Providers > Email: enable "Confirm email".
2. Auth > Email Templates: include `{{ .Token }}` in the Confirm signup template so users get a 6-digit code.
3. Frontend: `supabase.auth.signUp({email,password})`, then `verifyOtp({email,token,type:'signup'})`; log in with `signInWithPassword`.
4. Add `supabase-js` (pinned version) and your project URL + anon key to a small `js/config.js`.

## Student ID rule
The barcode only *identifies* an account. Login always needs a password or emailed code. Store the ID in a private table; do not expose emails by ID lookup. Use an Edge Function that emails a one-time code to the account on file when an ID is scanned.

## Schema sketch
```sql
create table profiles(id uuid primary key references auth.users on delete cascade, username text unique not null,
  avatar_url text, points int default 0, items int default 0, streak int default 0, last_scan date, created_at timestamptz default now());
create table private_info(id uuid primary key references auth.users on delete cascade, student_id text unique);
create table scans(id bigserial primary key, user_id uuid references profiles on delete cascade, item text, material text, points int check(points between 1 and 60), created_at timestamptz default now());
create table bins(id serial primary key, name text, type text check(type in('Recycling','Compost','Trash')), lat float8, lng float8, fill_pct int, updated_at timestamptz);
alter table profiles enable row level security; alter table private_info enable row level security; alter table scans enable row level security; alter table bins enable row level security;
create policy "profiles readable" on profiles for select using (true);
create policy "own profile edit" on profiles for update using (auth.uid()=id);   -- restrict points/items edits via column privileges or only via RPC
create policy "own private" on private_info for all using (auth.uid()=id);
create policy "own scans" on scans for select using (auth.uid()=user_id);
create policy "bins readable" on bins for select using (true);
```
Do points updates only in a `security definer` function `record_scan(item,material,points)` that caps points at 60, rate-limits (e.g. 1 scan per 5 s, daily cap), inserts into `scans`, updates `profiles`, and returns global counts for fun facts. A `leaderboard(period)` function sums `scans` by week/month/all-time. Note: the AI runs on the phone, so a determined user could still fake scans; the caps limit the damage.

## Frontend work after setup
Replace local `S`/`save()` in `js/app.js` with Supabase calls; replace `BINS`, `LB`, `RW` sample data with queries; add email/password/code screens; add avatar upload to Supabase Storage.
