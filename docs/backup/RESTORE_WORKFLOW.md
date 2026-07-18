# Restore Workflow — Portfolio Manager P3

Covers `app/src/catalog/backup/restoreService.ts`: how a backup archive
gets from "picked file" to "restored state," what `overwrite` and `merge`
actually do, and how the system behaves when things go wrong mid-restore.

## Overall flow

```
1. importBackupArchiveFile(file)      -> parsed: unknown (JSON only, no shape checks)
2. validateBackupArchive(parsed, {crossCheckLiveAssets: true})
                                       -> BackupValidationReport (never throws)
3. previewRestore(archive, mode)      -> RestorePreview (dry-run, zero writes)
   [user reviews the preview]
4a. restoreBackup(archive, mode)      -> RestoreResult (writes applied)
4b. ...or do nothing                  -> "Cancel": simply never calling restoreBackup
```

Step 2 happens again, internally, at the start of both step 3 and step 4a
(`computeRestorePlan` calls `validateBackupArchive` itself) — a caller
that skips straight to `restoreBackup` without a separate validation call
is still fully protected; validation is not something the caller can
accidentally bypass.

## Shared plan computation

`previewRestore` and `restoreBackup` both call the same internal
`computeRestorePlan(archive, mode)`. This is deliberate: a preview must
never show something restore then does differently. The plan computes,
once:

1. Whether the archive is structurally trustworthy enough to restore at
   all (`validateBackupArchive` with `crossCheckLiveAssets: true`) — if
   not, the plan is `null` and both functions handle that case
   consistently (preview returns `previewable: false`; restore throws
   `BackupRestoreError`).
2. A per-collection diff against live state (`create` / `unchanged` /
   `conflict`), with the human-readable list of which fields conflict.
3. A final per-asset membership set (`Map<assetId, Set<collectionId>>`)
   reflecting what membership *should* look like after restoring with
   the given `mode`.

`previewRestore` reads this plan and reports it (counts, diffs) without
writing anything. `restoreBackup` reads the exact same plan and writes it.

## Restore modes

### `overwrite`

- Every collection present in the backup has its metadata **fully
  replaced** by the backup's version (name, description, cover asset,
  archived state) — a live conflict resolves to `update`.
- Membership for backup-covered collections is set to **exactly** the
  backup's membership set — anything added to those collections since
  the backup was taken is removed. Collections **not** in the backup are
  never touched (their membership is untouched, even if that means an
  asset still belongs to a collection the backup doesn't know about).

### `merge`

- Only **creates** collections missing from live state. An existing
  collection's metadata is never overwritten, even if it conflicts with
  the backup's version — a live conflict resolves to `keep-current`.
- Membership is **purely additive** — the backup's memberships are added
  on top of whatever already exists; nothing is ever removed.
  `membershipsToRemove` is always `0` in merge mode, by construction.

### `cancel`

Not a function call — "cancel" is simply choosing not to call
`restoreBackup` after inspecting a `previewRestore` result. There is
nothing to undo because nothing was written yet (see "Dry-run guarantee"
below).

## Conflict detection

A "conflict" means: the collection exists in both the backup and live
state, and at least one of `name`, `description`, `coverAssetId`,
`isArchived` differs. This is purely a diagnostic label recorded on each
`CollectionPreviewEntry` (`diff: 'conflict'`, `conflictingFields: [...]`)
— resolution is deterministic and mode-driven (`resolveAction`), not an
interactive per-item choice. This matches the brief's "simple,
deterministic" mission constraint: there is no partial/manual conflict
resolution UI to design or maintain.

## Dry-run guarantee

`previewRestore` never calls `putCollectionRecordsBulk` or
`putPortfolioAssetsBulk` — it only reads (`loadCollections`,
`loadPortfolioAssets`) and computes. This is verified directly by a test
(`restoreService.test.ts`, "dry-run guarantee") that renames a
collection to create a conflict, calls `previewRestore` in both modes,
and asserts live state is byte-for-byte unchanged afterward.

## Missing assets

A membership entry whose `assetId` no longer exists in the live catalog
(deleted since the backup was taken) is skipped, not treated as a
failure — the rest of the restore proceeds normally. Skipped asset IDs
are reported in `RestoreResult.skippedMissingAssetIds` /
`RestorePreview.missingLiveAssetIds`, and separately flagged as a
`warning`-severity `missing-live-asset` validation issue (not an
`error` — assets legitimately get deleted between a backup and a later
restore; that is not corruption).

## Refusing untrustworthy archives

`restoreBackup` throws `BackupRestoreError` (carrying the full
`BackupValidationReport`) and **writes nothing** when the archive fails
structural validation — a checksum mismatch, an unsupported schema
version, or a corrupted/truncated payload. A broken archive must never
partially apply. This is verified directly: a checksum-tampered archive
carrying an injected extra collection is rejected, and a follow-up read
confirms neither the injected collection nor any change to existing data
landed.

## Interrupted restore — self-healing by design

`restoreBackup` performs two separate bulk writes — collections, then
memberships — via `putCollectionRecordsBulk` and
`putPortfolioAssetsBulk`. **These two calls are not atomic with each
other.** If the process is interrupted between them (browser closed, tab
crashed, network/storage failure), live state can be left with the
collections written but membership not yet applied.

This is a deliberate, tested design rather than a gap, for one reason:
`computeRestorePlan` always recomputes the diff **fresh against current
live state** on every call — it never trusts a stored "restore in
progress" intent. Re-invoking `restoreBackup` with the same archive and
mode after an interruption:

1. Re-diffs collections against (now partially-restored) live state —
   the already-written collections show as `unchanged`, contributing
   zero further writes for that phase.
2. Re-diffs membership against live state — the not-yet-applied
   memberships still show as needing to be added, and are added.

The system therefore converges to the correct final state on retry,
without needing any new cross-store transactional primitive (which would
require touching the frozen Collection API — explicitly out of scope
unless a real production defect is found, which this is not: it's an
inherent property of doing two separate writes, not a defect in either
write). This is verified directly by a test that manually resets live
state to the exact intermediate condition (collection present, its
membership not yet applied), calls `restoreBackup` once and confirms it
self-heals fully (`membershipsAdded: 1`, correct final membership), then
calls it again and confirms true convergence (`membershipsAdded: 0` on
the retry — nothing further to do).

Idempotency follows the same mechanism: restoring the exact same archive
twice in a row is a no-op on the second call, for the same reason — the
plan is always computed against current live state, and after the first
restore, live state already matches the backup.

## Unexpected exceptions during restore

Each of the two bulk-write calls already carries P2.5 Sprint 3's proven
atomicity guarantee (handlers attached before the transaction loop,
`try/catch { transaction.abort(); }` on failure) — an exception during
either individual write leaves that write's own object store untouched,
never half-applied. Combined with the interrupted-restore self-healing
above, an exception thrown at any point during `restoreBackup` — whether
before the first write, between the two writes, or during either write
itself — leaves live state in a condition that a retried `restoreBackup`
call can always converge from safely. No new exception-handling logic
was added in `restoreService.ts` beyond what the frozen bulk-write
primitives already guarantee, by design — see
`docs/portfolio/COLLECTION_API_FREEZE.md`.
