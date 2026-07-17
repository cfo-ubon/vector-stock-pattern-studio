# ADR-002: Binary source files stored as native Blobs in a dedicated object store

## Status

Accepted — **Retrospective** (P1 decision, documented now during P2
Stage 1; unchanged by Stage 1).

## Context

The sprint brief's core integrity requirement: "The original SVG, JSON,
EPS, AI, PNG, or other source file must be stored byte-for-byte where
technically possible. Do not resize or recompress original files." A
`PortfolioAsset` may be backed by several physical files (e.g. an SVG +
a PNG preview + a JSON settings export grouped into one catalog entry).

## Decision

- Store each source file's exact bytes as a native `Blob` (IndexedDB
  supports `Blob` values directly via the structured clone algorithm —
  no base64/JSON re-encoding needed).
- Keep file bodies in a **separate object store**, `portfolioFiles`
  (keyed by `fileId`, indexed by `assetId` and `sha256`), rather than
  embedding the `Blob` inside the `PortfolioAsset` record itself in
  `portfolioAssets`.

## Alternatives considered

- **Base64-encode file bytes into the JSON-shaped `PortfolioAsset`
  record** — rejected: base64 inflates size ~33%, and encoding/decoding
  is itself a transformation of the bytes the brief's integrity
  requirement forbids treating casually (it's non-destructive but adds
  needless CPU cost and complexity for zero benefit, since IndexedDB
  already supports `Blob` natively).
- **One object store holding both metadata and Blob bodies together**
  — rejected: `loadPortfolioAssets()` (used by every search/filter/sort/
  dashboard operation) would then have to deserialize every file's Blob
  bytes just to list assets, even though 99% of those calls never touch
  file bytes. Splitting stores keeps `portfolioAssets` cheap to scan.
- **File System Access API (writing real files to the user's disk)** —
  rejected: inconsistent browser support, requires per-file user
  permission grants, and doesn't fit "click import, it's in your
  browser-based catalog" UX the brief describes.

## Consequences

- `sha256`/`role`/`filename`/`fileSize` are intentionally duplicated on
  both the asset's `SourceFileReference` (in `portfolioAssets`) and the
  full `PortfolioFileRecord` (in `portfolioFiles`) — a deliberate,
  documented denormalization so orphan-file detection and duplicate-hash
  lookup never need a join.
- Hashing (`domain/hash.ts`) and export-time integrity re-verification
  (`services/exportAsset.ts`) both operate on the literal `ArrayBuffer`
  read from the stored `Blob` — never a re-encoded copy.
- A known upstream test-environment quirk follows directly from this
  choice: jsdom's own `Blob` class is not recognized by Node's
  `structuredClone` (used internally by `fake-indexeddb` to simulate real
  IndexedDB semantics), so any test that round-trips a Blob through a
  real IndexedDB write/read must construct it with Node's `Blob`
  (`node:buffer`) instead of jsdom's global — documented in
  `testSetup.ts` and used consistently across every affected test file
  in both P1 and this Stage 1 (e.g. `storage/db.migration.test.ts`).

## Migration impact

None — Stage 1 adds a `collections` store but does not touch
`portfolioFiles` or the Blob-storage strategy at all. Collection records
themselves have no binary fields (a `coverAssetId` reference, not an
embedded image), so this ADR's decision doesn't extend to them.

## Test evidence

- P1: `catalog/services/exportAsset.test.ts`'s hash-integrity tests;
  `catalog/storage/portfolioStore.test.ts`'s Blob round-trip tests.
- P2 Stage 1: `storage/db.migration.test.ts`'s "preserves existing binary
  Blob file bodies through the upgrade" test confirms the v4→v5 schema
  change does not disturb stored Blob data.
