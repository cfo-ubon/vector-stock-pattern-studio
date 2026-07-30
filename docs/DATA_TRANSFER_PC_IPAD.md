# Data Transfer Between PC and iPad

`.vspsb` (the Application Backup System's format — see `docs/BACKUP_SYSTEM.md`)
is the **official, only supported way** to move your work between a Windows
PC and an iPad running Vector Stock Pattern Studio. There is no cloud sync —
everything lives in each device's own local storage, so a `.vspsb` file is
the physical thing that travels between them.

## PC → iPad

1. On the PC, open **Backup Manager → Backup**, optionally label the device,
   and create a full backup. This produces one `.vspsb` file containing every
   project, portfolio asset, and setting.
2. Move that file to the iPad using whichever method you already use to move
   files onto it — the Files app, iCloud Drive, a USB-C cable, AirDrop, email,
   a USB drive read through the Files app, etc. Vector Stock Pattern Studio
   does not care how the bytes arrived, only that the file ends up somewhere
   the iPad's Files app can open.
3. On the iPad, open **Backup Manager → Restore**, choose the `.vspsb` file
   from the Files picker.
4. The app verifies the archive's checksums and shows you what it contains
   (record counts, file counts) plus any version-compatibility warning
   before asking you to confirm.
5. On confirm, the app **always** creates a Safety Backup of whatever is
   currently on the iPad first, then restores via upsert — nothing already
   on the iPad is deleted, only added to or updated.

## iPad → PC

Identical process in reverse: **Backup → Restore** on the PC using the
Files-picker equivalent (the OS Open dialog), or in a browser tab, a plain
`<input type="file">` file picker.

## What if the restore is interrupted or fails?

- **Checksum failure**: the app refuses to restore anything at all. Nothing
  changes. Re-transfer the file (it was likely corrupted or truncated in
  transit) and try again.
- **User cancels the Files picker or the confirmation step**: nothing has
  been touched — restore only ever begins writing after explicit
  confirmation on a passing verification.
- **Storage runs out mid-restore** (see `docs/OFFLINE_LIMITATIONS.md`): the
  app reports a clear "not enough free space" error rather than crashing.
  Because restore only ever upserts, anything already written stays valid;
  nothing is corrupted. Your Safety Backup (taken before the restore
  started) still exists in Backup History so you can recover the
  pre-restore state.

## What is NOT in a `.vspsb` file

No credentials, passwords, API tokens, or marketplace account secrets are
ever included — the format only contains your own project data, portfolio
assets, and application settings, never anything used to authenticate to a
third-party service.

## Practical notes

- A `.vspsb` file can be large if your portfolio has many binary assets —
  transfer it over Wi-Fi/USB/AirDrop rather than a slow connection where
  possible.
- iPadOS Safari's storage for a web app can, in rare cases, be cleared by
  the OS under storage pressure (see `docs/OFFLINE_LIMITATIONS.md`) — this
  is exactly the scenario `.vspsb` backups protect against. Back up
  regularly, not only before a transfer.
