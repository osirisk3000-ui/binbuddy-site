-- BinBuddy schema patch 2 (run once in Supabase > SQL Editor, after schema.sql and schema_patch_1.sql. Safe to re-run).
-- UNTESTED against your project: report any error text.
-- Adds: user-added bin locations (add_bin / delete_my_bin) and the storage read policy that profile photo uploads need.

-- ---------- 1. bins: who added it, when ----------
alter table public.bins add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.bins add column if not exists created_at timestamptz not null default now();
create index if not exists bins_geo on public.bins (lat, lng);

-- ---------- 2. add_bin: the ONLY way users add bins (validated, no duplicates, no daily cap) ----------
create or replace function public.add_bin(p_name text, p_category text, p_lat double precision, p_lng double precision) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); nm text := left(trim(coalesce(p_name,'')),40); new_id int;
begin
  if uid is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  if p_category not in ('Recycling','Compost','Trash') then raise exception 'bad_category' using errcode='22023'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'bad_location' using errcode='22023'; end if;
  -- same kind of bin within about 4 metres counts as a duplicate
  if exists (select 1 from public.bins where category=p_category and abs(lat-p_lat) < 0.00004 and abs(lng-p_lng) < 0.00004) then raise exception 'duplicate_bin' using errcode='23505'; end if;
  if nm = '' then nm := p_category || ' bin'; end if;
  insert into public.bins(name,category,lat,lng,status,created_by) values (nm,p_category,p_lat,p_lng,'unknown',uid) returning id into new_id;
  return jsonb_build_object('id',new_id);
end $$;

create or replace function public.delete_my_bin(p_id int) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  delete from public.bins where id=p_id and created_by=auth.uid();
  if not found then raise exception 'not_yours' using errcode='22023'; end if;
end $$;

revoke all on function public.add_bin(text,text,double precision,double precision), public.delete_my_bin(int) from public, anon, authenticated;
grant execute on function public.add_bin(text,text,double precision,double precision), public.delete_my_bin(int) to authenticated;

-- ---------- 3. profile photos: allow reading objects in the avatars bucket ----------
-- (Uploads that overwrite an existing file also need SELECT. The bucket is public, so this exposes nothing new.)
drop policy if exists "avatar read" on storage.objects;
create policy "avatar read" on storage.objects for select to authenticated using (bucket_id='avatars');
-- make sure the bucket exists (no-op if it already does)
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('avatars','avatars',true,204800,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- ---------- 4. for the id-login Edge Function (it runs as service_role) ----------
grant select on public.private_info to service_role;
