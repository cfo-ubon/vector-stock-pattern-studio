# Collection Validation Architecture — Portfolio Manager P2.5 Sprint 1

Companion to `docs/portfolio/COLLECTION_ARCHITECTURE.md` (P2 Stage 1) and
`docs/portfolio/P2_STAGE2_UI_ARCHITECTURE.md` (Stage 2). This document
covers only what Sprint 1 added: validation-engineering infrastructure for
later scalability/integrity/performance/reliability certification. **No
user-facing Collection feature, no architecture rewrite, no `DB_VERSION`
change.**

## What this is

A set of reusable, deterministic tools for exercising the existing,
unmodified Stage 1/Stage 2 Collection stack at scale: a dataset generator,
a benchmark runner, integrity-scenario builders, and a memory-
instrumentation foundation — plus a CLI that wires them together. Nothing
here is reachable from the production UI.

## Layer map

```
app/src/catalog/validation/
  types.ts                 DatasetGeneratorConfig, DatasetManifest, schema versions
  deterministicIds.ts       deterministic VSP-/COL- id builders (no Math.random)
  datasetGenerator.ts       generateDataset() — pure, in-memory
  datasetPresets.ts         SMALL/MEDIUM/LARGE preset configs
  validationDb.ts           persist/reset via the *existing* bulk storage APIs
  benchmarkRunner.ts        warm-up/measured iterations, statistics, timeouts
  benchmarkReport.ts        console/JSON/Markdown formatting
  integrityScenarios.ts     8 named scenarios, calls the *existing* collectionService scan/repair
  memoryInstrumentation.ts  memory sampling adapter + Blob URL lifecycle tracker
  baselinePolicy.ts         regression-threshold comparison + baseline schema
  index.ts                 barrel

app/scripts/
  validateCollections.ts   CLI entry point (tsx)

app/validation-results/collections/   generated reports (gitignored)
```

## Architecture-lock compliance

- **No new Collection repository or service.** Every scan/repair call in
  `integrityScenarios.ts` is a thin, named wrapper around
  `catalog/services/collectionService.ts`'s existing
  `validateCollectionIntegrity`/`repairOrphanedCollectionIds`/
  `repairCoverAssetIntegrity` — unmodified, byte-for-byte.
- **No production code changed.** `domain/`, `storage/`, and
  `services/collectionService.ts` are untouched. The validation module
  only *calls* their exported functions.
- **No `DB_VERSION` change.** Still 5.
- **No UI surface.** Nothing under `components/portfolio/` was touched;
  the validation CLI has no relationship to the React app's module graph
  (not imported from `main.tsx`/`App.tsx`, so it is not bundled into
  `/studio`).
- **One new devDependency**: `tsx` (runs the CLI's TypeScript directly,
  since this repo has no build step for standalone scripts). Never
  bundled into the shipped app.

## Database isolation — the honest version

Section 3/13 of the brief ask for "a dedicated validation database name."
This was **not** implemented as a literal distinct name string, and that
is a deliberate, documented scope decision, not an oversight:

- `storage/db.ts`'s `openDb()` takes no arguments — every store/service
  function it backs (`collectionStore.ts`, `portfolioStore.ts`,
  `collectionService.ts`) hardcodes it, always opening the single
  constant `DB_NAME` ('vsp-db'). Adding a `dbName` parameter and
  threading it through every one of those already-approved functions
  would touch stable, shipped Stage 1/Stage 2 APIs — exactly what this
  sprint's brief forbids without a demonstrated blocker, for an isolation
  guarantee this sprint does not actually need (see below).
- **The real isolation mechanism**: every validation entry point
  (`app/scripts/validateCollections.ts`) installs `fake-indexeddb/auto`
  before importing any catalog module, and every vitest test file already
  runs under jsdom with `fake-indexeddb/auto` installed globally
  (`src/testSetup.ts`) — the same mechanism `collectionService.performance.test.ts`
  and every other Portfolio Manager storage test has relied on since P1.
  `fake-indexeddb` is a from-scratch, **in-memory-only** reimplementation
  of the IndexedDB API with no file, socket, or shared-address-space
  connection to a real browser's actual per-origin storage. Opening the
  literal string `'vsp-db'` through `fake-indexeddb` inside a throwaway
  Node/vitest process can never read, write, or collide with a real
  user's browser profile, because there is no shared backing store for
  the name to collide *in* — the isolation is structural (a different
  runtime, a different process, a different storage backend entirely),
  not a naming convention.
- **Defense in depth**: `validationDb.ts`'s `persistDataset`/
  `resetValidationDatabase` both require an explicit
  `{ confirmValidationEnvironment: true }` option — a caller cannot
  trigger a bulk write or a store-clear by accident.
- **Known limitation**, tracked in `TECHNICAL_DEBT_REGISTER.md`: if a
  future sprint builds a *browser-hosted* (not Node/tsx) validation
  runner — e.g. a Playwright-driven soak test running inside real
  Chromium — the "different process, different runtime" isolation
  argument above no longer applies, and `openDb()` would need a real
  `dbName` parameter at that point. Sprint 1 does not build that runner,
  so the gap is deferred, not silently ignored.

## Reused patterns

| Pattern | Reused from |
|---|---|
| Seeded PRNG (`createRng`, `rngInt`) | `engine/rng.ts` (mulberry32 + cyrb53 hash) — no second RNG implementation |
| Deterministic synthetic-fixture id shape (`VSP-YYYYMMDD-XXXXXX`) | `collectionService.performance.test.ts`'s existing fixture convention |
| `fake-indexeddb` + Node `Blob`/`File` from `node:buffer` for real Blob round-trips | `portfolioStore.test.ts` |
| Bulk write primitives (`putCollectionRecordsBulk`, `putPortfolioAssetsBulk`) | Stage 1's `storage/collectionStore.ts` / `storage/portfolioStore.ts` — never a new write path |
| Scan/repair | Stage 1's `services/collectionService.ts` — never a competing integrity engine |

## Known deviations

- **`duplicateCollectionId` scenario has no scanner-detection assertion.**
  `validateCollectionIntegrity()` does not currently check for a literal
  duplicate entry within one asset's `collectionIds` array (that
  condition cannot occur through the service API at all —
  `addCollectionMembership` dedupes — so it was never a Stage 1
  requirement). The generator/scenario builder can still produce and
  persist the condition (by constructing the raw record directly,
  documented in `P2_5_DATASET_GENERATOR.md`), for a future sprint to build
  detection against if that becomes a priority. See
  `TECHNICAL_DEBT_REGISTER.md`'s new P2.5 section.
- Cover-asset resolution in the dataset generator assigns the cover from
  the *first* member found in a single linear pass (deterministic, not
  random) — a real collection's cover, when auto-suggested, would likely
  pick differently; this is a validation-fixture simplification, not a
  production-behavior claim.

## Explicitly out of scope (per the brief)

No new user-facing Collection feature. No stress/soak certification. No
crash-recovery certification. No backup/restore. No SEO/marketplace/
analytics/cloud/AI work. No rewrite of the approved Collection
architecture.
