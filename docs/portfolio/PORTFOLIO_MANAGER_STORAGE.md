# Portfolio Manager — Storage (P1)

Source of truth: `app/src/catalog/storage/portfolioStore.ts` and
`app/src/storage/db.ts`. This document explains where data physically
lives, the integrity guarantees the storage layer provides, and its known
browser-environment limits.

## Where the data lives

Everything is stored in the browser's **IndexedDB**, database name
`vsp-db` (shared with every other persisted feature in this app —
projects, saved patterns, Style DNA, the Asset Ecosystem Engine), version
`4`. Two new object stores were added for Portfolio Manager:

- **`portfolioAssets`** — keyed by `assetId`. One row per catalog entry
  (the `PortfolioAsset` record — metadata only, no binary bodies). Kept
  small on purpose so `loadPortfolioAssets()` (used by search/filter/sort
  and the dashboard) stays fast regardless of how large the file bodies
  are.
- **`portfolioFiles`** — keyed by `fileId`, with two secondary indexes:
  `assetId` (used by `loadFilesForAsset()` — "show every source file for
  this asset") and `sha256` (used by `findFilesByHash()` — duplicate
  lookups without a full-store scan). One row per physically-stored source
  file, body included as a native `Blob`.

There is **no server, no cloud sync, no network call** anywhere in this
feature — everything is local to the browser profile that imported it.

## Browser limitations (what the user needs to know)

- **Per-browser-profile, not per-device.** The catalog is tied to one
  browser + one origin (`https://cfo-ubon.github.io` when using the
  published site). Opening the app in a different browser, a private/
  incognito window, or on a different device shows an empty catalog — this
  is a plain consequence of IndexedDB's storage model, not a bug. Cross-
  device sync is explicitly out of scope for P1 (see the sprint brief's
  "strictly out of scope" list) — the ZIP export (see
  `PORTFOLIO_MANAGER_IMPORT_SPEC.md`'s companion export section) is the P1
  way to move an asset between browsers/devices.
- **Storage can be cleared by the browser or the user.** Clearing site
  data/"clear browsing data" for the app's origin deletes the catalog —
  same as it already does for saved patterns, projects, and every other
  IndexedDB-backed feature in this app. There is no automatic backup; a
  full-library backup/export is called out in the sprint brief as a later
  sprint, but the storage design does not block adding one (every stored
  Blob is already byte-identical to its original file — a "back up
  everything" export can zip the whole `portfolioFiles` store the same way
  `services/exportAsset.ts` zips one asset today).
- **No fallback storage.** Unlike every other `storage/*Store.ts` in this
  app, Portfolio Manager does **not** fall back to `localStorage` when
  IndexedDB is unavailable (see `PORTFOLIO_MANAGER_ARCHITECTURE.md` for
  why). `portfolioStorageAvailable()` lets the UI detect this up front and
  show a clear message (`PortfolioManagerView`'s
  `portfolio-manager--unavailable` state) instead of a confusing partial
  failure.
- **Quota is disk-space-bound, not a small fixed cap** — but it is still
  finite. A very large import (dozens of gigabytes of source files) can
  hit the browser's storage quota; `importAssetTransaction`'s failure path
  surfaces the resulting `QuotaExceededError` as a normal `ImportErrorOutcome`
  with a readable message, and does not leave a partial asset behind (see
  "Transaction safety" below).

## Source-integrity protection

Every original source file (SVG/JSON/EPS/AI/PNG/JPG/other) is stored as an
exact `Blob` copy of the bytes read from the user's file input — **the
import pipeline never resizes, recompresses, re-encodes, or otherwise
touches the bytes of an original source file.** A generated *thumbnail*
representation is a separate concern (see `PORTFOLIO_MANAGER_IMPORT_SPEC.md`'s
"Thumbnail and preview rules" section) and never replaces or mutates the
stored original.

This is enforced two ways:

1. **Hashing never re-encodes.** `domain/hash.ts`'s `sha256Hex()` hashes
   the exact `ArrayBuffer` read via `file.arrayBuffer()` — the same bytes
   a user's own `sha256sum` of the original file would produce. Nothing in
   the import pipeline (`import/importPipeline.ts`) transforms a file's
   bytes before storing it; the same `File`/`Blob` object that was hashed
   is the one written to `portfolioFiles`.
2. **Export re-verifies before zipping.** `services/exportAsset.ts`'s
   `buildAssetExportZip()` re-hashes every stored file body immediately
   before adding it to the export ZIP and compares it against the
   originally-recorded `sha256`. A mismatch (which would only happen from
   storage corruption, never from normal operation) throws
   `AssetExportIntegrityError` rather than silently exporting
   possibly-corrupted content — this is the "hash integrity" test coverage
   called out in the sprint brief's test-requirements section.

## Transaction safety ("import rollback on failure" / "transaction-safe imports")

`importAssetTransaction(asset, files)` and `deletePortfolioAssetAndFiles(assetId)`
each open **one IndexedDB transaction spanning both object stores**
(`db.transaction([PORTFOLIO_ASSETS_STORE, PORTFOLIO_FILES_STORE], 'readwrite')`)
and perform every `put`/`delete` call inside it before resolving on
`transaction.oncomplete`. IndexedDB transactions are atomic by the platform's
own guarantee: if any operation inside the transaction fails, or the
transaction is aborted (including by an unhandled error, or the tab being
closed mid-write), **none** of its writes are committed — there is no
custom rollback logic in this codebase because none is needed. A reader
calling `loadPortfolioAssets()`/`loadFilesForAsset()` can never observe a
half-written asset (a catalog record with some but not all of its source
files stored, or vice versa).

This also means the import pipeline's pre-write steps (validate → hash →
extract metadata → parse JSON → check duplicates) never touch storage at
all — only the final `importAssetTransaction` call writes anything, so an
error at any earlier step is a pure no-op from storage's perspective, not
a "partial import" that needs cleaning up.

