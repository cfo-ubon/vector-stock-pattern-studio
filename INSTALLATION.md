# AI-SBOS — Windows Installation Guide

This covers the Windows desktop edition of AI-SBOS (Vector Stock Pattern
Studio). The desktop edition wraps the same web app (`/app`) in an Electron
shell and adds one capability the browser can't provide: a real
**Production Workspace** on disk. See `WORKSPACE_LAYOUT.md` for what lives
in the Workspace and where.

The plain browser version (no install, no Workspace) continues to work
unchanged at https://cfo-ubon.github.io/vector-stock-pattern-studio/studio/
and is unaffected by anything in this document.

## Two ways to run it

### 1. Installer (`AI-SBOS-Setup-x64.exe`)

- Double-click the installer. It does **not** require administrator rights
  (per-user install, `perMachine: false`).
- You can change the install directory during setup.
- Creates a desktop shortcut and a Start Menu entry named "AI-SBOS".
- **Upgrading**: run a newer installer over an existing install. It never
  touches your configured Workspace path or anything inside the Workspace
  itself — only application files under the install directory are
  replaced.
- **Uninstalling**: your Workspace and its contents are never deleted by
  the uninstaller (`deleteAppDataOnUninstall: false`). Only the installed
  application files are removed. If you want to remove the Workspace too,
  delete that folder yourself.

### 2. Portable edition (`AI-SBOS-Portable-x64.exe`)

- No installation step — copy this one file to any folder (a local drive,
  a USB flash drive, an external SSD, or a network share) and run it
  directly from there.
- Nothing is written outside that folder and your chosen Workspace path —
  useful for running AI-SBOS from removable media across multiple
  machines.
- The portable edition and the installed edition can both point at the
  same Workspace if you want to switch between them.

## First launch

The first time either edition starts, it asks **"Where is your
Workspace?"** with four choices:

- **Create new** — suggests a default location under your Documents
  folder (computed via Electron's own path API; never a hardcoded drive
  letter). You can change it.
- **Move** — point at a folder that already has an AI-SBOS Workspace in
  it, or an empty folder to relocate an existing Workspace into.
- **Verify** — check an existing path's permissions and free space before
  committing to it.
- **Open Existing** — use a Workspace you already set up on this or
  another machine (e.g. on a shared network drive or synced folder).

Whatever you pick, AI-SBOS creates every Workspace subfolder automatically
and verifies write access and free disk space before finishing — it never
silently fails or leaves a half-initialized Workspace.

## Moving your Workspace later

Open the Workspace settings from the app and choose **Move Workspace**.
Every file is copied to the new location and verified (size-checked, not
just "copy succeeded") before the app switches to using the new path. The
old copy is **never deleted automatically** — you get to confirm that
separately once you've checked the new location is good.

## Offline use

AI-SBOS is offline-first. Once installed (or once the portable `.exe` has
been run once), no internet connection is required for normal use —
generation, the Factory, backups, and Workspace operations all work
fully offline.

## What this installer does *not* do

Per this deployment phase's scope, the installer/portable build changes
nothing about the app itself — no new features, no UI redesign, no changes
to the Factory, Decision OS, or Production Workflow. It only adds the
packaging and the on-disk Workspace layer described in
`WORKSPACE_LAYOUT.md`.
