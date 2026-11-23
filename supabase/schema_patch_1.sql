-- BinBuddy schema patch 1: adds my_summary(), used by the app to load your history,
-- material counts and daily/weekly challenge progress in one call.
-- Run once in Supabase > SQL Editor (after schema.sql). Safe to re-run. UNTESTED like schema.sql: report any error text.
create or replace function public.my_summary() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid := auth.uid(); tz text := public.setting('timezone');
  d0 timestamptz := ((now() at time zone tz)::date)::timestamp at time zone tz;
  w0 timestamptz := date_trunc('week', now() at time zone tz) at time zone tz;
begin
  if uid is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  return jsonb_build_object(
    'mats', coalesce((select jsonb_object_agg(material,n) from
        (select i.material, count(*) n from public.scans s join public.items i on i.key=s.item_key where s.user_id=uid group by i.material) t),'{}'::jsonb),
    'today_scans',(select count(*) from public.scans where user_id=uid and created_at>=d0),
    'today_cans',(select count(*) from public.scans where user_id=uid and item_key='aluminum_can' and created_at>=d0),
    'week_plastic',(select count(*) from public.scans s join public.items i on i.key=s.item_key where s.user_id=uid and i.material='Plastic' and s.created_at>=w0),
    'recent', coalesce((select jsonb_agg(r order by r.t desc) from
        (select i.name as item, i.material, s.points, s.created_at as t from public.scans s join public.items i on i.key=s.item_key
         where s.user_id=uid order by s.created_at desc limit 30) r),'[]'::jsonb));
end $$;
revoke all on function public.my_summary() from public, anon, authenticated;
grant execute on function public.my_summary() to authenticated;
