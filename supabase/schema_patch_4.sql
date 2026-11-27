-- BinBuddy schema patch 4 (run once in Supabase > SQL Editor, after patches 1-3. Safe to re-run).
-- UNTESTED against your project: report any error text.
-- Adds:
--   * an admin (osiris.k3000@gmail.com) who can see users and give people permission to add bins
--   * profiles.can_add_bins  (nobody can add bins unless this is true, or they are the admin)
--   * buildings + floors, and inside/outside bins (a bin on a floor is "inside")
--   * student ID cleanup so scanned barcodes match the linked ID (spaces, * etc. are ignored)

-- ---------- 0. who is the admin ----------
-- To change the admin email later, edit the email in is_admin() below and run this file again.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select exists (select 1 from auth.users u
                 where u.id = auth.uid() and lower(u.email) = 'osiris.k3000@gmail.com' and u.email_confirmed_at is not null) $$;

-- The admin account must be able to sign up even if your campus-email rule would block gmail.
create or replace function public.enforce_email_domain() returns trigger
language plpgsql security definer set search_path='' as $$
declare d text := lower(coalesce(public.setting('allowed_email_domain'),''));
        host text := lower(split_part(coalesce(new.email,''),'@',2));
begin
  if lower(coalesce(new.email,'')) = 'osiris.k3000@gmail.com' then return new; end if;
  if d <> '' and not (host = d or host like '%.'||d) then
    raise exception 'Please sign up with your campus email address.' using errcode='22023';
  end if;
  return new;
end $$;

-- ---------- 1. permission to add bins ----------
alter table public.profiles add column if not exists can_add_bins boolean not null default false;
-- (users can only update username/avatar_url, so they can never switch this on themselves)

create or replace function public.can_edit_bins() returns boolean
language sql stable security definer set search_path='' as $$
  select public.is_admin() or coalesce((select can_add_bins from public.profiles where id = auth.uid()), false) $$;

create or replace function public.my_perms() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('admin', public.is_admin(), 'can_add', coalesce((select can_add_bins from public.profiles where id = auth.uid()), false)) $$; -- can_add is the person's own flag; the app adds "admin + Admin mode on" itself

-- ---------- 2. buildings and floors ----------
create table if not exists public.buildings(
  id serial primary key,
  name text not null check (char_length(name) between 1 and 60),
  lat double precision not null, lng double precision not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now());

create table if not exists public.floors(
  id serial primary key,
  building_id int not null references public.buildings(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 20),
  level int not null default 0,
  closed boolean not null default false,
  created_at timestamptz not null default now());
create unique index if not exists floors_unique_label on public.floors (building_id, lower(label));

alter table public.bins add column if not exists area text not null default 'outside';
alter table public.bins drop constraint if exists bins_area_chk;
alter table public.bins add constraint bins_area_chk check (area in ('outside','inside'));
alter table public.bins add column if not exists building_id int references public.buildings(id) on delete cascade;
alter table public.bins add column if not exists floor_id int references public.floors(id) on delete cascade;
create index if not exists bins_floor on public.bins (floor_id);

alter table public.buildings enable row level security;
alter table public.floors    enable row level security;
drop policy if exists "buildings readable" on public.buildings;
create policy "buildings readable" on public.buildings for select to authenticated using (true);
drop policy if exists "floors readable" on public.floors;
create policy "floors readable" on public.floors for select to authenticated using (true);
revoke all on public.buildings, public.floors from anon, authenticated;
grant select on public.buildings, public.floors to authenticated;
grant select on public.bins to authenticated;

-- ---------- 3. add_bin: now needs permission, and can target a floor (inside) ----------
drop function if exists public.add_bin(text,text,double precision,double precision);
create or replace function public.add_bin(p_name text, p_category text, p_lat double precision, p_lng double precision, p_floor_id int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); nm text := left(trim(coalesce(p_name,'')),40); new_id int;
        fl public.floors%rowtype; bd public.buildings%rowtype; la double precision := p_lat; ln double precision := p_lng; ar text := 'outside';
begin
  if uid is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  if not public.can_edit_bins() then raise exception 'not_allowed' using errcode='42501'; end if;
  if p_category not in ('Recycling','Compost','Trash') then raise exception 'bad_category' using errcode='22023'; end if;
  if p_floor_id is not null then
    select * into fl from public.floors where id = p_floor_id;
    if not found then raise exception 'bad_floor' using errcode='22023'; end if;
    select * into bd from public.buildings where id = fl.building_id;
    la := bd.lat; ln := bd.lng; ar := 'inside';
  else
    if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'bad_location' using errcode='22023'; end if;
    -- same kind of OUTSIDE bin within about 4 metres counts as a duplicate
    if exists (select 1 from public.bins where area='outside' and category=p_category and abs(lat-p_lat) < 0.00004 and abs(lng-p_lng) < 0.00004) then raise exception 'duplicate_bin' using errcode='23505'; end if;
  end if;
  if nm = '' then nm := p_category || ' bin'; end if;
  insert into public.bins(name,category,lat,lng,status,created_by,area,building_id,floor_id)
    values (nm,p_category,la,ln,'unknown',uid,ar,bd.id,fl.id) returning id into new_id;
  return jsonb_build_object('id',new_id);
end $$;

