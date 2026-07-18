# ADR-003: Asset identity — date-stamped, randomized IDs (`VSP-YYYYMMDD-XXXXXX`)

## Status

Accepted — **Retrospective** (P1 decision). Extended, not changed, by P2
Stage 1's `generateCollectionId` (see "Migration impact").

## Context

Every catalog asset needs a stable identifier: shown in the UI, embedded
in ZIP export filenames/manifests, and used as the `portfolioAssets`
object store's `keyPath`. The ID must be generated client-side (no
server to hand out sequential IDs) and must not depend on file content
(content hashing is a separate, deliberately distinct concern — see
ADR-004).

## Decision

`VSP-YYYYMMDD-XXXXXX`: a date stamp (for human scanability in exported
filenames) plus a 6-character base36 random suffix (`Math.random()`-based,
~2.1 billion possible values per calendar day).

## Alternatives considered

- **A monotonic counter** — rejected: requires either a server (not
  available) or a durable client-side counter that must itself be
  crash-safe and conflict-free across browser tabs; a random suffix has
  no such coordination requirement.
- **A UUID (v4)** — rejected: not human-scannable in a filename or ZIP
  manifest the way a short date-stamped ID is, and this app's other ID
  schemes (`file-<timestamp>-<random>` in `domain/id.ts`'s
  `generateFileId`, `workbenchHistory.ts`, `projectManager.ts`) already
  favor short, readable, prefix-tagged strings over UUIDs.
- **Content-hash-derived ID** (e.g. the SHA-256 itself) — rejected:
  identity and content-duplicate-detection are deliberately kept as two
  separate signals (see ADR-004); if the ID were the hash, editing an
  asset's metadata without touching its file bytes couldn't change
  anything about its identity, but two *different* assets that happen to
  share a file (a legitimate "possible duplicate," not necessarily an
  "exact duplicate" from the identity's point of view) would collide.

## Consequences

- Collision probability is non-zero but negligible for real import
  volumes (a handful to a few hundred assets imported per session); P2
  Stage 1's own performance-test fixtures generate thousands of records
  synthetically in a tight loop and deliberately assign deterministic IDs
  instead of relying on `generateAssetId`'s random suffix, specifically
  because the birthday-paradox collision odds stop being negligible at
  that volume (documented in `catalog/services/collectionService.performance.test.ts`'s
  header comment) — this is a test-fixture concern, not a production one.
- `isValidAssetId()` gives every consumer (import, export, UI) a cheap
  format check without a database round-trip.

## Migration impact

P2 Stage 1 extends this exact pattern for `Collection` identity:
`generateCollectionId()` produces `COL-YYYYMMDD-XXXXXX` (same shape, same
collision rationale, distinct `COL-` prefix so an asset ID and a
collection ID are never ambiguous even as plain strings) — see
`domain/id.ts`. No change to `generateAssetId`/`isValidAssetId` themselves.

## Test evidence

- P1: fixtures throughout every catalog test file implicitly exercise
  `generateAssetId` via `createPortfolioAsset`.
- P2 Stage 1: `domain/collection.test.ts`'s "generates a valid, unique
  COL- id" test exercises `generateCollectionId`/`isValidCollectionId`
  directly.