## Deletion: two explicit modes, safer one is the default

- **`deletePortfolioAssetRecordOnly(assetId)`** — deletes only the
  `portfolioAssets` row; the asset's stored file bodies remain in
  `portfolioFiles` (now orphaned — reported, not auto-cleaned, by
  `services/healthCheck.ts`'s `orphanedFileIds`). This is the catalog UI's
  **default** selection (`PortfolioDetailPanel`'s delete-confirmation
  dialog defaults its radio group to this option) — it's the less
  destructive of the two, matching the sprint brief's "default to the
  safer option" requirement.
- **`deletePortfolioAssetAndFiles(assetId)`** — atomically deletes the
  catalog record **and** every one of its stored file bodies in the same
  multi-store transaction described above. This is the explicitly-opted-
  into, more destructive option; the UI requires the user to switch the
  radio selection away from the default before this path is reachable.

## Consistency / migration status

`services/healthCheck.ts`'s `computeHealthReport()` is a pure, read-only
function over already-loaded `PortfolioAsset[]` + `PortfolioFileRecord[]`
arrays (so it's testable without touching IndexedDB directly, and reusable
by both the dashboard and the "Portfolio Health Check" UI action). It
reports, but never repairs:

- **Missing source references** — a `SourceFileReference` on an asset
  whose `fileId` has no matching row in `portfolioFiles`.
- **Missing previews** — assets with `previewReference: null`.
- **Duplicate hashes** — groups of 2+ assets sharing at least one SHA-256
  in their `sourceHashes`.
- **Orphaned stored files** — `portfolioFiles` rows whose `assetId` has no
  matching row in `portfolioAssets` (the direct consequence of
  "record only" deletion above).
- **Invalid metadata** — records failing `isValidPortfolioAsset()`'s shape
  check.
- **Migration status** — count of records at the current
  `PORTFOLIO_ASSET_SCHEMA_VERSION` vs. not.

Per the sprint brief ("Do not silently repair destructive issues"), none
of these findings trigger automatic mutation — `PortfolioHealthCheckPanel`
is a pure report view with a manual "ตรวจสอบใหม่" (re-check) button, no
"fix" button. A future sprint can add opt-in repair actions (e.g. "clear
orphaned files") once there's a considered UX for confirming each one.
