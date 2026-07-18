# Backup & Restore Test Report — Portfolio Manager P3

## Summary

```
Test Files  6 passed (6)
     Tests  63 passed (63)
  Duration  ~12s (largest single test: 10.6s, the 5,000-membership large-dataset restore)
```

Run with `npx vitest run src/catalog/backup/ --no-watch` from `/app`.
Zero failures, zero skipped tests. `npx tsc -b --force` and
`npx oxlint src/catalog/backup/` are both clean.

## Coverage by required test category

The P3 brief mandates test coverage for: Backup, Restore, Validation,
Checksum, Corruption detection, Merge, Overwrite, Dry-run, Large dataset,
Recovery after interrupted restore. Every category is covered:

| Category | Test file | Representative tests |
|---|---|---|
| Backup | `backupBuilder.test.ts` | empty-DB shape, real collections+membership capture, omits unassigned assets, label handling, read-only/no-mutation |
| Restore | `restoreService.test.ts` | create-into-empty-DB, missing-asset skip, refuses untrustworthy archives |
| Validation | `backupValidation.test.ts` | fresh valid archive, invalid shape, multi-issue reporting, live-asset cross-check |
| Checksum | `backupCodec.test.ts`, `backupValidation.test.ts` | deterministic checksum, different-payload-different-checksum, checksum-mismatch detection |
| Corruption detection | `backupCodec.test.ts`, `backupValidation.test.ts` | invalid base64, non-gzip data, truncated gzip, truncated archive payload |
| Merge | `restoreService.test.ts` | creates-missing-never-overwrites, additive-only membership |
| Overwrite | `restoreService.test.ts` | full metadata replace, membership removal for backup-covered collections, leaves non-backup collections alone |
| Dry-run | `restoreService.test.ts` | preview counts match plan; explicit "previewing writes nothing to live storage" test |
| Large dataset | `restoreService.test.ts` | 200 collections × 1,000 assets × 5,000 memberships, full restore round-trip |
| Recovery after interrupted restore | `restoreService.test.ts` | manually-simulated mid-restore state self-heals on retry; idempotent double-restore |

Additional coverage beyond the mandated list, for the modules the brief's
"Objectives" section also requires (Backup history, Export, Import):

| Area | Test file |
|---|---|
| Backup history log | `backupHistoryStore.test.ts` |
| Export (download) | `backupExportImport.test.ts` |
| Import (file parsing) | `backupExportImport.test.ts` |

## Test files

### `backupCodec.test.ts` (7 tests)

Compression/decompression and checksum primitives in isolation, before
anything else depends on them:

- Round-trips a small JSON payload through compress/decompress.
- Round-trips a large payload (10,000 synthetic records) — also asserts
  compression actually shrinks the data.
- Deterministic checksum for the same payload; different checksum for a
  changed payload.
- `BackupCodecError` on invalid base64, on valid-base64-but-not-gzip
  data, and on truncated gzip data — the three ways payload corruption
  can present.

### `backupBuilder.test.ts` (7 tests)

The write side — building a real archive from live Collection state:

- Empty-database shape (`stats` all zero, still a valid archive).
- Real 2-collection / 2-asset / 3-membership capture, verified field by
  field.
- Assets with no collection membership are correctly omitted from the
  payload.
- Optional `label` is carried into `metadata.label` when given, and the
  field is entirely absent (not `undefined`-valued) when omitted.
- The archive's checksum matches an independent recomputation from the
  decompressed payload.
- Building a backup is read-only — repeated calls produce equivalent
  archives and never mutate the database in between.

### `backupValidation.test.ts` (13 tests)

Pre-restore validation, including archives that
`buildCollectionBackup` itself would never produce (constructed via a
`makeArchiveFromPayload` test helper to inject deliberate corruption):

- A fresh, untampered real archive validates clean on every field.
- Completely unrecognizable input (wrong shape, `undefined`, `null`) is
  rejected at the cheapest check, before any decompression is attempted.
- Truncated archive payload → `corrupted-payload`.
- Unsupported schema version → `unsupported-schema-version`, refused
  without attempting to read the payload at all.
- Tampered checksum → `checksum-mismatch`.
- A stats header that lies about its own counts → the matching
  `*-count-mismatch` issue.
- Duplicate collection IDs within one archive → `duplicate-collection-id`.
- A membership entry referencing a collection ID absent from the
  archive → `orphaned-membership-reference`.