-- admin can delete any bin; people with permission can delete their own
create or replace function public.delete_my_bin(p_id int) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  if public.is_admin() then
    delete from public.bins where id = p_id;
  else
    delete from public.bins where id = p_id and created_by = auth.uid() and public.can_edit_bins();
  end if;
  if not found then raise exception 'not_yours' using errcode='22023'; end if;
end $$;

-- ---------- 4. admin: people ----------
create or replace function public.admin_list_users() returns table(id uuid, username text, email text, points int, can_add_bins boolean, joined timestamptz, bins_added bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode='42501'; end if;
  return query
    select p.id, p.username, u.email::text, p.points, p.can_add_bins, p.created_at,
           (select count(*) from public.bins b where b.created_by = p.id)
    from public.profiles p join auth.users u on u.id = p.id
    order by lower(p.username) limit 1000;
end $$;

create or replace function public.admin_set_can_add(p_user uuid, p_allowed boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode='42501'; end if;
  update public.profiles set can_add_bins = coalesce(p_allowed,false) where id = p_user;
  if not found then raise exception 'no_such_user' using errcode='22023'; end if;
end $$;

-- ---------- 5. admin: buildings and floors ----------
create or replace function public.admin_add_building(p_name text, p_lat double precision, p_lng double precision) returns jsonb
language plpgsql security definer set search_path='' as $$
declare nm text := left(trim(coalesce(p_name,'')),60); new_id int;
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode='42501'; end if;
  if nm = '' then raise exception 'bad_name' using errcode='22023'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'bad_location' using errcode='22023'; end if;
  if exists (select 1 from public.buildings where abs(lat-p_lat) < 0.00005 and abs(lng-p_lng) < 0.00005) then raise exception 'duplicate_building' using errcode='23505'; end if;
  insert into public.buildings(name,lat,lng,created_by) values (nm,p_lat,p_lng,auth.uid()) returning id into new_id;
  return jsonb_build_object('id',new_id);
end $$;

create or replace function public.admin_rename_building(p_id int, p_name text) returns void
language plpgsql security definer set search_path='' as $$
declare nm text := left(trim(coalesce(p_name,'')),60);
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode='42501'; end if;
  if nm = '' then raise exception 'bad_name' using errcode='22023'; end if;
  update public.buildings set name = nm where id = p_id;
end $$;

-- deletes the building, its floors and every inside bin on them
create or replace function public.admin_delete_building(p_id int) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode='42501'; end if;
  delete from public.buildings where id = p_id;
end $$;

create or replace function public.admin_add_floor(p_building int, p_label text, p_level int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare lb text := left(trim(coalesce(p_label,'')),20); lv int; new_id int;
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode='42501'; end if;
  if lb = '' then raise exception 'bad_name' using errcode='22023'; end if;
  if not exists (select 1 from public.buildings where id = p_building) then raise exception 'bad_building' using errcode='22023'; end if;
  lv := coalesce(p_level, (select coalesce(max(level),0)+1 from public.floors where building_id = p_building));
  insert into public.floors(building_id,label,level) values (p_building,lb,lv) returning id into new_id;
  return jsonb_build_object('id',new_id);
exception when unique_violation then
  raise exception 'duplicate_floor' using errcode='23505';
end $$;

-- deletes the floor and every inside bin on it
create or replace function public.admin_delete_floor(p_id int) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode='42501'; end if;
  delete from public.floors where id = p_id;
end $$;

-- mark a floor/area closed: the app warns people that its trash cans may not be reachable
create or replace function public.admin_set_floor_closed(p_id int, p_closed boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode='42501'; end if;
  update public.floors set closed = coalesce(p_closed,false) where id = p_id;
end $$;

-- ---------- 6. student ID linking: ignore spaces, asterisks and other scanner extras ----------
create or replace function public.link_student_id(p_id text) returns void
language plpgsql security definer set search_path='' as $$
declare v text := regexp_replace(upper(coalesce(p_id,'')), '[^A-Z0-9-]', '', 'g');
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  if v !~ '^[A-Z0-9-]{4,20}$' then raise exception 'invalid_id' using errcode='22023'; end if;
  update public.private_info set student_id = v where id = auth.uid();
exception when unique_violation then raise exception 'cannot_link' using errcode='22023';
end $$;

-- ---------- 7. grants ----------
revoke all on function public.is_admin(), public.can_edit_bins() from public, anon, authenticated;
revoke all on function public.my_perms(), public.add_bin(text,text,double precision,double precision,int), public.delete_my_bin(int),
  public.admin_list_users(), public.admin_set_can_add(uuid,boolean),
  public.admin_add_building(text,double precision,double precision), public.admin_rename_building(int,text), public.admin_delete_building(int),
  public.admin_add_floor(int,text,int), public.admin_delete_floor(int), public.admin_set_floor_closed(int,boolean),
  public.link_student_id(text) from public, anon, authenticated;
grant execute on function public.my_perms(), public.add_bin(text,text,double precision,double precision,int), public.delete_my_bin(int),
  public.admin_list_users(), public.admin_set_can_add(uuid,boolean),
  public.admin_add_building(text,double precision,double precision), public.admin_rename_building(int,text), public.admin_delete_building(int),
  public.admin_add_floor(int,text,int), public.admin_delete_floor(int), public.admin_set_floor_closed(int,boolean),
  public.link_student_id(text) to authenticated;
