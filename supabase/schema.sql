-- =====================================================================
-- BinBuddy Supabase schema, milestone 1 (UNTESTED: written without a Postgres
-- instance available. Run it in a fresh project and report any error text.)
-- Run in: Supabase Dashboard > SQL Editor > New query > paste all > Run.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / ON CONFLICT where possible.
-- Covers: settings, profiles, private student IDs, item rules, scans, bins,
-- secure record_scan(), leaderboard(), campus_stats(), avatar storage, RLS, grants.
-- NOT included yet: challenges, rewards, redemptions (next milestone).
-- =====================================================================

-- ---------- 0. settings (nobody can read this through the API) ----------
create table if not exists public.app_settings(key text primary key, value text not null);
alter table public.app_settings enable row level security;   -- no policies = API users cannot touch it
insert into public.app_settings(key,value) values
  ('allowed_email_domain','example.edu'),   -- CHANGE to your campus domain, or set to '' to allow any email
  ('timezone','America/Los_Angeles'),       -- CHANGE to your campus timezone (used for "today" and streaks)
  ('min_seconds_between_scans','5'),
  ('daily_scan_cap','40')
on conflict (key) do nothing;

create or replace function public.setting(k text) returns text
language sql stable security definer set search_path='' as
$$ select value from public.app_settings where key=k $$;
revoke all on function public.setting(text) from public, anon, authenticated;

-- ---------- 1. tables ----------
create table if not exists public.profiles(
  id uuid primary key references auth.users on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_ ]{3,20}$'),
  avatar_url text,
  points int not null default 0 check (points >= 0),
  items int not null default 0 check (items >= 0),
  streak int not null default 0 check (streak >= 0),
  last_scan date,
  created_at timestamptz not null default now());
create unique index if not exists profiles_username_ci on public.profiles (lower(username));

create table if not exists public.private_info(
  id uuid primary key references auth.users on delete cascade,
  student_id text unique check (student_id ~ '^[A-Za-z0-9-]{4,20}$'));

-- The recycling rules live here (server side). The AI only names an item; points come from this table.
create table if not exists public.items(
  key text primary key,
  name text not null,
  material text not null check (material in ('Plastic','Glass','Paper','Metal','Compost','Landfill')),
  bin_type text not null check (bin_type in ('Recycling','Compost','Trash')),
  points int not null check (points between 1 and 60),
  tip text not null,
  active boolean not null default true);

create table if not exists public.scans(
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  item_key text not null references public.items,
  points int not null check (points between 1 and 60),
  created_at timestamptz not null default now());
create index if not exists scans_user_time on public.scans (user_id, created_at desc);
create index if not exists scans_time on public.scans (created_at);

create table if not exists public.bins(
  id serial primary key,
  name text not null,
  category text not null check (category in ('Recycling','Compost','Trash')),
  lat double precision, lng double precision,
  fill_pct int check (fill_pct between 0 and 100),
  status text not null default 'unknown',
  updated_at timestamptz not null default now());

-- ---------- 2. seed item rules (same values as RULES in app.js v5) ----------
insert into public.items(key,name,material,bin_type,points,tip) values
('snack_wrapper','Snack wrapper','Landfill','Trash',5,'Wrappers are too thin to recycle. Trash bin.'),
('chip_bag','Chip bag','Landfill','Trash',8,'Foil-lined bags go in the trash.'),
('plastic_bag','Plastic bag','Landfill','Trash',8,'Bags jam machines. Trash, or a store drop-off.'),
('straw','Straw','Landfill','Trash',5,'Too small to recycle. Trash bin.'),
('plastic_cutlery','Plastic cutlery','Landfill','Trash',6,'Trash bin.'),
('styrofoam','Styrofoam','Landfill','Trash',8,'Foam is not recyclable here. Trash bin.'),
('napkin','Napkin','Compost','Compost',10,'Soiled paper goes in compost.'),
('food_scraps','Food scraps','Compost','Compost',25,'Compost bin.'),
('pizza_box','Pizza box','Compost','Compost',15,'Greasy cardboard goes in compost or trash.'),
('paper_cup','Paper cup','Paper','Recycling',15,'Empty it, then recycling or trash per campus rules.'),
('paper','Paper','Paper','Recycling',15,'Keep it dry and clean for paper recycling.'),
('cardboard','Cardboard','Paper','Recycling',25,'Flatten it and put it in recycling.'),
('carton','Carton','Paper','Recycling',30,'Rinse, then recycling.'),
('aluminum_can','Aluminum can','Metal','Recycling',35,'Rinse and put it in recycling.'),
('plastic_bottle','Plastic bottle','Plastic','Recycling',55,'Empty it, cap on, into recycling.'),
('plastic_cup','Plastic cup','Plastic','Recycling',20,'Rinse, then recycling.'),
('plastic_container','Plastic container','Plastic','Recycling',30,'Rinse, then recycling.'),
('glass_bottle','Glass bottle','Glass','Recycling',55,'Rinse, then glass or recycling bin.'),
('glass_jar','Glass jar','Glass','Recycling',50,'Rinse, then glass or recycling bin.')
on conflict (key) do update set name=excluded.name, material=excluded.material, bin_type=excluded.bin_type, points=excluded.points, tip=excluded.tip;

