-- BinBuddy schema patch 3 (run once in Supabase > SQL Editor. Safe to re-run).
-- Removes the 15-bins-per-day limit from add_bin(). Duplicate bins within about 4 m are still rejected.
-- Only needed if you already ran schema_patch_2.sql before this change.

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

revoke all on function public.add_bin(text,text,double precision,double precision) from public, anon, authenticated;
grant execute on function public.add_bin(text,text,double precision,double precision) to authenticated;
