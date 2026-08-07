# AI-SBOS — Production Workspace Layout

The Production Workspace is a folder on disk, created and managed by the
Windows desktop edition (installer or portable — see `INSTALLATION.md`).
It exists so a real production setup can live outside the GitHub
repository entirely: the repository stays source code only, and everything
generated, exported, backed up, or submitted lives in the Workspace.

The web/browser edition (`/studio` on GitHub Pages) has no Workspace — it
has no filesystem access and is completely unaffected by any of this.

## Where it lives

There is no hardcoded path. On first launch you choose the location (see
`INSTALLATION.md`); the suggested default is a folder under your Windows
Documents directory, computed via Electron's own path API. A typical
chosen location looks like:

```
D:\AI-SBOS\
```

but any drive or folder — including a USB drive, external SSD, or network
share — works equally well.

## Folder tree

```
<Workspace>\
├── .ai-sbos-workspace.json      Workspace manifest (created/verified timestamps, app version)
├── Application\                 reserved: optional cache of installed app version info
├── Portfolio\                   portfolio asset exports/backups
├── CommercialPackages\          Commercial Package Builder ZIP output
├── Marketplace\
│   ├── Shutterstock\            submission packages built for Shutterstock
│   ├── Adobe\                   submission packages built for Adobe Stock
│   ├── Freepik\                 submission packages built for Freepik
│   ├── Getty\                   reserved — no wired marketplace profile yet
│   └── Etsy\                    submission packages built for Etsy
├── Export\                      batch export ZIP output
├── Backups\                     .vspsb full-application backup files
├── Releases\
│   └── <version>\               installer + portable artifacts, checksums.sha256, RELEASE_NOTES.txt
├── Logs\                        Electron main-process log files
└── Archive\                     reserved for user-managed overflow/old files
```

All folders are created automatically on first launch (or whenever a
folder is found missing on a later verify — e.g. if it was deleted outside
the app). Creation is idempotent: re-running it on an already-initialized
Workspace only fills in what's missing.

## What writes to each folder, and how

Nothing in this Workspace layer replaces the app's real data store —
**IndexedDB remains the live database** for every screen in the app
(Mission Control, Factory, Portfolio, etc.). The Workspace is an
**additional destination for already-produced files**, wired additively
into the existing, unmodified builders:

| Folder | Written by | Trigger |
|---|---|---|
| `Backups\` | `buildAppBackup()` (`app/src/backup/appBackupBuilder.ts`) | Clicking "+ สร้างไฟล์สำรองใหม่" in Backup Manager |
| `Export\` | `exportAssetsAsZip()` (`app/src/batch/batchExportService.ts`) | Downloading a batch export ZIP |
| `CommercialPackages\` | `buildCommercialPackage()` (`app/src/commercial/packageBuilder.ts`) | Building a commercial package in the Commercial Pipeline tab |
| `Marketplace\<Site>\` | `buildSubmissionPackage()` (`app/src/catalog/submission/submissionPackageBuilder.ts`), routed by marketplace ID | (available; not yet wired to a live UI call site in this app) |
| `Releases\<version>\` | `publishRelease()` (`app/electron/ipc/releaseHandlers.ts`) | Publishing a built installer/portable to the Workspace |

In every case, the in-browser download (or, for `Releases\`, the build
output) remains the primary, unconditional path — the Workspace copy is
strictly additive and only happens when running the desktop edition with a
configured Workspace. Nothing about the browser edition's behavior
changes.

## Backup and restore

`Backups\` holds `.vspsb` archives — the same full-application backup
format documented in `docs/BACKUP_SYSTEM.md`. A backup written here can be
restored on any machine (desktop or browser) via the existing Backup
Manager "กู้คืนข้อมูล" (Restore) flow; the Workspace copy is not a special
format, it's the same file you'd otherwise download.

## Moving a Workspace

See `INSTALLATION.md`'s "Moving your Workspace later" section. Every file
is copied and size-verified before the app switches over; the old copy is
never deleted automatically.