-- ---------- 3. signup guards ----------
-- (a) only allow campus email addresses (and block switching to a non-campus email later)
create or replace function public.enforce_email_domain() returns trigger
language plpgsql security definer set search_path='' as $$
declare d text := lower(coalesce(public.setting('allowed_email_domain'),''));
        host text := lower(split_part(coalesce(new.email,''),'@',2));
begin
  if d <> '' and not (host = d or host like '%.'||d) then
    raise exception 'Please sign up with your campus email address.' using errcode='22023';
  end if;
  return new;
end $$;
drop trigger if exists bb_email_domain_ins on auth.users;
create trigger bb_email_domain_ins before insert on auth.users for each row execute function public.enforce_email_domain();
drop trigger if exists bb_email_domain_upd on auth.users;
create trigger bb_email_domain_upd before update of email on auth.users for each row
  when (new.email is distinct from old.email) execute function public.enforce_email_domain();

-- (b) create the profile row automatically. Username comes from signUp({options:{data:{username}}}).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare u text := trim(coalesce(new.raw_user_meta_data->>'username',''));
begin
  if u !~ '^[A-Za-z0-9_ ]{3,20}$' then u := 'user_'||substr(replace(new.id::text,'-',''),1,8); end if;
  insert into public.profiles(id,username) values (new.id,u);
  insert into public.private_info(id) values (new.id);
  return new;
exception when unique_violation then
  raise exception 'That username is taken.' using errcode='23505';
