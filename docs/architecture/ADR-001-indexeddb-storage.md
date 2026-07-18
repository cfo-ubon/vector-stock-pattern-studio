# ADR-001: IndexedDB as the Portfolio Manager's storage engine

## Status

Accepted — **Retrospective**. This decision was made during Portfolio
Manager P1 (Core Database and Asset Library) and is documented here
during P2 Stage 1 for the first time; it was not written down as a
formal ADR at the time. The decision itself has not changed — Stage 1
extends the same database rather than replacing it (see "Migration
impact" below).

## Context

P1 needed to add a "core database and asset library" to a client-only,
static-hosted (GitHub Pages) React app with no backend, no server, and
(per the sprint brief) an explicit constraint: **do not use LocalStorage
for asset files or the primary catalog.** The app already had four other
persisted features using two different storage strategies:

- `storage/savedStore.ts`, `storage/projectStore.ts`, `storage/styleDnaStore.ts`,
  `storage/assetStore.ts` — all IndexedDB-backed via the shared
  `storage/db.ts` connection, all with a `localStorage` fallback for
  browsers/contexts without IndexedDB (e.g. some `file://` offline builds).
- The vanilla-JS prototype at the repo root (`/index.html`, `/js`) uses
  `localStorage` directly for its own, unrelated saved-pattern library.

## Decision

Use **IndexedDB**, via the app's existing shared `storage/db.ts` connection
(one database, one version number, one `onupgradeneeded` handler — see
ADR pattern below), for the Portfolio Manager catalog. Two new object
stores were added in P1: `portfolioAssets` (metadata) and `portfolioFiles`
(binary bodies) — see ADR-002 for why binary bodies are a separate store.

## Alternatives considered

- **LocalStorage** (the pattern every earlier store in this app falls back
  to) — rejected outright: LocalStorage requires `JSON.stringify`-able
  values, which cannot represent a `Blob`'s binary bytes without a lossy
  base64 re-encoding (forbidden — see ADR-002), and its ~5-10MB per-origin
  quota cannot hold a real stock-vector asset library (dozens to hundreds
  of SVG/PNG/EPS source-file sets).
- **A second, independent `indexedDB.open()` connection** dedicated to the
  Portfolio Manager — rejected: `storage/db.ts`'s header comment already
  documents the reason every other store shares one connection/one version
  number — two competing `open()` calls against the same database name can
  race or conflict during a version upgrade. P1 added its two stores to
  the existing shared `onupgradeneeded` handler instead.
- **A remote/cloud database** — out of scope per the sprint brief (no
  backend, no server, static hosting only).

## Consequences

- **No LocalStorage fallback for this feature** — unlike every other
  `storage/*Store.ts` in the app, `catalog/storage/portfolioStore.ts`
  (and now `catalog/storage/collectionStore.ts`, Stage 1) does not
  degrade to LocalStorage when IndexedDB is unavailable.
  `portfolioStorageAvailable()`/`collectionStorageAvailable()` let the UI
  detect this and show a clear message instead of a silent partial
  failure.
- **Data is per-browser-profile**, not per-account or cross-device — a
  known, documented limitation (see
  `docs/portfolio/PORTFOLIO_MANAGER_STORAGE.md`'s "Browser limitations").
- **Quota is disk-space-bound** rather than a small fixed cap, which is
  what makes a real asset library practical.
- Every future Portfolio Manager storage need (Stage 1's `collections`
  store included) extends the same shared connection rather than
  introducing a parallel one.

## Migration impact

None caused by this ADR itself (it documents an existing decision). Stage
1's own schema change (`DB_VERSION` 4 → 5, adding `collections`) follows
the same pattern this ADR describes and is covered by ADR-005 and
`docs/portfolio/COLLECTION_DATA_MODEL.md`.

## Test evidence

- P1: `catalog/storage/portfolioStore.test.ts` (8 tests, real IndexedDB via
  `fake-indexeddb`, not a mock).
- P2 Stage 1: `storage/db.migration.test.ts` (8 tests) directly exercises
  `openDb()`'s shared-connection upgrade path across a real version bump.
