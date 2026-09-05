# Budget Tracker — install guide

This is a personal budgeting app that works as a website and as a mobile app (via "Add to Home Screen"). It runs offline because the frontend caches the app shell and API responses in the browser.

## What's inside
- `budgeting_api/` — Django + DRF + SQLite backend (the finance data and API)
- `budgeting_web/` — Next.js + Tailwind + PWA frontend (the UI, offline support, mobile install)
- `db.sqlite3` — your finance data (SQLite)
- `manage.py` — Django management commands (runserver, seed)

## Option A: Quick web preview (no install needed)
1. Start the API:
   ```bash
   cd budgeting_api
   python manage.py runserver 0.0.0.0:8000
   ```
2. In another terminal, start the web app:
   ```bash
   cd budgeting_web
   node standalone-server.js
   ```
   Then open `http://localhost:3000` on your phone or computer.

If you want live data, keep the API running. If the API is offline, the app still opens from cache and lets you browse the last known state.

## Option B: Install as a mobile app (recommended)
This app does not use a native wrapper — it installs as a **PWA** (Progressive Web App). That means:

- It works offline
- It can appear in your app drawer
- It runs fullscreen like a native app
- It uses your browser's storage, so the data lives on the device that installed it

### On Android (Chrome)
1. Open `http://localhost:3000` (or your hosted URL) in Chrome
2. Tap the menu (three dots) → **Add to Home screen** (or "Install app")
3. Follow the prompts. The app icon will appear in your launcher.

### On iPhone (Safari)
1. Open the app in Safari
2. Tap the **Share** button
3. Tap **Add to Home Screen**
4. Confirm. The app will launch in standalone mode without the Safari bar.

### On desktop
You can still "install" it in Chrome/Edge via the address bar install icon if the browser detects the PWA. Otherwise just use it as a website.

## First-time setup
The app seeds sample data on first run so you can see progress tracking immediately.

To reset or re-seed:
```bash
cd budgeting_api
python manage.py seed --clear
```
Then restart the API and refresh the web app.

## Sharing with someone else
If you're giving this to someone else to install on their phone:

1. They need to run the API on their device (or on a local server they can reach)
2. They open the web app URL
3. They install it via "Add to Home Screen"
4. After install, it works offline from cache

Two common sharing patterns:

- Same device: they run `budgeting_api` and `budgeting_web` on the same phone/computer. The app talks to `localhost:8000` by default.
- LAN hosting: they run the API on one device and serve the web app from that device too, then other devices open the host's IP. In that case, set `NEXT_PUBLIC_API_URL` to the LAN API address before building the web app.

## Customizing the API URL
By default the web app calls `http://localhost:8000/api`. If you host the API elsewhere, create or edit `budgeting_web/.env.local`:
```
NEXT_PUBLIC_API_URL=http://your-host:8000/api
```
Then rebuild the web app.

## Data storage
All finance data is stored in SQLite (`db.sqlite3`). The web app caches read-only API responses in the browser for offline use, but the source of truth is the SQLite file.

## Notes
- There's no login yet. It's a single-user budgeting app.
- The mobile "app" is really the PWA. It does not go through an app store.
- If you want a real app-store package later, the usual path is a wrapper like TWA (Android) or Capacitor (iOS/Android) around this same PWA.

## Files you should copy when sharing
- `budgeting_api/`
- `budgeting_web/`
- `db.sqlite3`
- `manage.py`
- `START_HERE.md`
