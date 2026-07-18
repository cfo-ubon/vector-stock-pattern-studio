# Portfolio Manager P2 Stage 1 — Performance Report

All numbers below are from `catalog/services/collectionService.performance.test.ts`,
run in this environment (`npx vitest run ... --reporter=verbose`, see raw
`[perf]` log lines). Hardware varies across environments — treat these as
representative evidence that the design meets the stated targets with
large margin, not as tight benchmarks; the test assertions themselves use
generous bounds for exactly this reason.

## Fixture generation note

Fixtures are seeded directly via the bulk storage primitives
(`putPortfolioAssetsBulk`/`putCollectionRecordsBulk`) with deterministic
IDs, not through `generateAssetId`/`generateCollectionId`'s random
suffix (collision odds stop being negligible at a 20,000-record synthetic
batch generated in a tight loop — see the test file's header comment) and
not through the import pipeline (which would measure transaction/hashing
overhead unrelated to what this suite targets).

## Results

| Operation | Scale | Target | Measured | Result |
|---|---|---|---|---|
| Create collections (sequential, via `createCollectionService`) | 100 collections | "remain responsive" | **71.0ms** total (~0.71ms/collection) | ✅ |
| `loadCollections()` | 100 collections | "remain responsive" | **1.1ms** | ✅ |
| `assignAssetsToCollections` | 1,000 assets → 1 collection | < 2,000ms | **46.3ms** | ✅ (43x under target) |
| `removeAssetsFromCollections` | 1,000 assets → 1 collection | < 2,000ms | **32.1ms** | ✅ (62x under target) |
| Fixture setup only (not a target metric) | seed 20,000 assets | — | 439.0ms | — |
| `validateCollectionIntegrity` | 20,000 assets × 100 collections | avoid O(collections × assets × repeated reads); test asserts < 5,000ms | **299.2ms** | ✅ |
| `getAssetsForCollection` | 20,000 assets (4,000 members) | "remain responsive"; test asserts < 2,000ms | **224.4ms** | ✅ |

Full raw output:

```
[perf] create 100 collections (sequential, via service): 71.0ms
[perf] loadCollections() over 100 records: 1.1ms
[perf] assign 1,000 assets to 1 collection: 46.3ms
[perf] remove 1,000 assets from 1 collection: 32.1ms
[perf] seed 20,000 assets (fixture setup, not a target metric): 439.0ms
[perf] validateCollectionIntegrity over 20,000 assets x 100 collections: 299.2ms
[perf] getAssetsForCollection over 20,000 assets (4,000 members): 224.4ms
```

## Why the design achieves this (not just "it happened to be fast this run")

Every bulk/integrity operation in `services/collectionService.ts` follows
the same shape, documented in `docs/architecture/ADR-005-collection-relationship.md`'s
"Performance implications" section:

1. Read the full asset list and/or full collection list **exactly once**
   (`loadPortfolioAssets()` / `loadCollections()`), regardless of how
   many assets or collections the operation actually concerns.
2. Build `Map`/`Set` structures for O(1) lookups.
3. Do all mutation computation in memory (never a per-item database
   round-trip).
4. Issue **exactly one** bulk write transaction
   (`putPortfolioAssetsBulk`/`putCollectionRecordsBulk`) for everything
   that changed.

This makes every operation O(assetIds × collectionIds) or O(assets +
collections) in-memory work with O(1) database reads and O(1) write
transactions — never the O(collections × assets × repeated database
reads) shape the brief explicitly warned against. The 20,000-asset
integrity scan finishing in ~300ms (not seconds) is the direct
consequence of this shape, not incidental luck.

## Assertions are not weakened to pass

The test file's actual `expect(elapsed).toBeLessThan(...)` bounds (2,000ms
for the 1,000-asset bulk operations; 5,000ms for the 20,000-asset
integrity scan; 2,000ms for `getAssetsForCollection`) are generous
CI-safe margins over the measured numbers above (which beat every bound
by at least 6x), matching the same convention P1's own performance tests
(`catalog/domain/search.performance.test.ts`,
`components/portfolio/PortfolioGrid.performance.test.tsx`) already
established — the bound exists to catch an accidental algorithmic
regression (e.g. someone later changing a bulk operation into a
per-item loop), not to be a tight benchmark assertion that would make CI
flaky on slower hardware.
