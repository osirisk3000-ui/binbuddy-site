# BinBuddy Supabase setup (milestone 1: backend only)

Status: schema.sql ran without errors on your project, but I could not test it myself, so real-world testing of the site (below) is how we find problems. The v6 site is connected to Supabase.

## 1. Create the project
1. supabase.com > New project. Save the database password in a password manager. Never send it to anyone, including me.
2. Project Settings > Data API (or Integrations > Data API): Data API **ON**, "Grant API access to new tables automatically" **OFF**, "Enable RLS automatically" **ON** (your earlier choices; schema.sql assumes them).

## 2. Edit two settings in schema.sql before running
Near the top, change `example.edu` to your campus email domain (or `''` to allow any email) and `America/Los_Angeles` to your campus timezone. You can change them later with:
`update public.app_settings set value='yourcampus.edu' where key='allowed_email_domain';`

## 3. Run it
SQL Editor > New query > paste all of `schema.sql` > Run. It should finish with "Success". Check Table Editor: you should see profiles, private_info, items (19 rows), scans, bins, app_settings, each with RLS enabled.

## 4. Auth settings (Dashboard > Authentication)
- Providers > Email: enabled, **Confirm email ON**, minimum password length 8 or more.
- Email Templates > Confirm signup: put `{{ .Token }}` in the body (e.g. "Your BinBuddy code is {{ .Token }}") so users get the 6-digit code.
- URL Configuration: Site URL = your GitHub Pages address (`https://USER.github.io/REPO/`).
- Before real launch: Authentication > SMTP Settings > add custom SMTP (Resend, Brevo, etc.). The built-in sender is heavily rate-limited, so a class signing up at once will fail.

## 5. What to send me
Only the **Project URL** and the **anon (public) key** (Project Settings > API). Not the service_role key, not the database password.

## What this schema does for security
- Users can read only their own profile, scans and student ID. Others appear only through `leaderboard()` (username, avatar, points).
- Users cannot edit points, items, streak or scans. Only `record_scan(item_key)` changes them, and it takes just an item key. Points come from the `items` table, with a 5-second gap between scans and 40 scans per day (both adjustable in `app_settings`).
- Signup is limited to your campus email domain, enforced in the database.
- Student IDs are stored in `private_info`, readable only by their owner, and linked through a function that gives generic errors.

## Known limits (not hidden)
- The AI runs on the phone, so a determined user can still fake scans. The caps limit the damage. Uploaded gallery photos count the same as camera photos.
- A student ID barcode can't prove who you are. Someone could link another student's ID first. Email verification is the real identity check; the ID is a convenience.
- Scanning an ID will not log anyone in. A later Edge Function will email a one-time code to the account on file, without revealing whether the ID exists.
- Challenges, rewards, redemptions, and real bin data come in later milestones. `campus_stats()` counts scanned items, not verified disposals.

## Milestone 2 additions (v6 site)
1. **Run `schema_patch_1.sql`** once in the SQL Editor (adds `my_summary()`). Without it the site still works, but history, material counts and challenge progress show empty.
2. **Reset Password email template:** Authentication > Email Templates > Reset Password: include `{{ .Token }}` (e.g. "Your BinBuddy reset code is {{ .Token }}") so the in-app "Forgot password" screen works.
3. **Authentication > URL Configuration:** set Site URL to your GitHub Pages address.
4. The site's `js/config.js` holds your project URL and publishable key. Those are meant to be public. Never put the secret/service_role key or database password in the repo.
5. Test checklist: sign up with a campus email > get code > verify > scan an item > points appear > reload (still signed in) > open Play > Leaderboard > sign in from a second device.
6. Not built yet: scan-to-log-in with a student ID (needs an Edge Function), real bins, challenges bonus points, rewards.

## Milestone 3 additions (v7 site)
1. **Run `schema_patch_2.sql`** once in the SQL Editor. It adds user-added bin locations (`add_bin`, `delete_my_bin`) and the storage read policy that profile photo uploads needed. Without it the map shows an error and profile photos may fail.
2. **Bin locations.** Any signed-in user can add a bin (max 15 per day, duplicates within about 4 m rejected) and delete their own. You can also add or remove any bin yourself in Table Editor > `bins` (set `name`, `category` = Recycling / Compost / Trash, `lat`, `lng`). Tip: in Google Maps long-press a spot to copy its coordinates.
3. **Log in with student ID (optional, needs one deploy).**
   - Authentication > Email Templates > **Magic Link**: put `{{ .Token }}` in the body (e.g. "Your BinBuddy login code is {{ .Token }}").
   - Dashboard > Edge Functions > Deploy a new function named exactly `id-login`, paste `supabase/functions/id-login/index.ts`, and turn **Verify JWT OFF**. (CLI: `supabase functions deploy id-login --no-verify-jwt`.)
   - Until it is deployed, the "Log in with student ID" button shows "ID login isn't available right now" and everything else keeps working.
   - Security: the ID alone never logs anyone in. A one-time code is emailed to the account that owns the ID. The function answers the same way for IDs that do not exist.
4. Camera-only scanning is enforced in the app (no upload button). A determined person can still bypass the browser, which is why the server caps (5 s gap, 40 scans a day) stay.

## v8: real map details + walking directions (no setup needed)
- Buildings, roads, paths, parks and water come from OpenStreetMap through the free Overpass API (two public servers, tried in order). Tiles are cached on each device for 14 days, so repeat visits are fast.
- Walking routes come from routing.openstreetmap.de (foot profile). "Open in Maps" hands off to Apple Maps (iPhone) or Google Maps (everything else) in walking mode.
- All of these are free, community-run services with fair-use limits. If a big class loads the map at once and it gets slow or errors, the next step is a keyed provider (e.g. MapTiler, Stadia or openrouteservice, free tiers) or hosting your own data. Only map-area coordinates and, when someone taps "Walk there", their start and end points are sent.
- Credit "© OpenStreetMap contributors" is shown on the map (required by OSM's license).
