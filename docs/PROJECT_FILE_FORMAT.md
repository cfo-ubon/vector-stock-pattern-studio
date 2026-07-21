# `.vsps` Project File Format

## Summary

A `.vsps` file is a ZIP archive (STORE method, no compression — built
with the app's own existing, unmodified `app/src/export/zip.ts` writer)
containing:

```
manifest.json      # new, thin envelope (this format's own metadata)
project.json        # the EXACT string app/src/project/projectJson.ts's
                    # existing exportProjectJson() produces — unmodified
previews/*.png       # optional — PNG previews for the project's patterns
```

`project.json`'s content and validation logic are **entirely reused** from
the existing, already-shipped Project domain model
(`app/src/project/projectTypes.ts`, `projectManager.ts`, `projectJson.ts`)
— this format does not reinvent or reshape Project data. Opening a
`.vsps` file is: unzip → read `project.json`'s text → hand it, unmodified,
to the existing `importProjectJson()` (which already does full structural
validation and returns Thai-language error messages on failure).

## `manifest.json` schema

```json
{
  "schema_version": 1,
  "app_version": "1.0.0-desktop.1",
  "created_at": 1700000000000,
  "updated_at": 1700000100000,
  "project_id": "proj-abc123",
  "project_name": "ลายดอกไม้คอลเลกชันฤดูใบไม้ผลิ"
}
```

| Field | Type | Meaning |
|---|---|---|
| `schema_version` | number | This format's own schema version (currently `1`) — bumped only when `manifest.json`'s own shape changes, not when the app version changes. |
| `app_version` | string | The desktop app build that created this file — informational only. |
| `created_at` | number | Unix ms timestamp, set once when the file is first saved. |
| `updated_at` | number | Unix ms timestamp, updated on every save. |
| `project_id` | string | Matches the wrapped Project's own `id` (`project/projectTypes.ts`). |
| `project_name` | string | Matches the wrapped Project's own `name` — kept at the manifest level too so the native "Recent Projects" list and file-picker preview don't need to unzip+parse `project.json` just to show a name. Full Thai/English Unicode support (see round-trip test below). |

## Reading a `.vsps` file

Implemented in `app/electron/vsps/vspsReader.ts` — a new, minimal ZIP
reader (this repo had no ZIP *reader* before this migration, only the
existing writer). Deliberately supports only the STORE-only,
non-ZIP64 subset this format's own writer produces, not general ZIP
files. Every entry name is validated with `isSafeZipEntryName()`
(`electron/security/paths.ts`) before being surfaced — a malformed or
tampered `.vsps` file can never cause a path-traversal write.

Throws `VspsFormatError` (never attempts a partial/best-effort read) for:
- not a valid ZIP (no end-of-central-directory record found)
- a corrupted central directory or local file header
- an entry compressed with anything other than STORE
- an unsafe entry name (`../` traversal, absolute path)
- a missing `manifest.json` or `project.json`
- `manifest.json` present but not valid JSON, or missing `schema_version`

## Writing a `.vsps` file

Implemented in `app/electron/vsps/vspsWriter.ts`, reusing
`app/src/export/zip.ts`'s `buildZip()` directly (imported, not
reimplemented) — the exact same STORE-method writer every existing
Collection/Production-Mode ZIP download in the web app already uses.

Saves are atomic: the new content is written to a temporary file in the
same directory, then renamed over the target path
(`electron/ipc/projectHandlers.ts`) — an interrupted write (crash, power
loss, disk full) never leaves a half-written `.vsps` in place of the
previous good save.

## Schema evolution / compatibility

`schema_version` exists specifically so a future format change can be
detected and handled explicitly rather than silently misread. Current
policy (v1, the only version that exists today):

- A `manifest.json` with a `schema_version` this build doesn't recognize
  should be rejected with a clear "this project was created with a newer
  version of the app" message, not a best-effort parse — the same
  discipline `app/src/catalog/backup/backupValidation.ts`'s
  `SUPPORTED_BACKUP_SCHEMA_VERSIONS` list already establishes for the
  existing Backup & Restore subsystem.
- `project.json`'s own `PROJECT_SCHEMA_VERSION`
  (`project/projectTypes.ts`) is independent of `.vsps`'s
  `manifest.json.schema_version` — a `.vsps` schema bump (e.g. adding a
  new manifest field) does not imply a Project schema bump, and vice
  versa.

## Verification status

Round-tripped in a real, executed vitest test
(`app/electron/vsps/vspsFormat.test.ts`, 8 tests, passing under this
repo's normal `npm test`): build → read back → byte-for-byte
`project.json` match, correct Thai project-name preservation, preview PNG
byte preservation, and rejection of corrupted/incomplete packages. Not
yet tested from inside a running Electron app on Windows (see
`DESKTOP_OFFLINE_BUILD_REPORT.md`).