- Multiple simultaneous issues are all reported together, not just the
  first one found.
- Live-asset cross-check (`crossCheckLiveAssets: true`): a membership
  referencing a since-deleted asset is reported as `missing-live-asset`
  at `warning` severity — the report is still `valid`, since this is
  expected drift, not corruption. Also verifies the field is `null`
  (not checked) when the option is omitted, and `[]` (checked, none
  found) when every referenced asset still exists.

### `restoreService.test.ts` (19 tests)

Preview and restore, across both modes, plus the failure/recovery
scenarios:

- **Preview**: create-everything into an empty DB; conflict detection
  with `resolvedAction: 'update'` in overwrite mode vs.
  `'keep-current'` in merge mode; unchanged-when-identical;
  `membershipsToRemove` is populated in overwrite but always `0` in
  merge; `previewable: false` (with a populated validation report,
  never a thrown exception) for a broken archive; the explicit dry-run
  guarantee test (renames a collection to create a conflict, previews
  in both modes, asserts live state is untouched).
- **Overwrite mode**: creates into empty DB; overwrites a changed
  collection back to the backup's version; removes memberships not in
  the backup for backup-covered collections; leaves collections absent
  from the backup completely untouched.
- **Merge mode**: creates missing collections but never overwrites an
  existing one's metadata; only adds memberships, never removes.
- **Missing assets**: a membership referencing a deleted asset is
  skipped (reported in `skippedMissingAssetIds`) without failing the
  rest of the restore.
- **Refuses untrustworthy archives**: a checksum-mismatched archive
  carrying an injected extra collection throws `BackupRestoreError` and
  a follow-up read confirms neither the injected data nor any change to
  existing data landed; an unsupported schema version is refused the
  same way.
- **Idempotency & interrupted-restore recovery**: restoring the same
  archive twice produces zero further change on the second call; a
  manually-simulated interruption (collection already written,
  membership not yet applied — the exact state a real interruption
  between `restoreBackup`'s two bulk writes would leave) self-heals
  fully on a single retry, and a further retry after that confirms true
  convergence (zero further writes).
- **Large dataset**: 200 collections, 1,000 assets, each asset assigned
  to 5 collections round-robin (5,000 memberships total) — full backup
  and restore round-trip, with a spot-check on one asset's final
  membership count. 30-second test timeout; observed runtime ~10.6s.

### `backupHistoryStore.test.ts` (9 tests)

The `localStorage`-backed activity log: empty-by-default, recording each
event kind (`backup-created`, `restore-completed`, `restore-failed`)
with the right fields, newest-first ordering (including same-millisecond
tie-breaking), the `HISTORY_ENTRY_LIMIT`-entry cap dropping the oldest
entries first, `clearBackupHistory`, graceful recovery from corrupted or
partially-malformed stored JSON, and confirmation that only lightweight
metadata is persisted — never the archive's payload or checksum.

### `backupExportImport.test.ts` (9 tests)

The file I/O glue: filename derivation (embeds the archive's own
`createdAt`, not the current time; sanitizes and includes an optional
label; omits the label segment cleanly when absent), building a
downloadable JSON `Blob` that round-trips into an equivalent archive,
`exportBackupArchiveFile` triggering a download without throwing,
`importBackupArchiveFile` round-tripping a real exported archive back
into a shape `validateBackupArchive` accepts as fully valid, rejecting
non-JSON input with a typed `BackupImportError`, and correctly returning
(not rejecting) valid JSON that isn't a backup archive — proving the
shape check is left to the caller, as designed.

## Regression

The full existing suite (all pre-P3 test files, including the frozen
Collection API surface-guard test from P2.5 Sprint 4) was re-run
alongside this new work with no changes to any file outside
`app/src/catalog/backup/`; see the final verification pass recorded in
this phase's closing report for the combined pass count.

## Known gaps

- No dedicated performance/soak test for backup/restore at P2.5 Sprint
  1/2's scale (very large multi-thousand-asset catalogs beyond the
  5,000-membership large-dataset test here) — out of scope for this
  phase's brief, which asked for large-dataset *correctness*, not a new
  performance baseline.
- No UI-level test (drag-and-drop file picker, browser download
  interception) since no UI was built this phase — see
  `BACKUP_ARCHITECTURE.md`'s "Explicitly out of scope" section.
