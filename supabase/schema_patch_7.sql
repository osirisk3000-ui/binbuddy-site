-- BinBuddy schema patch 7: lets the admin re-show / print a sticker's QR code later (run once after patch 5. Safe to re-run).
-- The admin list now also returns each sticker's code (admin only). Players never see codes.
create or replace function public.admin_list_nfc_tags(p_bin_id int) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare b public.bins%rowtype;
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode='42501'; end if;
  select * into b from public.bins where id=p_bin_id;
  return jsonb_build_object(
    'bin', jsonb_build_object('name',b.name,'category',b.category,'area',b.area),
    'tags', coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'tail',right(t.code,6),'code',t.code,'created_at',t.created_at,
              'uses',(select count(*) from public.scans s where s.tag_id=t.id)) order by t.id)
            from public.nfc_tags t where t.bin_id=p_bin_id),'[]'::jsonb));
end $$;
