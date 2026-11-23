# BinBuddy (v5, stabilized from v4-UI)

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

## Works now (built, not yet tested on real devices)
On-device AI scan, in-app camera, barcode ID linking, points/levels/streaks, history, daily/weekly challenges (tracked from real scans), badges, profile photo/username, dark mode, sound, mobile bottom nav + desktop sidebar, PWA install/offline shell.

## Sample/placeholder (clearly labeled in the UI)
Bin locations and fill levels, the other students on the leaderboard, reward catalog (not redeemable).

## Not built yet
Email sign-up + codes, passwords, cross-device accounts, real leaderboards, server-side points checks, real bin data/map, smart-bin integration, reward redemption, bonus points for challenges. See `docs/V4_BACKEND.md`.

## v5 changes (stabilization only; no new backend yet)
- Service worker: no longer caches error responses; only falls back to the app shell for page navigations (v4 returned HTML for failed scripts). Cache is `binbuddy-v5`.
- AI and rules separated: `ITEMS` (ai-barcode.js) only maps model labels to item names; `RULES` (app.js) decides material, points, tip. Removed the broken Ollama path.
- New **Metal** material so aluminum cans are no longer labeled Plastic.
- Barcode: crop keeps its aspect ratio (v4 stretched it); the ID camera can't be started twice.
- Extra "not trash" reject labels (laptop/electronics, room/furniture, plant/pet). Effect on accuracy is NOT measured yet.
- Usernames/history are HTML-escaped; lapsed streaks reset on display; stale scan result cleared when leaving the Scan tab; accessibility fixes (aria-checked, dialog roles, Esc to close).
- Still true: accounts/points are local and can be tampered with. Fixed only by the Supabase milestone.
