# Build 018 Report — Batch Production & Botanical Realism ("Revenue First")

## Filename note

The work order asked for `BUILD_012_REPORT.md`. That name already
belongs to an earlier, unrelated, already-shipped build
(`docs/build_reports/BUILD_012_REPORT.md` — "Evaluation Intelligence
Engine V3," Sections 1-10, referenced throughout `docs/ROADMAP.md` and
several other docs). Writing to that path would have silently
overwritten a real historical record, so this report uses
`BUILD_018_REPORT.md` instead — the next number in this repo's own
sequential "Build N" numbering (Build 017 was the immediately prior
build in this same session). Flagging this rather than guessing which
one you actually wanted.

## Scope confirmation

Per your explicit instructions:
- **Did NOT implement PI-1 or any new commercial scoring engine.**
- **Did NOT refactor the existing architecture.** `critic/`, `engine/`
  scoring, `evolution/`, `knowledge/`, and `catalog/` are untouched
  except for one small, behavior-preserving extraction (see "Reuse, not
  duplication" below).
- **Used the existing scoring, analyzer, and recommendation systems as
  they are.** No new scoring formula, no new duplicate-detection
  algorithm, no new diversity algorithm was written anywhere in this
  build.

## What was built, against the brief's 6 priorities

| # | Priority | What shipped |
|---|---|---|
| 1 | Improve Pattern Generator quality | Batch-generated patterns now go through the same hero-visibility/commercial-composition quality retry every other real generation call already gets (see "Reuse, not duplication") — no new quality logic |
| 2 | Increase portfolio diversity | Batch Generate reuses the existing shuffled-bag diversity engine (`assignPortfolioDiversity`), previously hardcoded to a batch size of 9, now scaled to any count |
| 3 | Batch Generate (10/20/50/100) | New `batch/batchProductionService.ts` — `generateBatchToPortfolio()` |
| 4 | Improve Botanical composition | One evidence-based fix to `generators/botanical.ts`'s `flowerBloom` variant (see below) |
| 5 | Add duplicate detection | Wired into the existing Portfolio Manager import pipeline — no new detection logic |
| 6 | Improve SVG export and portfolio export workflow | New `batch/batchExportService.ts` — combined multi-asset ZIP export |

## Architecture: reuse, not duplication

Every one of the 6 priorities above was delivered by **composing
existing, unmodified systems**, not by writing new business logic:

- **Diversity**: `engine/portfolioVariety.ts`'s `assignPortfolioDiversity`
  (Build 003/004) — same function the pre-existing "Generate 9
  Variations" button already called, generalized from a hardcoded `9`
  to any `count`.
- **Quality retry**: `engine/heroDetector.ts`'s `buildTileWithHeroRetry`
  / `buildTileWithCommercialRetry` (Build 003/007). The 2-line routing
  rule that picks between them (`buildTileForGenerate`) previously lived
  as a private function inside `App.tsx` — it is now an exported
  function in `heroDetector.ts` so the new batch service and every
  existing UI call site share one implementation instead of two copies
  of the same rule. This is the one "architecture" change in this
  build: a pure extraction, zero behavior change (confirmed by the full
  regression suite below).
- **Duplicate detection**: `catalog/import/duplicates.ts`'s
  `detectDuplicate` and `catalog/import/importPipeline.ts`'s
  `importFileGroup` (Sprint P1) — the exact same functions the Portfolio
  Manager's manual drag-and-drop import already uses. A freshly-
  generated pattern is turned into the same `File`-shaped input
  (an `.svg` + a `.json` metadata sidecar sharing one basename) a
  manually-selected file pair would produce, and handed to the identical
  function. Exact duplicates are blocked; possible duplicates (matching
  generator seed, different content) are flagged, never silently
  imported — the same policy manual import already enforces.
- **SVG export**: `export/svgExporter.ts`'s `buildSingleTileSvg` /
  `buildFilenameParts` / `buildExportFilename` (unchanged).
- **ZIP export**: `catalog/services/exportAsset.ts`'s
  `buildAssetExportZip` — its hash-verification and zip-entry-building
  core was extracted into a new exported `buildAssetZipEntries` function
  (used by both the original single-asset export, unchanged behavior —
  confirmed by its own pre-existing test suite passing unmodified — and
  the new multi-asset batch export).

No new file in this build implements scoring, duplicate detection, or
diversity logic from scratch.

## New files

- `app/src/batch/batchProductionService.ts` — `generateBatchToPortfolio(input)`:
  generates `count` diverse patterns and saves each into the Portfolio
  catalog via the existing import pipeline, reporting
  `generatedCount`/`importedCount`/`possibleDuplicateCount`/
  `blockedDuplicateCount`/`errorCount`. Injectable `seedForItem` and
  `diversityRngSeed` (mirroring the repo's existing `seed?`/`now?`
  determinism convention) make full runs reproducible for testing.
- `app/src/batch/batchExportService.ts` — `buildBatchExportZip(assetIds)`
  / `exportAssetsAsZip(assetIds, name)`: one combined ZIP with a
  subfolder per asset and one manifest listing all of them.
- `app/scripts/build018BotanicalAudit.ts` — the audit script behind the
  Botanical fix (see below), kept as a permanent, re-runnable artifact
  matching this repo's `scripts/build0NNRegression.ts` convention.

## Modified files

- `app/src/engine/heroDetector.ts` — added the exported
  `buildTileForGenerate` (extraction, see above).
- `app/src/App.tsx` — removed the now-duplicate local
  `buildTileForGenerate`, imports the shared one instead; added
  `handleGenerateBatchToPortfolio` / `handleDownloadBatchZip` and their
  state.
- `app/src/components/ControlPanel.tsx` — added the "Batch Generate"
  control (count selector + button + result summary + download button),
  alongside the untouched "Generate 9 Variations" button.
- `app/src/catalog/services/exportAsset.ts` — extracted
  `buildAssetZipEntries` (see above); `buildAssetExportZip`'s own
  observable behavior is unchanged (its pre-existing test suite passes
  without modification).
- `app/src/generators/botanical.ts` — the one Botanical composition fix
  (below).
- `app/src/critic/visualAnalysis.test.ts` — re-tuned one hardcoded
  fixture seed (`lowHeroVisibility` calibration test). The `flowerBloom`
  fix above adds one extra `rngBool` draw whenever that variant is
  picked, which shifts which variant every *later* `rng()` draw in the
  same generation run lands on — including this fixture's own trigger
  seed, whose Hero Visibility Score rose out of the weak range it was
  chosen to sit in. Re-swept for a new seed (`s6-lowherovis-sweep-45`,
  score 42.15) that still produces a genuinely weak hero with the fixed
  generator. This is the same class of fix this test file's own
  pre-existing comments already document twice (Build 003's
  `fragmentedSilhouette` density retune, Build 004's prior seed retune
  for this exact fixture) — the trigger seed is what moved, not the
  detector, its threshold, or the Botanical Realism fix itself.

## Botanical composition fix (Priority 4) — evidence and result

**Audit**: `scripts/build018BotanicalAudit.ts` generates a 60-pattern
sample spanning the full diversity space (every botanical family,
cluster type, hero structure, composition zone) via the same
`assignPortfolioDiversity` used by Batch Generate, and scores each with
`engine/botanicalBeautyMetrics.ts`'s existing, unmodified
`computeBotanicalBeautyMetrics` (11 named dimensions, Build 004 Section
10). Before this build:

```
Botanical Realism:     31.32  (min 19)  <- weakest by a wide margin
Organic Flow:          40.98
Botanical Complexity:  44.35
Commercial Appeal:     48.92
Luxury Feeling:        58.55
Natural Growth:        70.65
Asset Harmony:         85.00
Silhouette Beauty:     87.45
Flower Hierarchy:      89.92
Leaf Diversity:        94.80
Cluster Harmony:      100.00
Overall composite:     68.43  (min 62)
```

**Root cause**: `computeBotanicalRealism` measures the percentage of
motif instances in a tile that carry a real `data-part="stem"` or
`"leaves"` growth structure. `generators/botanical.ts`'s `flowerBloom`
variant — documented in its own pre-existing comment as "the untagged
fallback bloom across most families with no dedicated species variant,"
i.e. the single most commonly-selected bare motif in the whole
generator — had no stem or leaf structure at all.

**Fix**: added an optional stem (60% of instances, `rngBool(rng, 0.6)`)
beneath `flowerBloom`'s existing petal geometry — the petal-ring drawing
itself is completely untouched. The stem reuses the exact idiom
`flowerBud` (the neighboring variant) already established: a plain
`<line>` wrapped in `data-part="stem"`, same stroke-width convention.
No new shape, no new drawing primitive.

**After** (same 60-pattern sample, same seeds):

```
Botanical Realism:     37.67  (min 25)  <- +6.35 (+20% relative)
Organic Flow:          41.13              (flat, +0.15)
Botanical Complexity:  44.70              (flat, +0.35)
Commercial Appeal:     49.72              (flat, +0.80)
Luxury Feeling:        58.82              (flat, +0.27)
Natural Growth:        70.80              (flat, +0.15)
Asset Harmony:         85.00              (unchanged)
Silhouette Beauty:     85.82              (-1.63, within noise)
Flower Hierarchy:      89.48              (flat, -0.44)
Leaf Diversity:        95.33              (flat, +0.53)
Cluster Harmony:      100.00              (unchanged)
Overall composite:     68.92  (min 64)  <- +0.49
```

Every other dimension stayed flat or moved by less than 2 points — the
fix is narrowly targeted, with no measurable side effect on any other
scored dimension. All 51 pre-existing Botanical tests
(`botanical.test.ts`, `botanicalFamilies.test.ts`,
`botanicalBeautyMetrics.test.ts`) pass unmodified.

## Tests

- 6 new tests, `batch/batchProductionService.test.ts`: count-0 no-op,
  N-pattern generation with correct metadata round-trip, scaling to 10
  without a hardcoded-9 assumption, botanical quality-retry routing
  reached, an exact-duplicate block (deterministic via injected
  `diversityRngSeed` + `seedForItem`), a possible-duplicate flag (same
  generator seed, different structural output).
- 5 new tests, `batch/batchExportService.test.ts`: multi-asset combined
  archive with per-asset subfolders, byte-exact file preservation,
  integrity-error abort for a missing asset, an empty-list edge case,
  and the `{blob, filename}` convenience wrapper.
- 6 pre-existing tests, `catalog/services/exportAsset.test.ts`: verified
  passing unmodified after the `buildAssetZipEntries` extraction.
- 51 pre-existing tests, botanical suites: verified passing unmodified
  after the `flowerBloom` fix.

## Manual browser verification

Ran the real dev build (not just tests): selected batch size 10,
clicked "Generate 10 to Portfolio," confirmed the summary read
"บันทึกแล้ว 10/10" with zero duplicates/errors, clicked "Download Batch
ZIP," and confirmed a real `batch-2026-07-18-10-patterns.zip`
(~4.9 MB) downloaded with the correct per-asset contents. Zero
console/page errors throughout.

## Regression

Full suite, confirmed clean on the final run before this commit:

```
Test Files  269 passed (269)
     Tests  3037 passed (3037)
```

(267 test files existed before this build; +2 new — `batch/
batchProductionService.test.ts` and `batch/batchExportService.test.ts`.
`scripts/build018BotanicalAudit.ts` is a standalone audit script, not a
test file, and isn't counted here.)

### Regression investigation

Two real failures surfaced during this build's own verify pass and were
diagnosed and fixed before this final clean run, using a revert-and-
measure methodology (temporarily restoring the pre-Build-018
`generators/botanical.ts` and re-running the same test in isolation to
confirm cause):

- **`visualAnalysis.test.ts`** — a genuine, direct, deterministic side
  effect of the Botanical fix (RNG-stream shift moved a hardcoded
  trigger seed out of its intended range). Fixed by re-sweeping for a
  new seed — see "Modified files" above.
- **`collectionGenerator.test.ts`** (2 tests, `Test timed out in
  5000ms`/`15000ms`) — reproduced with the Build 018 change in place,
  but **also reproduced, more slowly, with `botanical.ts` fully
  reverted** (19.5s vs 8.8s for the same three-preset timing loop),
  proving these timeouts are pre-existing, environment-load-driven
  flakiness in `generateCollection` itself, unrelated to this build.
  This exact file was already flagged for the same reason in a prior
  build's regression report. No code change was made for this one; the
  final run above shows it passing cleanly.

No change to `catalog/domain/collection.ts`,
`catalog/storage/collectionStore.ts`, `catalog/services/collectionService.ts`
(frozen Collection API, `collectionApiFreeze.test.ts` passed unmodified),
`catalog/submission/`, `catalog/seo/`, or `catalog/dashboard/`
(Builds 015-017, untouched).

## Known limitations

- "Improve Pattern Generator quality" (Priority 1) was interpreted
  narrowly — batch output inherits the existing quality-retry gate,
  but no new quality initiative was undertaken, since the brief
  explicitly forbids new scoring logic and the existing critic/engine
  stack is mature.
- "Improve SVG export" (Priority 6) only gained the new multi-asset ZIP
  capability. The single-file SVG/EPS/JPEG exporters
  (`export/svgExporter.ts`, `export/epsExporter.ts`) were not changed.
- The duplicate-detection summary in the UI is a compact inline count
  (e.g. "⚠️ อาจซ้ำ 2") with no drill-down to inspect which 2 without
  separately opening Portfolio Manager.
- Batch Generate has no chunked/cancelable progress feedback for large
  runs (100 patterns completes in a few seconds in practice, so this
  wasn't a real problem yet, but a much larger future count could
  become one — `candidateEngine.ts`'s macrotask-chunking is the existing
  precedent to follow if that's ever needed).
- The Botanical fix addressed the single weakest dimension found by the
  audit (Botanical Realism). Organic Flow (mean ~41) is the next-weakest
  and was left untouched — seeing this build's before/after report is
  the natural entry point for whoever picks that up next.

See `docs/ROADMAP.md`'s "Recommended Next Build (Revenue First /
Production track)" section for the specific next-step recommendations.
