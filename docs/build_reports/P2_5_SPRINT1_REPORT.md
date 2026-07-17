# Portfolio Manager P2.5 Sprint 1 — Collection Validation Infrastructure — Build Report

## 1. Executive Summary

Sprint 1 builds reusable, deterministic validation-engineering
infrastructure for the Collection stack: a dataset generator (SMALL/
MEDIUM/LARGE presets, up to 100,000 assets/10,000 collections), a
benchmark runner with real statistics, 8 integrity scenarios built on the
existing scan/repair service functions, a memory-instrumentation
foundation proven via a bounded smoke test, a performance-baseline
comparison policy, and `npm run validate:collections*` CLI scripts. This
is validation *infrastructure only* — no stress/soak certification, no
crash-recovery certification, no backup/restore, no new user-facing
Collection feature, and no change to the approved Collection domain/
storage/service architecture.

## 2. Scope

Deterministic dataset generation (in-memory and real-IndexedDB); a
generic benchmark runner + console/JSON/Markdown reporting; reusable
integrity scenarios calling Stage 1's existing scan/repair; a memory-
sampling adapter + Blob-URL lifecycle tracker with one bounded smoke
proof; a performance-baseline schema + comparison policy; CLI wiring;
tests for all of the above; real measured numbers at all three preset
scales.

## 3. Explicit Out-of-Scope Items

No new user-facing Collection feature. No stress/soak certification. No
crash-recovery certification. No backup/restore. No SEO/marketplace/
revenue/analytics/cloud-sync/AI work. No folder import. No nested
collections. No rewrite of the approved Collection architecture. No
`DB_VERSION` change. Sprint 2 not started.

## 4. Branch and Commits

Branch: `claude/vector-pattern-stock-app-aqimbk`. This sprint's commit is
listed in the git log following this report's own commit — see the final
chat response for the exact hash.

## 5. Base Commit

