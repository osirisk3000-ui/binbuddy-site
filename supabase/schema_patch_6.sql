-- BinBuddy schema patch 6: an NFC tap now stays valid for 1 minute (was 3). Run once in Supabase > SQL Editor. Safe to re-run.
-- (If you ran schema_patch_5.sql before this change, this updates the saved setting. To change it later, edit the number of seconds.)
insert into public.app_settings(key,value) values ('nfc_window_seconds','60')
on conflict (key) do update set value = excluded.value;
