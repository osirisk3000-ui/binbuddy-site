-- BinBuddy schema patch 5: NFC sticker verification (run once in Supabase > SQL Editor, after patches 1-4. Safe to re-run).
-- UNTESTED against your project: report any error text.
-- How it works: every bin can have NFC stickers. Each sticker holds a secret random code (stored on the sticker as a link).
-- Tapping a sticker records a short-lived "check-in" for that person (nfc_checkin). When the "require NFC" switch is ON,
-- record_scan() only awards points if the person has a fresh, unused check-in, and (optionally) the sticker's bin type
-- matches the item's bin type. Each check-in is used up by exactly one scan.

-- ---------- 0. settings (all default to OFF/safe, so nothing changes until you switch it on in the Admin panel) ----------
insert into public.app_settings(key,value) values
  ('require_nfc','off'),            -- 'on' = points need an NFC tap (switch in Admin panel)
  ('nfc_window_seconds','180'),     -- a tap stays valid this long
  ('nfc_match_bin_type','on')       -- 'on' = sticker's bin type must match the item's bin type
on conflict (key) do nothing;

-- ---------- 1. tables (no API access; everything goes through the functions below) ----------
create table if not exists public.nfc_tags(
  id serial primary key,
  code text not null unique check (code ~ '^[a-f0-9]{32}$'),
  bin_id int not null references public.bins(id) on delete cascade,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now());
create index if not exists nfc_tags_bin on public.nfc_tags(bin_id);

create table if not exists public.nfc_checkins(
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tag_id int not null references public.nfc_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  used boolean not null default false);
create index if not exists nfc_checkins_user on public.nfc_checkins(user_id, created_at desc);

alter table public.scans add column if not exists tag_id int references public.nfc_tags(id) on delete set null;

alter table public.nfc_tags enable row level security;
alter table public.nfc_checkins enable row level security;
revoke all on public.nfc_tags, public.nfc_checkins from anon, authenticated;

-- ---------- 2. tapping a sticker ----------
create or replace function public.nfc_checkin(p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); c text; t public.nfc_tags%rowtype; b public.bins%rowtype;
begin
  if uid is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  c := lower(regexp_replace(coalesce(p_code,''),'[^A-Za-z0-9]','','g'));
  if (select count(*) from public.nfc_checkins where user_id=uid and created_at > now()-interval '1 hour') >= 60 then
    raise exception 'rate_limited' using errcode='54000'; end if;
  select * into t from public.nfc_tags where code=c and active;
  if not found then raise exception 'unknown_tag' using errcode='22023'; end if;
  select * into b from public.bins where id=t.bin_id;
  insert into public.nfc_checkins(user_id,tag_id) values (uid,t.id);
  return jsonb_build_object('bin_name',b.name,'category',b.category,'area',b.area);
end $$;

-- anyone signed in can ask whether NFC is currently required (so the app can say so)
create or replace function public.nfc_config() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('required', coalesce(public.setting('require_nfc'),'off')='on') $$;

-- ---------- 3. record_scan: same as before, plus the NFC check ----------
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
  ck public.nfc_checkins%rowtype; tg public.nfc_tags%rowtype; bn public.bins%rowtype; used_tag int := null;
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

  -- NFC check (only when the admin switched "require NFC" on)
  if coalesce(public.setting('require_nfc'),'off') = 'on' then
    select * into ck from public.nfc_checkins
      where user_id=uid and not used
        and created_at > now() - make_interval(secs => coalesce(public.setting('nfc_window_seconds'),'180')::int)
      order by id desc limit 1 for update;
    if not found then raise exception 'nfc_required' using errcode='54000'; end if;
    select * into tg from public.nfc_tags where id=ck.tag_id and active;
    if not found then raise exception 'nfc_required' using errcode='54000'; end if;
    select * into bn from public.bins where id=tg.bin_id;
    if coalesce(public.setting('nfc_match_bin_type'),'on') = 'on' and bn.category is distinct from it.bin_type then
      raise exception 'wrong_bin:%', bn.category using errcode='22023'; end if;
    update public.nfc_checkins set used=true where id=ck.id;
    used_tag := tg.id;
  end if;

  new_streak := case when prof.last_scan = today then prof.streak
                     when prof.last_scan = today-1 then prof.streak+1 else 1 end;
  insert into public.scans(user_id,item_key,points,tag_id) values (uid,it.key,it.points,used_tag);
  update public.profiles set points=points+it.points, items=items+1, streak=new_streak, last_scan=today where id=uid;
  select count(*) into today_n from public.scans where item_key=it.key and created_at >= day_start;

  return jsonb_build_object('item',it.name,'material',it.material,'bin',it.bin_type,'points_awarded',it.points,
    'total_points',prof.points+it.points,'level',(prof.points+it.points)/100+1,'level_up',(prof.points+it.points)/100 > prof.points/100,
    'streak',new_streak,'items',prof.items+1,'item_count_today_campus',today_n);
end $$;

-- ---------- 4. admin tools ----------
create or replace function public.admin_set_require_nfc(p_on boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode='42501'; end if;
  insert into public.app_settings(key,value) values ('require_nfc', case when p_on then 'on' else 'off' end)
  on conflict (key) do update set value=excluded.value;
end $$;

-- the app makes a random code, writes it to the sticker, and only then registers it here
create or replace function public.admin_register_nfc_tag(p_bin_id int, p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare new_id int;
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode='42501'; end if;
  if p_code is null or p_code !~ '^[a-f0-9]{32}$' then raise exception 'bad_code' using errcode='22023'; end if;
  if not exists (select 1 from public.bins where id=p_bin_id) then raise exception 'no_such_bin' using errcode='22023'; end if;
  if (select count(*) from public.nfc_tags where bin_id=p_bin_id) >= 10 then raise exception 'too_many_tags' using errcode='54000'; end if;
  insert into public.nfc_tags(code,bin_id,created_by) values (p_code,p_bin_id,auth.uid()) returning id into new_id;
  return jsonb_build_object('id',new_id);
exception when unique_violation then raise exception 'bad_code' using errcode='22023';
end $$;

create or replace function public.admin_list_nfc_tags(p_bin_id int) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare b public.bins%rowtype;
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode='42501'; end if;
  select * into b from public.bins where id=p_bin_id;
  return jsonb_build_object(
    'bin', jsonb_build_object('name',b.name,'category',b.category,'area',b.area),
    'tags', coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'tail',right(t.code,6),'created_at',t.created_at,
              'uses',(select count(*) from public.scans s where s.tag_id=t.id)) order by t.id)
            from public.nfc_tags t where t.bin_id=p_bin_id),'[]'::jsonb));
end $$;

create or replace function public.admin_delete_nfc_tag(p_id int) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode='42501'; end if;
  delete from public.nfc_tags where id=p_id;
end $$;

revoke all on function public.nfc_checkin(text), public.nfc_config(), public.admin_set_require_nfc(boolean),
  public.admin_register_nfc_tag(int,text), public.admin_list_nfc_tags(int), public.admin_delete_nfc_tag(int) from public, anon, authenticated;
grant execute on function public.nfc_checkin(text), public.nfc_config(), public.admin_set_require_nfc(boolean),
  public.admin_register_nfc_tag(int,text), public.admin_list_nfc_tags(int), public.admin_delete_nfc_tag(int) to authenticated;
