# BinBuddy (v7)

## Structure
- `index.html` – markup only
- `css/app.css` – design system (tokens, light/dark, mobile + desktop sidebar layout)
- `js/app.js` – UI, accounts (local), points, challenges, sample leaderboard/rewards/bins
- `js/ai-barcode.js` – barcode scanner (BarcodeDetector / zxing-wasm) and on-device CLIP analyzer with first-load progress (carried over from v3)
- `sw.js`, `manifest.webmanifest`, `icons/` – PWA

## Run locally
Camera needs https or localhost: `python3 -m http.server 8000` in this folder, open http://localhost:8000.

## Deploy on GitHub Pages
1. Create a public repo. 2. Upload everything in this folder to the repo root (keep folders).
3. Settings > Pages > Deploy from branch > `main` / root. 4. Open `https://USER.github.io/REPO/`.
After updating files, bump `V` in `sw.js` so phones fetch the new version.

## v6: connected to Supabase
Accounts (email + password + 6-digit email code), profiles, avatars, points, streaks, history, weekly/monthly/all-time leaderboards and campus stats now live in Supabase. Points are awarded only by the server function `record_scan`. Only theme and sound are stored on the device.
Setup: see `supabase/SETUP.md` (run `schema.sql`, then `schema_patch_1.sql`). `js/config.js` holds the public project URL and publishable key.
Run locally: `python3 -m http.server 8000` in this folder. Deploy: upload everything to a GitHub Pages repo root; bump `V` in `sw.js` after changes.

## Tested vs not tested
Tested in headless Chromium against a MOCK of Supabase (signup, code, login, scans, rate limit, history, leaderboard, profile edits, logout). NOT tested against the real Supabase project, on real phones, or the AI/barcode scanners.

## Still sample/not built
Bin locations and fill levels (sample), reward redemption, challenge bonus points, scan-to-log-in with a student ID, real campus bin data, smart-bin integration. Earlier local-only accounts from v4/v5 are not migrated.

## v7 changes
Fun-fact card you swipe away, camera-only scanning (upload removed), own canvas bin map with user-added bins (`js/map.js`, no map provider), leaderboard opens first with gold/silver/bronze medals and round avatars, profile photo upload fix, log in with student ID (Edge Function), add-to-home-screen tutorial. Run `supabase/schema_patch_2.sql`; see SETUP.md "Milestone 3". Service worker cache is now `binbuddy-v9`. v8 adds OpenStreetMap buildings/roads and walking directions to the map (see SETUP.md).
Not tested on real phones or against your real Supabase project.


## v9 changes
Base map is now OpenFreeMap (free, no key) rendered by MapLibre under our canvas; Overpass is only a fallback. Walking route is joined to your dot and the bin so it no longer looks offset. Service worker cache bumped to `binbuddy-v9`.

## v10 changes
Map style picker (Auto, Liberty, Bright, Positron, Dark, Fiord; choice saved on the device) and a search box above the map. Search matches bin names first, then places via OpenStreetMap Nominatim (free, no key, runs only when Search is pressed, about 1 request per second). Service worker cache is now `binbuddy-v10`.

## v11 changes
Search suggestions now appear as you type (3+ letters, 350 ms pause) using Photon (photon.komoot.io, free, no key). Pressing Search/Enter uses Photon and falls back to Nominatim if Photon is down. Your own bins are matched by name first. Service worker cache is now `binbuddy-v11`.

## v12 changes
- **Map follows your phone.** The map turns to match the way you face (compass on Android/iPhone; falls back to your walking direction from GPS). Two-finger twist rotates it by hand (this turns auto off). The arrow button on the side goes back to auto; the small needle top-left points north and tapping it snaps north-up. On a computer, Shift+drag rotates.
- **Trash can counter** on the Home screen and above the map (total, outside, inside).
- **Buildings and floors.** Tap a building: admins set it up once (name), then add/delete floors and put trash cans on a floor. Everyone can open a registered building to see its floors and inside bins. Floors can be marked closed.
- **Inside vs outside.** Bins on a floor are "inside" (orange building marker with a count, tagged Inside, with a "may be closed" warning). Bins on the map are "outside" (tagged always available). An All / Outside / Inside filter sits under the type filter, and "Walk to the nearest bin" only uses outside bins.
- **Admin panel** for osiris.k3000@gmail.com (Profile > Admin panel): Admin mode switch, list of users, and a per-person "can add bins" switch. Nobody else sees the add-bin buttons unless switched on. All of this is enforced in the database (schema_patch_4.sql), not just hidden in the page.
- **Student ID login fix.** Scanned IDs are cleaned (spaces, * etc. removed) the same way on the phone, in the database and in the id-login function, so they match the ID you linked. The function now logs why a code wasn't sent (Dashboard > Edge Functions > id-login > Logs).
- Service worker cache is now `binbuddy-v12`.
