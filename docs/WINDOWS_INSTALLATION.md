# Windows Installation & Verification (Build 027)

Vector Stock Pattern Studio ships as a native Windows desktop app in
addition to the web app and the iPad-installable PWA. This document covers
installing it and verifying it actually works on a real Windows 11 machine.

## What you get

Two Windows artifacts, built from the same source as the web app:

| File | What it is | Needs admin rights? |
|---|---|---|
| `VectorStockPatternStudio-Setup-x64.exe` | NSIS installer. Creates a Start Menu entry and desktop shortcut. | No — installs per-user under `%LOCALAPPDATA%\Programs\Vector Stock Pattern Studio`. |
| `VectorStockPatternStudio-Portable-x64.exe` | Portable build. Runs directly, no installation. | No. |

Both were built with `contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true`, no remote module, and an explicit IPC channel allowlist —
see `app/electron/main.ts` and `app/electron/preload.ts`.

A `SHA256SUMS.txt` is included alongside both files. **Verify the hash
before running either .exe** — see Step 1 below.

## How to get the files

These `.exe` files (~90-100 MB each) are never committed to git — they are
build output, not source. There are two ways to get real copies:

**Option A — GitHub Actions (recommended, no local build needed).**
`.github/workflows/desktop-windows-build.yml` builds both artifacts on a
real `windows-latest` GitHub Actions runner (native NSIS build, no `wine`
workaround needed — that was only required for this project's own Linux
development sandbox). On GitHub, go to **Actions → Windows Desktop
Build → Run workflow** (or let it run automatically on a push to
`claude/build-027-offline-pc-ipad`/`main` that touches `app/electron/**`),
wait for the run to finish, then open the run and download the
`vector-stock-pattern-studio-windows-<commit-sha>` artifact zip from the
**Artifacts** section at the bottom of the run page. It contains both
`.exe` files, `SHA256SUMS.txt`, `verifyWindowsInstall.ps1`, and this
document. Workflow artifacts expire after 30 days; if you need a
longer-lived copy, re-run the workflow with **Publish a prerelease GitHub
Release** enabled — it uploads the same files to a `desktop-windows-<sha>`
prerelease under the repo's Releases tab.

**Option B — build from source on your own Windows machine** (also useful
to reproduce the exact bits yourself, or to build a newer commit before a
workflow run exists for it):

```powershell
git clone https://github.com/cfo-ubon/vector-stock-pattern-studio.git
cd vector-stock-pattern-studio\app
npm ci
npm run desktop:build:windows
```

This produces both `.exe` files under
`release\VectorStockPatternStudio_Desktop\build-tmp\`. Compute your own
`SHA256SUMS.txt` with `Get-FileHash *.exe -Algorithm SHA256` — a
locally-built copy will not match a CI-built copy byte-for-byte (build
timestamps differ), so only compare a file's hash against the
`SHA256SUMS.txt` that shipped alongside *that specific* file, never a
different build's.

## Why this document exists

This project is built inside a Linux sandbox with no Windows runtime, no
WebView2, and no way to launch a real `.exe`. The build pipeline verifies
everything it honestly can from Linux (TypeScript compiles cleanly,
`electron-builder` produces both artifacts, a headless Linux Electron
smoke test confirms the app shell renders, the IPC bridge works, and no
console errors occur) — but **actually installing and using the app on
Windows 11 has never been tested**, because it categorically cannot be
from this environment. That verification is yours to do, and is required
before this feature can be called done (per this project's own policy:
overall status stays PARTIAL until you confirm it).

## Step 1 — Verify the checksum

Before running anything, open PowerShell in the folder with the two
`.exe` files and `SHA256SUMS.txt`, then run:

```powershell
Get-FileHash .\VectorStockPatternStudio-Setup-x64.exe -Algorithm SHA256
Get-FileHash .\VectorStockPatternStudio-Portable-x64.exe -Algorithm SHA256
```

Compare each output against the matching line in `SHA256SUMS.txt`. If
they don't match exactly, **do not run the file** — re-download it.

## Step 2 — Run the verification script

`verifyWindowsInstall.ps1` (in the same folder) automates the checksum
check and walks you through the rest:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\verifyWindowsInstall.ps1
```

It will:
1. Verify both files' SHA-256 hashes against `SHA256SUMS.txt`.
2. Launch the installer (you click through the wizard — it is not silent).
3. Confirm the app was actually installed where expected.
4. Launch the installed app and prompt you to check: the UI loads, pattern
   generation works, Backup Manager can create and restore a `.vspsb`
   file via native Save/Open dialogs, and your data survives an app
   restart.
5. Launch the portable build and confirm it runs without installing.
6. Remind you to test upgrading over this install with a future build, to
   confirm user data survives an upgrade (not testable with only one
   build).

## Step 3 — Manual checklist (if you'd rather not run the script)

- [ ] `Get-FileHash` on both `.exe` files matches `SHA256SUMS.txt`.
- [ ] Installer runs without a Windows SmartScreen block that can't be
      dismissed, without crashing, and without requesting admin
      elevation.
- [ ] After install, `Vector Stock Pattern Studio.exe` exists under
      `%LOCALAPPDATA%\Programs\Vector Stock Pattern Studio\`.
- [ ] Desktop and Start Menu shortcuts were created.
- [ ] Launching the installed app shows the real app UI (not a blank or
      white window).
- [ ] Generating a pattern works and the preview renders.
- [ ] Backup Manager → Create Backup produces a `.vspsb` file via a native
      Windows Save dialog (not a browser download).
- [ ] Closing and relaunching the app preserves your data (IndexedDB
      persists under Electron's per-app `userData` folder).
- [ ] Backup Manager → Restore successfully restores the `.vspsb` you
      just created, via a native Windows Open dialog.
- [ ] The portable `.exe` launches directly with no install step and
      behaves the same as the installed copy.
- [ ] Uninstalling via "Add or Remove Programs" removes the app but does
      **not** delete your data (per `deleteAppDataOnUninstall: false` —
      confirm your `userData` folder is untouched after uninstall).

## Reporting back

For each checklist item (or each `MANUAL` line the script prints), report
PASS or FAIL. Until this is done on a real Windows 11 machine, the
project's own honest-result policy keeps the desktop build status as
**PENDING USER-PC VERIFICATION**, and the overall Build 027 status as
**PARTIAL** — this is intentional, not an oversight.

## What was verified already (and what wasn't)

| Check | Result |
|---|---|
| Electron/preload/IPC TypeScript compiles (`tsc -p tsconfig.electron.json`) | PASS |
| `electron-builder` produces both Windows artifacts from this Linux sandbox | PASS |
| Linux-side headless Electron smoke test (real app shell renders, IPC bridge works, zero console errors) | PASS |
| SHA-256 checksums computed from the real built files | PASS |
| Actual install + launch + use on Windows 11 | **PENDING USER-PC VERIFICATION** |
