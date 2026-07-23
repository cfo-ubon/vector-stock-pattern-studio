# Production Asset Identity — Build 026

`app/src/catalog/domain/productionAssetId.ts`

## The problem this solves

Every `PortfolioAsset` already has an `assetId` (`domain/id.ts`'s
`generateAssetId`) — a random, date-stamped string assigned at import
time. That's the right shape for a storage primary key, but it carries no
relationship to the design itself: importing the exact same generated
SVG twice (a copied file, a re-exported ZIP, a moved folder, a fresh
import after a rename) produces two unrelated `assetId`s. Nothing about
the id survives a rename, a folder move, or a metadata edit.

Production work needs the opposite property: an identity for "this is
the same sellable design," stable across copy/rename/re-import/
re-archive, so duplicate-submission checks and sales/rejection history
can recognize the same content wherever it shows up in the catalog.

## What `productionAssetId` is

A second, additive identifier — `PAID-<sha256 hex>` — computed from
exactly the fields that define "this is the same generated design":

- `generatorVersion`
- `styleDna`
- `presetId`
- `compositionType`
- `productTargets` (sorted before hashing, so array order never matters)
- `generatorSeed`
- `canonicalSvg` — the literal, already-generated SVG markup, hashed
  as-is (no re-serialization or whitespace normalization), so the
  fingerprint reflects exactly what will be submitted, not a paraphrase
  of it

These are joined via `JSON.stringify` on an ordered tuple (never naive
string concatenation), so a field boundary can never be ambiguous —
`presetId="" , compositionType="x"` can never collide with
`presetId="x", compositionType=""`.

It is **not** a replacement for `assetId` — the IndexedDB primary key is
unchanged. `productionAssetId` is additive: two different
`PortfolioAsset` rows (the same design imported into two collections, or
re-imported after a folder move) can legitimately share one.

## Why hashing is async

`computeProductionAssetId` hashes via `crypto.subtle` — the same
primitive `domain/hash.ts` already uses for source-file hashing. There is
no synchronous browser-native SHA-256, and this codebase deliberately
avoids adding a hashing dependency, so the function is `async` rather
than reaching for a JS-implemented sync hash library.

## What reads and writes it

- `submissionDuplicateDetection.ts`'s `same-production-asset` rule (see
  `docs/SUBMISSION_TRACKER.md`) — catches a re-imported/renamed copy of
  an already-submitted design.
- `commercialFeedbackEngine.ts` and `productionRecommendations.ts` join
  sales revenue to a preset/style/etc. dimension through
  `PortfolioAsset.productionAssetId` → `SalesEvent.productionAssetId`.
- `SubmissionRecord.productionAssetId` (schema v2) snapshots the value at
  submission time.
- `SubmissionPackageManifest.asset.productionAssetId` — included in every
  built submission ZIP's `manifest.json` for a human-readable audit trail.

## Validity check

`isValidProductionAssetId(value)` is a plain shape check
(`/^PAID-[0-9a-f]{64}$/`) — used wherever a caller needs to distinguish
"never computed" (`null`) from "a real production asset id" without
re-hashing anything.
