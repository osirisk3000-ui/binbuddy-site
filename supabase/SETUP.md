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
2. **Bin locations.** Any signed-in user can add a bin (no daily limit; duplicates within about 4 m rejected. If you ran an older schema_patch_2.sql, also run schema_patch_3.sql to remove the old 15-per-day cap) and delete their own. You can also add or remove any bin yourself in Table Editor > `bins` (set `name`, `category` = Recycling / Compost / Trash, `lat`, `lng`). Tip: in Google Maps long-press a spot to copy its coordinates.
3. **Log in with student ID (optional, needs one deploy).**
   - Authentication > Email Templates > **Magic Link**: put `{{ .Token }}` in the body (e.g. "Your BinBuddy login code is {{ .Token }}").
   - Dashboard > Edge Functions > Deploy a new function named exactly `id-login`, paste `supabase/functions/id-login/index.ts`, and turn **Verify JWT OFF**. (CLI: `supabase functions deploy id-login --no-verify-jwt`.)
   - Until it is deployed, the "Log in with student ID" button shows "ID login isn't available right now" and everything else keeps working.
   - Security: the ID alone never logs anyone in. A one-time code is emailed to the account that owns the ID. The function answers the same way for IDs that do not exist.
4. Camera-only scanning is enforced in the app (no upload button). A determined person can still bypass the browser, which is why the server caps (5 s gap, 40 scans a day) stay.

## v9: OpenFreeMap base map + straighter walking line (no setup needed)
- The base map (buildings, roads, paths, parks, water, labels) is OpenFreeMap vector tiles drawn by MapLibre GL JS (loaded from jsDelivr). It is free, needs no API key, and has no request limits. Light and dark themes follow the app theme.
- If MapLibre or WebGL can't start, the map falls back to OpenStreetMap data from the Overpass API (the v8 method).
- Walking routes come from routing.openstreetmap.de (foot profile). The route snaps to the nearest footpath, so BinBuddy joins both ends with short dashed links: one from your blue dot, one to the bin pin. "Open in Maps" hands off to Apple Maps (iPhone) or Google Maps (everything else) in walking mode.
- Credit "OpenFreeMap © OpenMapTiles, Data © OpenStreetMap contributors" is shown on the map (required).


## Milestone 4 additions (v12 site)
1. **Run `schema_patch_4.sql`** once in the SQL Editor. It adds: the admin check (osiris.k3000@gmail.com), `profiles.can_add_bins`, buildings, floors, inside/outside bins, the admin functions, and the student-ID cleanup. Until you run it the map still loads (old columns), but admin tools, floors and the "only approved people can add bins" rule will not work.
2. **Re-deploy the `id-login` Edge Function** (paste the new `supabase/functions/id-login/index.ts`, keep Verify JWT OFF).
3. **Admin account.** Sign up / log in as osiris.k3000@gmail.com. The patch lets that address bypass the campus-email rule at signup. If that account already exists, nothing else is needed. To change the admin email, edit it in `is_admin()` (and `enforce_email_domain()`) and re-run the file.
4. **Who can add bins now:** only the admin (in Admin mode) and users you switch on in Profile > Admin panel. People who added bins before this patch lose that ability until you switch them on (their old bins stay).
5. **Buildings:** in Admin mode, tap a building on the map > "Set up this building" > name it > add floors (1, 2, Basement...) > "Add a trash can on this floor". Deleting a floor or building also deletes the inside bins on it.
6. **Student ID login not sending a code?** Check, in order: the ID is linked (Profile shows "Linked"); Authentication > Email Templates > Magic Link contains `{{ .Token }}`; Edge Function logs for `id-login`; Supabase only sends one code per account per minute.

## v14: NFC sticker verification
1. Run `supabase/schema_patch_5.sql` once in the SQL Editor (after patches 1-4), then `schema_patch_6.sql` (sets the tap window to 1 minute).
2. In the app (as admin, Admin mode on): open a bin on the map, tap **NFC stickers**, then **Add a sticker** and hold a blank sticker to the back of an Android phone (Chrome). The app writes a secret link onto it and registers it for that bin. Inside bins have a 📡 button in the building panel. On iPhone (cannot write NFC from a website) the app shows the link: write it with the free NFC Tools app (Write > Add a record > URL), then tap Save.
3. Stick them on the bins. When ready, turn on **Admin panel > Require NFC sticker tap**. Until then nothing changes for players.
4. With it on, "Add to bin" asks for a tap first. The server only awards points if that person tapped a sticker in the last minute (each tap is used up by one scan) and, by default, the sticker's bin type matches the item's bin type. Tunables are in `app_settings`: `nfc_window_seconds`, `nfc_match_bin_type`.
5. Android Chrome reads the sticker inside the app. iPhones cannot: tapping a sticker opens the site in Safari, which records the tap (log in there once), then the player returns and presses "I tapped the sticker".
6. Security: the sticker code is a static secret, so anyone with an NFC reader app could copy it. The server limits damage (single-use taps, 1 minute window, bin-type match, daily scan cap), but for stronger protection use NTAG 424 DNA stickers (rotating signed codes) with a verifying Edge Function. Optionally lock written stickers (NFC Tools > Other > Lock tag) so no one can overwrite them. Locking is permanent.

## v15: QR codes (for iPhones, or anyone)
1. Run `supabase/schema_patch_7.sql` once (lets the admin re-show a sticker's QR code).
2. As admin: open a bin > **NFC stickers**. Each sticker has a **QR** button (same code as the sticker), and **Make a QR code (no sticker)** creates a new one. Tap **Print** (or screenshot it) and stick it on the bin.
3. Players: **Add to bin** > **Scan the bin's QR code**. It opens the camera inside the app and records the check-in with no link or new page. iPhones show the QR button as the main option. Android phones with Chrome can still tap the NFC sticker instead.
4. Security note: a printed QR code can be photographed and scanned from anywhere, which is weaker than an NFC tap. The server limits (1 minute window, single use, bin-type match, daily cap) still apply.
