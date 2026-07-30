# Offline Limitations — What Is Honestly Different Per Platform

This document exists so nothing about offline behavior is oversold. Every
claim below was verified against the actual build (Playwright offline-reload
tests, real service-worker precache inspection), not assumed from the spec.

## Features that require internet, always

- Nothing in the current application calls any cloud/LLM API. A full audit
  of `/app/src` found zero network calls in the product itself (only the
  offline-status bar's own `navigator.onLine`/service-worker checks touch
  networking concepts at all). There is currently no AI-dependent feature to
  mark as online-only.
- **Marketplace upload** (Stock Submission Center) prepares packages,
  metadata, and a submission queue entirely offline — but there is no
  upload transport implemented in this build (no marketplace API/FTP/SFTP
  client exists yet). "Online upload" is therefore not a feature this build
  disables when offline; it is a feature that does not exist yet at all,
  documented here so it isn't confused with something that silently stopped
  working.
- **Firebase Hosting / GitHub push** (deployment) obviously requires
  internet, but that is a developer/release-process concern, not something
  the shipped application itself depends on at runtime.

## iPad Safari / iPadOS-specific limits

- **No guaranteed background execution.** A PWA on iPadOS cannot run code
  while the app isn't the foreground tab/Home Screen app. "Auto Backup" on
  iPad is therefore a **checkpoint reminder that fires during active use**
  (e.g. on app open, or after N minutes of use), never a true unattended
  background job — see `docs/STORAGE_AND_BACKUP_SAFETY.md`.
- **Storage can be reclaimed by the OS.** Safari's per-origin storage
  (IndexedDB, Cache Storage) is not immune to iOS storage pressure eviction,
  especially for a site not opened in a long time. Requesting persistent
  storage (`navigator.storage.persist()`, wired into the Offline Status bar)
  reduces this risk but iOS Safari does not guarantee it will be granted or
  honored the same way desktop Chrome does.
- **No real filesystem access.** Import/export goes through the Files-app
  share sheet and `<input type="file">`, not a native save-anywhere dialog —
  this is a hard Safari platform limit, not a gap in this app.
- **This is a PWA, not an App Store binary.** No `.ipa` is produced or
  claimed anywhere in this app's UI or docs.

## Windows desktop-specific limits (see `docs/WINDOWS_INSTALLATION.md`)

- The Windows build in this repo was produced by cross-compiling from a
  Linux CI/sandbox environment. The resulting installer and portable
  package are real, checksummed artifacts, and the underlying application
  logic (IPC, persistence, backup/restore) was verified by running the
  Electron app headlessly on Linux — but **the literal "double-click
  Setup.exe, click through the wizard, confirm the shortcut launches"
  experience has not been verified on a real Windows machine** from this
  environment, because none is available here. Treat that specific step as
  your own responsibility to confirm before relying on the installer.

## What recovering from storage loss looks like

If iPadOS (or, less likely, a Windows profile reset) does clear local data:
restore from your most recent `.vspsb` backup via **Backup Manager →
Restore**. This is exactly why regular backups — not just before a
transfer, but on a routine cadence — are the actual safety net, not a
"nice to have." See `docs/STORAGE_AND_BACKUP_SAFETY.md`.