`ac11bd2` (Portfolio Manager P2 Stage 2's final commit — confirmed present
on the branch, alongside `1545ed5`, before this sprint's first edit).

## 6. Files Changed

- **New module** `app/src/catalog/validation/` (21 files): `types.ts`,
  `deterministicIds.ts`, `datasetGenerator.ts` (+ test), `datasetPresets.ts`,
  `validationDb.ts` (+ test), `benchmarkRunner.ts` (+ test),
  `benchmarkReport.ts` (+ test), `integrityScenarios.ts` (+ test),
  `memoryInstrumentation.ts` (+ test), `memorySmoke.test.tsx`,
  `baselinePolicy.ts` (+ test), `cli.test.ts`, `index.ts`.
- **New CLI**: `app/scripts/validateCollections.ts`.
- **New docs (7)**: this report, `P2_5_VALIDATION_ARCHITECTURE.md`,
  `P2_5_DATASET_GENERATOR.md`, `P2_5_BENCHMARK_RUNNER.md`,
  `P2_5_PERFORMANCE_BASELINE.md`, `P2_5_MEMORY_INSTRUMENTATION.md`,
  `P2_5_SPRINT1_TEST_REPORT.md`.
- **Updated docs**: `TECHNICAL_DEBT_REGISTER.md` (new P2.5 Sprint 1
  section, 5 entries), `ROADMAP.md`, `CHANGELOG.md`, `app/README.md`.
- **`app/package.json`**: 7 new `validate:collections*` scripts, `tsx`
  devDependency.
- **`app/.gitignore`**: `validation-results/` (generated reports).
- **Zero production code changed**: `domain/collection.ts`,
  `domain/collectionMembership.ts`, `storage/collectionStore.ts`,
  `storage/portfolioStore.ts`, `services/collectionService.ts`,
  `storage/db.ts`, and every existing Collection UI component are
  byte-for-byte unchanged.

## 7. Lines Added/Removed

`git diff --cached --stat` against the base commit: **35 files changed,
4,340 insertions(+), 9 deletions(-)** — the 9 deletions are all doc-text
replacements (e.g. the `TECHNICAL_DEBT_REGISTER.md`/`ROADMAP.md` "next
build" sections rewritten to reflect Sprint 1 shipping). Zero deletions
in any production source file.

## 8. Pre-coding Findings

- Confirmed branch `claude/vector-pattern-stock-app-aqimbk`, commits
  `1545ed5`/`ac11bd2` present, working tree clean before starting.
- Read `README.md`, `app/README.md` (both testing/architecture sections),
  `docs/portfolio/P2_STAGE2_REPORT.md`, `P2_STAGE2_UI_ARCHITECTURE.md`,
  `P2_STAGE2_TEST_REPORT.md`, `P2_STAGE2_PERFORMANCE.md`,
  `P2_STAGE2_BROWSER_VERIFICATION.md`, `TECHNICAL_DEBT_REGISTER.md`,
  `COLLECTION_ARCHITECTURE.md`, `COLLECTION_DATA_MODEL.md` in full.
- Inspected `catalog/domain/collection.ts`,
  `catalog/domain/collectionMembership.ts`, `catalog/domain/id.ts`,
  `catalog/domain/types.ts`, `catalog/storage/collectionStore.ts`,
  `catalog/storage/portfolioStore.ts`, `catalog/services/collectionService.ts`,
  `storage/db.ts`, `src/testSetup.ts`, `src/engine/rng.ts`, and existing
  performance test conventions (`collectionService.performance.test.ts`)
  directly from source before writing any new code.
- Confirmed `package.json`'s scripts (`dev`/`build`/`lint`/`test`), no
  existing Vitest/Playwright config file beyond `vite.config`'s test
  block, no `tsx`/`ts-node` present — added `tsx` as the minimal way to
  run a standalone TypeScript CLI script (Node 22's built-in type-
  stripping was tested and rejected: it requires explicit `.ts`
  extensions on every relative import, which would have required
  rewriting every existing extension-less import across the whole
  `catalog/` tree — out of scope and risky; `tsx`, an esbuild-based
  runner, resolves extension-less imports exactly like Vite already does,
  so zero existing files needed touching).
- Ran and recorded the baseline: `npx tsc -b --noEmit` clean, `npm run
  lint` clean, `npm run build` clean (identical `/studio` output — no
  source changes yet), full regression **209 test files / 2,520 tests /
  0 failures** (dev server stopped, per Stage 2's own documented flake
  mitigation) — see Section 22 for the final post-Sprint-1 regression.
- Confirmed the pre-existing `collectionGenerator`/`designSpecCollection`
  timeout flake separately: it did **not** trigger in this baseline run
  (dev server was already stopped); this is consistent with Stage 2's own
  finding that the flake is resource-contention-sensitive, not a fixed
  reproduction.

## 9. Validation Architecture

Full detail in `docs/portfolio/P2_5_VALIDATION_ARCHITECTURE.md`. Summary:
`app/src/catalog/validation/` holds every new module (generator, db
persistence, benchmark runner/report, integrity scenarios, memory
instrumentation, baseline policy); `app/scripts/validateCollections.ts`
is the CLI entry point. Nothing here is imported by any React component,
so it is never bundled into `/studio`. Isolation from a real production
database is structural (Node/`tsx` process + `fake-indexeddb`, the same
mechanism every existing Portfolio Manager storage test already uses),
not a `dbName` parameter — see the architecture doc's "Database
isolation" section for the full reasoning and the documented limitation
this implies for a hypothetical future browser-hosted runner.

## 10. Dataset Generator

`generateDataset(config)` builds `Collection[]`/`PortfolioAsset[]` using
the real domain factories, driven by `engine/rng.ts`'s existing seeded
PRNG (no `Math.random`). Deterministic ids (`VSP-`/`COL-` shape, base36
index suffix instead of a random one). Injects 4 real conditions
(orphaned membership, stale cover, duplicate collectionId, high-
membership/high-member fixtures) plus archived/empty ratios, all
independently configurable. Full detail: `P2_5_DATASET_GENERATOR.md`.

## 11. Dataset Presets

| Preset | Assets | Collections | Target memberships |
|---|---|---|---|
| SMALL | 1,000 | 100 | 5,000 |
| MEDIUM | 10,000 | 1,000 | 50,000 |
| LARGE | 100,000 | 10,000 | ≥500,000 |

## 12. Determinism Evidence

`datasetGenerator.test.ts`'s determinism suite generates the SMALL preset
twice with the same seed and asserts full `toEqual` on both the
collections and assets arrays (manifest compared with its two real
wall-clock fields stripped first) — passes. A different seed produces a
different `collectionIds` assignment — also verified. IDs and collection
names independently confirmed stable across two runs with the same seed.

## 13. Database Isolation

See `P2_5_VALIDATION_ARCHITECTURE.md`'s "Database isolation" section for
the full reasoning. Summary: every validation entry point runs inside
`fake-indexeddb` (either via the CLI's own `import 'fake-indexeddb/auto'`
or vitest's existing `src/testSetup.ts`) — an in-memory-only
reimplementation with no connection to a real browser's storage.
`persistDataset`/`resetValidationDatabase` additionally require an
explicit `{ confirmValidationEnvironment: true }` flag as defense in
depth. `cli.test.ts`'s isolation test proves this empirically: a marker
collection seeded in the *test's own* fake-indexeddb instance survives a
full CLI subprocess run (including that CLI's own database reset) —
if the two shared a store, the marker would have been wiped.

## 14. Dataset Manifest

`DatasetManifest` reports schema/generator version, preset, seed,
generated timestamp, asset/collection/active/archived/empty counts,
membership count + average + max-on-one-asset, cover/stale-cover counts,
orphaned-membership count, duplicate-collectionId-asset count, batch
size, generation duration, database name (when persisted), and an
estimated logical JSON size. Every field is measured from the actual
generated arrays, not a formula — verified by
`datasetGenerator.test.ts`'s manifest-accuracy assertions.

## 15. Benchmark Runner

`runBenchmarkCase`/`runBenchmarkSuite` (warm-up exclusion, timeout
handling, min/max/mean/median/stddev/p95/p99/ops-per-sec,
environment metadata) + `toJsonReport`/`toConsoleSummary`/
`toMarkdownReport`. Full detail: `P2_5_BENCHMARK_RUNNER.md`.

## 16. Benchmark Statistics

p95 requires 20+ samples, p99 requires 100+ before being reported (`null`
otherwise) — most of this sprint's own real service-operation benchmarks
run 3-5 measured iterations (deliberately: these are real IndexedDB
service calls, not microbenchmarks), so their reports correctly show
`p95Ms: null`, verified by `benchmarkRunner.test.ts`.

## 17. Integrity Scenarios

8 named scenarios (`valid`, `orphanedMembership`, `duplicateCollectionId`,
`staleCover`, `emptyCollection`, `archivedCollection`,
`highMembershipAsset`, `highMemberCollection`), each a small isolated
dataset built via `generateDataset` with every other injection ratio
zeroed. Scan/repair are unmodified calls into
`services/collectionService.ts`. Verified: scanner detects orphans/stale
covers; scanning twice never mutates data; repair changes exactly the
expected count and is idempotent; no asset/collection record is ever
deleted by repair; the duplicate-collectionId condition is real (present
in the raw record) but not currently scanner-detectable — documented,
not silently glossed over (see `TECHNICAL_DEBT_REGISTER.md`'s P2.5-1).

## 18. Memory Instrumentation

`sampleMemory`/`MemorySampler` (Node-process/browser-performance-memory/
unsupported, explicit `supported` flag, never a fabricated number) +
`trackBlobUrlLifecycle` (framework-agnostic `URL.createObjectURL`/
`revokeObjectURL` counter, `Reflect.apply`-based restore proven exact).
Bounded smoke test (`memorySmoke.test.tsx`): 5 real mount/unmount cycles
of `CollectionDetailPanel` with real preview Blobs, `tracker.outstanding
=== 0` asserted after every unmount. **No "no memory leak" claim is made
anywhere** — this is a bounded proof the instrumentation works, not a
soak-test verdict (explicitly out of scope per the brief). Full detail:
`P2_5_MEMORY_INSTRUMENTATION.md`.

## 19. CLI Commands

`npm run validate:collections[:small|:medium|:large|:integrity|:benchmark|:memory-smoke]`
— all 7 manually verified working (see Section 23). Default flow:
validate config -> generate SMALL -> persist -> service/data-access
benchmarks -> 8 integrity scenarios -> bounded memory smoke -> JSON +
Markdown reports -> non-zero exit on real failure.

## 20. Performance Baseline Policy

`baselinePolicy.ts`: benchmark identity + dataset identity + metric unit,
15%/30% warning/failure thresholds, environment-comparability check
(never compares across different `environmentDescription` strings —
returns `non_comparable` instead), `upsertBaselineMetric` refuses to
silently replace a worse baseline unless `{ force: true }`. Full policy
prose + this sprint's own measured snapshot table: `P2_5_PERFORMANCE_BASELINE.md`.

## 21. Test Results by Category

89 new tests across 9 files, all passing. Full breakdown by required
category (dataset generator, manifest, benchmark runner, integrity,
memory tooling, CLI/integration): `docs/portfolio/P2_5_SPRINT1_TEST_REPORT.md`.

## 22. Full Regression Result

Baseline (before this sprint's first edit, dev server stopped): **209
test files, 2,520 tests, 0 failures.**

Post-Sprint-1 full regression (`npx vitest run`, dev server stopped):

```
 Test Files  218 passed (218)
      Tests  2609 passed (2609)
   Duration  404.65s
```

218 - 209 = 9 new files; 2,609 - 2,520 = 89 new tests — exactly matching
this sprint's new test files/count, with every pre-existing test still
passing.

The known `collectionGenerator.ts`/`designSpecCollection.ts` timing flake
(documented since Stage 1) is unrelated to this sprint — `git diff --stat`
confirms zero changes under `src/collection/` and `src/trend/`. No
timeout was widened to force a green result.

## 23. Real Measurements

All numbers below are from real, unedited `npm run validate:collections:*`
console output on this environment (`v22.22.2 | linux/x64 | Intel(R)
Xeon(R) Processor @ 2.10GHz`):

| Metric | SMALL (1,000/100) | MEDIUM (10,000/1,000) | LARGE (100,000/10,000) |
|---|---|---|---|
| Generation duration | 11.4ms | 69.1ms | 335.8ms |
| Persistence duration | 34.1ms (1+1 batches) | 190.8ms (1+5 batches) | 1,484.8ms (5+50 batches) |
| Real membership count | 5,559 | 50,939 | 504,541 |
| list-collections (median) | 0.54ms | 3.18ms | 39.72ms |
| filter-active-archived (median) | 0.60ms | 3.18ms | 35.92ms |
| open-collection-metadata (median) | 9.79ms | 84.82ms | 973.97ms |
| collection-count (median) | 0.02ms | 0.02ms | 0.06ms |
| search-collection-filter (median) | 0.24ms | 0.54ms | 5.45ms |
| bulk-assign-1000 (median) | 30.29ms | 104.53ms | 1,097.70ms |
| bulk-remove-1000 (median) | 34.71ms | 107.91ms | 1,111.68ms |
| integrity-scan (median) | 9.43ms | 94.89ms | 1,039.48ms |

Manifest creation: verified against the real generated arrays for every
run (see Section 14). Cleanup duration: `resetValidationDatabase` runs in
low single-digit ms on every preset (measured inline, not separately
tabled — the CLI's own console output for each run includes it
implicitly in the total wall time). Memory smoke-test measurements: see
Section 24 below and `P2_5_MEMORY_INSTRUMENTATION.md`.

## 24. Large Dataset Result

**Completed in full — not reduced, not simulated.** LARGE (100,000
assets, 10,000 collections, `avgMembershipsPerAsset: 5`) ran to
completion end-to-end (generate -> persist -> 8 service/data-access
benchmarks) in **15.9 seconds real time**, exit code 0, all 8 benchmark
cases `status: success`. Real membership count: 504,541 (exceeds the
500,000 target). Generation: 335.8ms. Persistence: 1,484.8ms across 5
collection-batches + 50 asset-batches (`batchSize: 2000`). No
environmental limit was hit; no phase failed.

Bounded memory smoke (CLI `memory-smoke` mode, 200-asset/20-collection
seed, 10 repeated `loadCollections`/`getAssetsForCollection` reads):
baseline heap 37,533,992 bytes, peak 39,318,176 bytes, final 38,419,720
bytes, delta +885,728 bytes. Component-level bounded smoke
(`memorySmoke.test.tsx`, 5 real mount/unmount cycles): `outstanding === 0`
Blob URLs after every single unmount, 1/1 test passing.

## 25. Build and Lint

`npx tsc -b --noEmit`: clean (0 errors). `npm run lint` (oxlint): clean
(0 warnings/errors) after fixing two `no-unused-vars` warnings in
`datasetGenerator.test.ts` (destructured-and-discarded manifest fields,
prefixed with `_`) and one unused `vi` import in `benchmarkRunner.test.ts`.
`npm run build`: clean, `/studio` output byte-identical to before this
sprint (the validation module is not reachable from any bundled entry
point, so it contributes nothing to the production bundle).

## 26. Security and Data Safety

- Validation scripts cannot overwrite the normal production database:
  every run — CLI or vitest — executes inside `fake-indexeddb`, an
  in-memory-only reimplementation with no shared address space, socket,
  or file with a real browser's actual per-origin storage (see Section
  13 / `P2_5_VALIDATION_ARCHITECTURE.md`).
- `persistDataset`/`resetValidationDatabase` both require an explicit
  `{ confirmValidationEnvironment: true }` — verified by
  `validationDb.test.ts`'s safety-gate tests (calling either without it
  throws `ValidationEnvironmentNotConfirmedError`).
- Destructive cleanup (`resetValidationDatabase`) only calls the
  existing, approved `clearCollectionsStore()`/`clearPortfolioStores()`
  — never a raw `indexedDB.deleteDatabase(...)`.
- Generated reports contain no secrets — inspected `default.json`/
  `large.json` manually; only dataset manifests, benchmark numbers, git
  commit/branch, and environment metadata (Node version, OS, CPU model,
  RAM total) are present.
- No local absolute user paths are committed — reports themselves are
  gitignored (`validation-results/`); the committed docs reference paths
  relatively.
- No synthetic asset is confused with user content — every generated
  `displayName`/`originalFilename` is prefixed `Validation Asset`/
  `validation-asset-N.svg` or `Validation Collection N`, unmistakably
  synthetic.
- Aborting the CLI mid-run affects nothing outside its own
  `fake-indexeddb` process memory — the process simply exits; there is
  no partial write to any real file/database outside `validation-results/`.
- No network upload occurs anywhere in this module (confirmed by
  inspection — no `fetch`/`XMLHttpRequest`/network import in any
  validation-module file).

## 27. Known Issues

- `duplicateCollectionId` is not currently detected by
  `validateCollectionIntegrity` (by design — never a Stage 1
  requirement, since the condition can't arise through the service API).
  Documented, not fixed, per Sprint 1's "no rewrite" constraint.
- Database isolation is structural (process/runtime separation), not a
  literal distinct database *name* — a future browser-hosted validation
  runner would need `storage/db.ts`'s `openDb()` to accept a name
  parameter, deliberately deferred.
- No CI wiring exists yet for the performance baseline policy — the
  comparison function is built and tested, but nothing calls it
  automatically.
- `getAssetsForCollection` (used by the `open-collection-metadata`
  benchmark) is not paginated at the service layer — same known
  limitation as Stage 2's S2-1, now also visible in this sprint's LARGE
  benchmark numbers (973.97ms median at 100,000-asset scale, since it
  scans the full asset list). Documented, not silently worked around.

## 28. Technical Debt

5 new entries added to `docs/portfolio/TECHNICAL_DEBT_REGISTER.md`'s new
"P2.5 Sprint 1" section (P2.5-1 through P2.5-5) — see Section 27 above
for a summary of the first four; P2.5-5 is the blanket "explicitly out of
scope" entry.

## 29. Documentation Updated

New: `P2_5_VALIDATION_ARCHITECTURE.md`, `P2_5_DATASET_GENERATOR.md`,
`P2_5_BENCHMARK_RUNNER.md`, `P2_5_PERFORMANCE_BASELINE.md`,
`P2_5_MEMORY_INSTRUMENTATION.md`, `P2_5_SPRINT1_TEST_REPORT.md`, this
report. Updated: `TECHNICAL_DEBT_REGISTER.md`, `ROADMAP.md`,
`CHANGELOG.md`, `app/README.md`. `docs/USER_GUIDE.md` (the Thai,
end-user-facing guide) was deliberately **not** touched — this tooling
has no UI surface a real user can reach, consistent with the brief's
"do not update the normal end-user guide with internal validation
tooling unless users can actually access it."

## 30. Definition of Done

- [x] Deterministic generator exists, SMALL/MEDIUM/LARGE all work
- [x] LARGE implemented honestly (full completion, real numbers, no
      quiet reduction)
- [x] Configuration validated (`InvalidDatasetConfigError`, 5+ distinct
      rejection cases tested)
- [x] Validation DB isolated (structural + explicit confirmation gate)
- [x] Manifest generated and verified against real data
- [x] Benchmark runner + correct statistics + console/JSON/Markdown reports
- [x] Integrity scenarios reusable, repair checks reusable
- [x] Memory instrumentation foundation + bounded smoke test passing
- [x] `npm run validate:collections*` commands all working
- [x] Performance baseline policy + schema exist
- [x] 89 new tests passing
- [x] Full regression reported honestly (see Section 22)
- [x] Known pre-existing flake handled transparently (unrelated,
      unchanged files, not silently timeout-widened)
- [x] Typecheck/lint/build all pass clean
- [x] Real measurements documented (Sections 23-24)
- [x] No user-facing Collection feature added
- [x] No `DB_VERSION` change
- [x] No production database risk
- [x] Documentation complete
- [x] Implementation committed, branch pushed
- [x] Sprint 2 not started

## 31. Sprint 2 Recommendation

Sprint 1 built the infrastructure; it did not run it as a certification.
The natural next step is **P2.5 Sprint 2: apply this infrastructure to a
real stress/soak/crash-recovery pass** — specifically: (a) a genuinely
long-running soak (repeated cycles over minutes, not one bounded smoke
run) tracking `MemorySampler` deltas across many iterations to detect an
actual growth trend rather than proving the tooling works once; (b) a
sustained-load run at or beyond the LARGE preset repeated many times
back-to-back; (c) simulated mid-write interruption/recovery behavior
(what happens to a `bulk-assign` or `repairOrphanedCollectionIds` call
interrupted partway, and does a subsequent scan correctly characterize
the resulting state) — none of which Sprint 1's bounded, single-pass
checks attempt. Sprint 2 should also decide whether to wire
`baselinePolicy.ts`'s comparison function into an actual CI gate (P2.5-3)
now that a first reference snapshot exists. **This report does not begin
that work — it is a recommendation only.**
