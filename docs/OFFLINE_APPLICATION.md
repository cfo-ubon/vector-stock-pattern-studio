# Offline Application — Overview

Build 027 adds fully offline operation to Vector Stock Pattern Studio on two
targets, sharing the same React/TypeScript/Vite/IndexedDB application core:

- **iPad**, installed as a standards-based Progressive Web App from Safari
  — see `docs/IPAD_PWA_INSTALLATION.md`.
- **Windows**, packaged as an Electron desktop application — see
  `docs/WINDOWS_INSTALLATION.md`.

Both targets run the same generator, portfolio, Backup Manager, and
marketplace-preparation code the existing web app already has — nothing was
removed or regressed to add offline support.

## How offline actually works here

- **iPad**: `vite-plugin-pwa` generates a service worker
  (`workbox`-based, `generateSW` mode) that precaches the entire app shell
  (HTML, JS, CSS, icons — 26 files, confirmed by an actual production
  build in this repo) on first visit. After that, the app loads from the
  service worker's cache with zero network requests, verified by an
  automated test that puts a real browser into offline mode and reloads.
- **Windows**: the Electron shell has no browser tab or remote URL to load
  at all — the entire app ships as local files inside the installer, so
  there is no "first online visit" requirement the way the PWA has.
- **Both**: all real user data (projects, portfolio assets, settings) lives
  in IndexedDB / the equivalent local desktop persistence layer — never in
  the service worker's Cache API, which is reserved for the static app
  shell only. This split was a deliberate design constraint, not an
  afterthought: Cache API storage is meant for versioned static assets that
  get wholesale-replaced on update, which is the wrong model for a user's
  growing, never-wholesale-replaced project data.

## Where to look for each concern

| Topic | Document |
|---|---|
| Installing on iPad, testing Airplane Mode | `docs/IPAD_PWA_INSTALLATION.md` |
| Installing on Windows | `docs/WINDOWS_INSTALLATION.md` |
| Moving data between PC and iPad | `docs/DATA_TRANSFER_PC_IPAD.md` |
| What genuinely requires internet, per-platform limits | `docs/OFFLINE_LIMITATIONS.md` |
| Storage quota, cleanup tool, Auto Backup realism | `docs/STORAGE_AND_BACKUP_SAFETY.md` |
| The `.vspsb` backup format itself | `docs/BACKUP_SYSTEM.md` |
| Pre-ship verification checklist | `docs/RELEASE_CHECKLIST.md` |

## What was NOT changed

- The original vanilla-JS static site at the repo root (`/index.html`,
  `/js`, `/css`) — untouched, and the service worker's scope
  (`/vector-stock-pattern-studio/studio/`) cannot reach it.
- The GitHub Pages-deployed `/studio` build's actual React application
  behavior — every existing feature (pattern generation, Portfolio Manager,
  Production Center, Backup Manager, Design Workbench, Trend Studio, Stock
  Submission Center) works exactly as before; offline support was added
  around it, not into it.