end $$;
drop trigger if exists bb_new_user on auth.users;
create trigger bb_new_user after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- 4. secure functions ----------
create or replace function public.username_available(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select p_name ~ '^[A-Za-z0-9_ ]{3,20}$' and not exists (select 1 from public.profiles where lower(username)=lower(trim(p_name))) $$;

-- The ONLY way points are awarded. The client sends an item key; the server decides points, caps and streaks.
create or replace function public.record_scan(p_item_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  it public.items%rowtype;
  prof public.profiles%rowtype;
  tz text := public.setting('timezone');
  today date := (now() at time zone public.setting('timezone'))::date;
  day_start timestamptz := ((now() at time zone public.setting('timezone'))::date)::timestamp at time zone public.setting('timezone');
  last_ts timestamptz; n_today int; new_streak int; today_n int;
begin
  if uid is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  select * into it from public.items where key=p_item_key and active;
  if not found then raise exception 'unknown_item' using errcode='22023'; end if;
  select * into prof from public.profiles where id=uid for update;   -- row lock: concurrent calls queue up
  if not found then raise exception 'no_profile' using errcode='22023'; end if;
  select max(created_at) into last_ts from public.scans where user_id=uid;
  if last_ts is not null and now()-last_ts < make_interval(secs => public.setting('min_seconds_between_scans')::int) then
    raise exception 'rate_limited' using errcode='54000'; end if;
  select count(*) into n_today from public.scans where user_id=uid and created_at >= day_start;
  if n_today >= public.setting('daily_scan_cap')::int then raise exception 'daily_cap_reached' using errcode='54000'; end if;

  new_streak := case when prof.last_scan = today then prof.streak
                     when prof.last_scan = today-1 then prof.streak+1 else 1 end;
  insert into public.scans(user_id,item_key,points) values (uid,it.key,it.points);
  update public.profiles set points=points+it.points, items=items+1, streak=new_streak, last_scan=today where id=uid;
  select count(*) into today_n from public.scans where item_key=it.key and created_at >= day_start;

  return jsonb_build_object('item',it.name,'material',it.material,'bin',it.bin_type,'points_awarded',it.points,
    'total_points',prof.points+it.points,'level',(prof.points+it.points)/100+1,'level_up',(prof.points+it.points)/100 > prof.points/100,
    'streak',new_streak,'items',prof.items+1,'item_count_today_campus',today_n);
end $$;

create or replace function public.leaderboard(p_period text default 'week')
returns table(rank bigint, username text, avatar_url text, points bigint, is_me boolean)
language plpgsql stable security definer set search_path='' as $$
declare tz text := public.setting('timezone'); since timestamptz;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  since := case p_period
    when 'week'  then date_trunc('week',  now() at time zone tz) at time zone tz
    when 'month' then date_trunc('month', now() at time zone tz) at time zone tz
    when 'all'   then '-infinity'::timestamptz end;
  if since is null then raise exception 'bad_period' using errcode='22023'; end if;
  return query
    select (row_number() over (order by sum(s.points) desc, p.username))::bigint, p.username, p.avatar_url, sum(s.points)::bigint, (p.id = auth.uid())
    from public.scans s join public.profiles p on p.id = s.user_id
    where s.created_at >= since
    group by p.id, p.username, p.avatar_url
    order by 1 limit 50;
end $$;

-- Real campus numbers only (counted from the scans table). Note: these count ITEMS SCANNED, not verified disposals.
create or replace function public.campus_stats() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tz text := public.setting('timezone');
  d0 timestamptz := ((now() at time zone tz)::date)::timestamp at time zone tz;
  w0 timestamptz := date_trunc('week',  now() at time zone tz) at time zone tz;
  m0 timestamptz := date_trunc('month', now() at time zone tz) at time zone tz;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  return jsonb_build_object(
    'items_today',(select count(*) from public.scans where created_at>=d0),
    'items_week',(select count(*) from public.scans where created_at>=w0),
    'items_month',(select count(*) from public.scans where created_at>=m0),
    'students_active_week',(select count(distinct user_id) from public.scans where created_at>=w0),
    'by_material_month',coalesce((select jsonb_object_agg(material,n) from
       (select i.material, count(*) n from public.scans s join public.items i on i.key=s.item_key where s.created_at>=m0 group by i.material) t),'{}'::jsonb));
end $$;

-- Linking a student ID goes through here so failures are generic (no "is this ID registered?" oracle).
create or replace function public.link_student_id(p_id text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  if p_id !~ '^[A-Za-z0-9-]{4,20}$' then raise exception 'invalid_id' using errcode='22023'; end if;
  update public.private_info set student_id=upper(p_id) where id=auth.uid();
exception when unique_violation then raise exception 'cannot_link' using errcode='22023';
end $$;
create or replace function public.unlink_student_id() returns void
language sql security definer set search_path='' as $$ update public.private_info set student_id=null where id=auth.uid() $$;

-- ---------- 5. row level security ----------
alter table public.profiles     enable row level security;
alter table public.private_info enable row level security;
alter table public.items        enable row level security;
alter table public.scans        enable row level security;
alter table public.bins         enable row level security;

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "own profile edit" on public.profiles;
create policy "own profile edit" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "own private read" on public.private_info;
create policy "own private read" on public.private_info for select to authenticated using (id = auth.uid());
drop policy if exists "items readable" on public.items;
create policy "items readable" on public.items for select to authenticated using (active);
drop policy if exists "own scans read" on public.scans;
create policy "own scans read" on public.scans for select to authenticated using (user_id = auth.uid());
drop policy if exists "bins readable" on public.bins;
create policy "bins readable" on public.bins for select to authenticated using (true);
-- No insert/update/delete policies on scans, items, bins, private_info: writes only happen inside the functions above.

-- ---------- 6. grants (needed because "auto-grant new tables to the API" is OFF) ----------
revoke all on public.profiles, public.private_info, public.items, public.scans, public.bins from anon, authenticated;
grant select on public.profiles, public.private_info, public.items, public.scans, public.bins to authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;   -- points/items/streak can NOT be edited by users

revoke all on function public.username_available(text), public.record_scan(text), public.leaderboard(text),
  public.campus_stats(), public.link_student_id(text), public.unlink_student_id() from public, anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;   -- needed on the signup screen (before login)
grant execute on function public.record_scan(text), public.leaderboard(text), public.campus_stats(),
  public.link_student_id(text), public.unlink_student_id() to authenticated;

-- ---------- 7. avatar storage ----------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('avatars','avatars',true,204800,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "avatar upload own folder" on storage.objects;
create policy "avatar upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar update own folder" on storage.objects;
create policy "avatar update own folder" on storage.objects for update to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar delete own folder" on storage.objects;
create policy "avatar delete own folder" on storage.objects for delete to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
-- (Public bucket: anyone with an avatar's URL can view it. Reads need no policy. Don't store anything private here.)
