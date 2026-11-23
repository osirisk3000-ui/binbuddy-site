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
Fun-fact card you swipe away, camera-only scanning (upload removed), own canvas bin map with user-added bins (`js/map.js`, no map provider), leaderboard opens first with gold/silver/bronze medals and round avatars, profile photo upload fix, log in with student ID (Edge Function), add-to-home-screen tutorial. Run `supabase/schema_patch_2.sql`; see SETUP.md "Milestone 3". Service worker cache is now `binbuddy-v7`.
Not tested on real phones or against your real Supabase project.
