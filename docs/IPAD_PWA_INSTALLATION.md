# iPad Installation Guide

Vector Stock Pattern Studio installs on iPad as a standards-based
**Progressive Web App (PWA)** through Safari — there is no App Store listing
and no `.ipa` file; this document describes exactly what actually happens,
verified against the real build in this repo (service worker precache,
manifest, offline reload), not assumed from the spec.

## Requirements

- **Safari only.** Other iOS/iPadOS browsers (Chrome, Firefox, Edge for iOS)
  are all required by Apple to use Safari's WebKit engine, but only Safari
  itself exposes the "Add to Home Screen" install flow that registers a
  standalone, offline-capable web app. Installing from another browser will
  not produce the same result.
- An internet connection for the **first** visit only, so the app shell can
  be downloaded and cached.

## Install steps

1. Open **https://cfo-ubon.github.io/vector-stock-pattern-studio/studio/**
   in Safari.
2. Tap the **Share** button (square with an arrow pointing up).
3. Scroll down and select **Add to Home Screen**.
4. Confirm by tapping **Add**.
5. Launch the app from its icon on the **Home Screen** from now on — not
   from a Safari tab. Launching from the Home Screen icon runs it in
   `display: standalone` mode (no browser chrome), matching what the app's
   own manifest requests.
6. **Before relying on it offline**, open the app once with internet
   available and wait for the status bar at the top to show
   **"พร้อมใช้งานออฟไลน์แล้ว" (ready for offline use)** — this means the
   service worker has finished caching the entire app shell (confirmed in
   this build: 26 precached files, ~1.05 MB).
7. **Test it**: turn on Airplane Mode, then reopen the app from the Home
   Screen icon. It should load and function identically — this was verified
   directly against this build via an automated headless-browser check that
   actually goes offline and reloads, not just inspected from source.

## What the in-app Offline Status bar tells you

Visible at the top of every screen:

- 🟢/🔴 **Online/Offline** — live, updates automatically via the browser's
  connectivity events.
- **Downloading / Ready for offline use / Update available** — reflects the
  service worker's actual precache state, including correctly detecting
  "already installed and ready" on a plain reload (not just right after
  first install).
- A **storage warning** pill once local storage usage crosses 80% of quota.
- **"ป้องกันข้อมูลถูกลบอัตโนมัติ"** — requests persistent storage from
  iPadOS, reducing (not eliminating — see `docs/OFFLINE_LIMITATIONS.md`) the
  chance of the OS reclaiming your data under storage pressure.
- **"📴 วิธีติดตั้งใช้งานออฟไลน์"** — reopens this same install guide from
  inside the app.
- **"🧹 ล้างพื้นที่จัดเก็บ"** — the storage cleanup tool (see
  `docs/STORAGE_AND_BACKUP_SAFETY.md`).

## Updates

When a new version is deployed and you reopen the app, the status bar shows
an **"มีอัปเดตใหม่พร้อมติดตั้ง" (update available)** banner instead of
reloading on its own. Tapping **"อัปเดตตอนนี้"** applies it. This is
deliberate: an unattended auto-reload could interrupt work in progress, so
the app always asks first.

## Getting your data onto (or off of) the iPad

See `docs/DATA_TRANSFER_PC_IPAD.md` — `.vspsb` is the official portable
format for moving projects and settings between a PC and this installed
iPad app.
