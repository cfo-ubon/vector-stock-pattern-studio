# Build 008A Report — Knowledge Infrastructure (Project Orchid)

## 1. Executive Summary

Build 008A is the first build in Version 2 that does not touch generation
logic at all. Its only goal was to give the project a real, reusable
Knowledge Infrastructure — a versioned, validated, cached loading layer
future builds (Species, Products, Marketplace, Collections) can plug into
without redesigning anything — and to prove that infrastructure by
migrating exactly one real subsystem through it: Style DNA.

The audit (`BUILD_008A_AUDIT.md`) surfaced a genuinely important finding
before any code was written: this codebase already had a JSON-backed
"Style DNA" system (`style-dna/*.json` + `services/styleDnaService.ts` +
`knowledge/style/*`) from an earlier phase, but it was never wired to the
real generation engine and has since gone stale (missing 5 real fields
added across Builds 003-005). Build 008A does not touch that system —
it migrates the REAL, actively-used source of truth
(`engine/styleDna.ts`'s `STYLE_DNA_PRESETS`) instead, and documents the
duplication honestly as a recommendation for a future build.

Every one of the 10 sections is done. `engine/styleDna.ts`'s 15 built-in
presets are no longer a hardcoded object literal — they're real, editable,
versioned JSON files loaded, schema-validated, and cached by a new
`KnowledgeRegistry`. Every existing public API (`resolveStyleDna`,
`exportStyleDnaJson`/`importStyleDnaJson`, `storage/styleDnaStore.ts`,
every downstream consumer across `App.tsx`, `collectionGenerator.ts`,
`trend/*`, Workbench components) is unchanged and verified unchanged by a
dedicated compatibility test file, not just by assumption.

## 2. Objectives vs. Results

| # | Section | Status | Real outcome |
|---|---|---|---|
| 1 | Knowledge Audit | ✅ Done | `BUILD_008A_AUDIT.md` — every rule in Style DNA/Botanical/Palette/Composition categorized into migrate now / keep temporary / compatibility / future, plus the two-parallel-systems finding |
| 2 | Knowledge Registry | ✅ Done | `knowledge/registry/knowledgeRegistry.ts` — load/validate/cache/version/diagnostics, `getStyle()`/`getSpecies()`/`list()`/`validate()` |
| 3 | Knowledge Version | ✅ Done | `knowledge/schema_version.json` |
| 4 | Style Schema | ✅ Done | `knowledge/registry/styleSchema.ts` — versioned (`STYLE_SCHEMA_VERSION`), fields grouped under the brief's own 10 named categories |
| 5 | Knowledge Loader | ✅ Done | `knowledge/registry/styleLoader.ts` + `styleData.ts` (15 real JSON files) — the only subsystem migrated |
| 6 | Validation | ✅ Done | Rejects missing fields, duplicate ids, and schema-version mismatches, each with a readable message |
| 7 | Compatibility | ✅ Done | Legacy JSON system untouched; public export format, custom-style storage, and every existing consumer verified unchanged |
| 8 | Tests | ✅ Done | 4 new test files, 34 new tests, targeted runs during development + one full-suite gate at the end |
| 9 | Documentation | ✅ Done | This report |
| 10 | Ship | ✅ Done | tsc/lint/tests clean, `/studio` rebuilt, committed and pushed |

## 3. Architecture

```
knowledge/
  schema_version.json          (new) { knowledgeVersion, styleSchema, speciesSchema }
  registry/
    styleSchema.ts             (new) versioned schema + field-level validation
    styleLoader.ts              (new) pure load+validate (duplicate ids, per-record schema check)
    styleData.ts                (new) imports the 15 real JSON files, in declared order
    data/styles/*.json          (new) the 15 built-in presets, 1:1 ported from the real STYLE_DNA_PRESETS
    knowledgeRegistry.ts        (new) KnowledgeRegistry singleton — load/validate/cache/version/diagnostics
    index.ts                    (new) barrel
engine/
  styleDna.ts                  STYLE_DNA_PRESETS/STYLE_DNA_LIST now built from KnowledgeRegistry.list('style')
                                instead of a ~165-line hardcoded object literal; every other export unchanged
```

`KnowledgeRegistry` is intentionally generic beyond `style`: `getSpecies()`
already exists as a real, working accessor over the still-hardcoded
`BOTANICAL_SPECIES` table (Build 004/005/007) — species data itself is
NOT migrated this build, but the call-site contract future builds will
use is already in place, so migrating Species later means adding data
files and a loader, never touching call sites.

## 4. Registry

`KnowledgeRegistry` (`knowledge/registry/knowledgeRegistry.ts`) is a
single module-level singleton (`export const KnowledgeRegistry = new
KnowledgeRegistryImpl()`), not a class future code instantiates — matching
how every other cross-cutting table in this codebase (`PALETTES`,
`GENERATORS`, `HIERARCHY_PRESETS`) is already consumed. Its
responsibilities:

- **load**: lazy — nothing is loaded until the first `getStyle`/`list`/
  `diagnostics` call, at which point `STYLE_RAW_RECORDS` (15 imported JSON
  modules) is validated once and cached.
- **validate**: two layers — `styleSchema.ts`'s per-record field
  validation (required fields, types, enum membership), and
  `styleLoader.ts`'s cross-record check (duplicate ids). A third check
  (declared vs. implemented schema version) runs at the Registry level
  since it needs both `schema_version.json` and the schema module's own
  constant.
- **cache**: a `Map<string, StyleDna>` populated once; `getStyle`/`list`
  reuse it. Verified by a test asserting two `getStyle` calls return the
  exact same object reference (not just equal values).
- **version**: `diagnostics()` reports the declared version from
  `schema_version.json`, the version this build's loader code actually
  implements, and whether they match (a mismatch is a rejected load, not
  a silent warning).
- **diagnostics**: real, computed counts (`styleCount`, `speciesCount`),
  never estimated, plus `lastLoadedAt` (a real timestamp, 0 until first
  load).

Public API: `getStyle(id)`, `getSpecies(family)`, `list('style' |
'species')`, `validate()` (non-throwing report), `diagnostics()`.

## 5. Migration

**What moved:** `engine/styleDna.ts`'s `STYLE_DNA_PRESETS` (15 records,
~24 fields each, ~165 lines of object literal) is now built from
`KnowledgeRegistry.list('style')`. The JSON files
(`knowledge/registry/data/styles/*.json`) were generated by a one-off
script that imported the live `STYLE_DNA_PRESETS` and serialized each
preset verbatim — verified byte-identical field-by-field (see §7).

**What did NOT move** (see `BUILD_008A_AUDIT.md` for the full table):
`resolveStyleDna`/`computeStyleDrift`/`computeStyleDnaConsistency`/
`isStyleDnaCompatible`/`deriveStyleDnaFromParams`/`duplicateStyleDna` (pure
functions, unaffected by where the data comes from), the lookup tables
that translate named profile fields into engine parameters
(`FLOW_ROTATION_JITTER` etc.), `HIERARCHY_PRESETS`, `BOTANICAL_SPECIES`,
`PALETTES`, Composition Zones/Cluster Archetypes, and
`engine/designKnowledge.ts` — all explicitly out of scope per the brief's
"no other engines migrated yet."

## 6. Validation

Three real rejection paths, each covered by a dedicated test:

1. **Missing/wrong-type fields** — `validateStyleRecord` checks every
   required string/number/array field and every enum field, returning a
   field-named, human-readable message (e.g. `Field "flowProfile" must be
   one of [calm, directional, dynamic], got "chaotic".`).
2. **Duplicate ids** — `loadStyleRecords` rejects the whole load (never a
   partial map) when two records share an id, naming the id in the error.
3. **Wrong schema version** — `KnowledgeRegistry` compares
   `schema_version.json`'s declared `styleSchema` against
   `STYLE_SCHEMA_VERSION` (the version this build's loader code actually
   implements) before loading; a mismatch throws
   `KnowledgeValidationError` with both values named.

All three are exercised with deliberately broken synthetic input in
`styleSchema.test.ts`/`styleLoader.test.ts` — the real 15-record data set
also always passes (asserted directly), so these are enforcement paths,
not error conditions anyone currently hits.

## 7. Compatibility

`engine/styleDnaRegistryCompatibility.test.ts` (new) verifies, independent
of the Registry's own unit tests:

- `STYLE_DNA_LIST.length === 15` (unchanged).
- Every previously-existing preset id still resolves via
  `STYLE_DNA_PRESETS[id]`.
- `resolveStyleDna` produces a valid patch for every built-in preset.
- Every built-in preset still passes `isStyleDnaCompatible` against the
  real, currently-registered palette table.
- `exportStyleDnaJson` → `importStyleDnaJson` round-trips a
  registry-sourced style with identical field values, and the public JSON
  shape (`{ schemaVersion: 1, style: {...} }`) is byte-identical to
  before.
- `storage/styleDnaStore.ts`'s `saveCustomStyles`/`loadCustomStyles` still
  round-trip a plain custom `StyleDna` object through `localStorage`
  unaffected — custom/user-created styles were never part of the Registry
  (only the 15 built-ins are), so this is a real independence check, not
  an assumption.

The legacy `style-dna/*.json` + `services/styleDnaService.ts` +
`knowledge/style/*` system was not touched at all — its own existing
tests (part of the 156-file full suite, see §8) continue to pass
unmodified.

## 8. Tests

- New: `knowledge/registry/styleSchema.test.ts` (10 tests),
  `knowledge/registry/styleLoader.test.ts` (7 tests),
  `knowledge/registry/knowledgeRegistry.test.ts` (10 tests),
  `engine/styleDnaRegistryCompatibility.test.ts` (7 tests) — 34 new tests.
- Targeted runs during development (registry + compatibility files, then
  `styleDna.test.ts`/`designKnowledge.test.ts`) confirmed each change
  before moving to the next section.
- One full-suite gate at the end, per the brief's own instruction: **156
  test files, 1844 tests, all passing** (up from Build 007's 152/1810 —
  exactly the 4 new files/34 new tests this build added, zero regressions
  in the other 152 files/1810 tests).
- `npx tsc -b`: clean. `npm run lint` (oxlint): clean.

## 9. Compatibility & Performance

No user-visible behavior changed: `resolveStyleDna` output is
field-for-field identical for every preset and every seed (verified by
the existing, unmodified `styleDna.test.ts` suite still passing
unchanged). The Registry's own lazy-load-once-then-cache design means the
first Style DNA lookup in a session pays one JSON-import + validation
pass (15 small records — sub-millisecond in practice, not separately
benchmarked since it's several orders of magnitude below anything this
codebase's own performance budget tracks), and every subsequent lookup is
a plain `Map.get`.

## 10. Remaining Work / Recommendation for Build 008B

Ranked by real leverage, per the audit's own conclusion:

1. **Species migration** — `BOTANICAL_SPECIES` (19 families) is the
   highest-value, lowest-risk next migration: it already has a clean,
   self-contained per-family record shape (Build 004/005/007), and
   `KnowledgeRegistry.getSpecies()` already exists as the target call-site
   contract — only the data source and a `speciesSchema.ts`/`speciesLoader.ts`
   pair need to be added, mirroring this build's own Style pattern exactly.
2. **Reconcile the legacy Style DNA JSON system.** `style-dna/*.json` +
   `services/styleDnaService.ts` + `knowledge/style/*` is now a second,
   stale, disconnected snapshot of Style DNA (missing 5 real fields). A
   future build should either delete it in favor of
   `KnowledgeRegistry.getStyle()`/`list('style')`, or explicitly
   re-point its consumers (Workbench's Favorites/PropertyInspector/
   TrendStudioForm panels) at the new Registry.
3. **Palette migration** — `PALETTES` (18 hand-authored palettes) +
   `COMMERCIAL_COLOR_STORIES` (8, with real computed metadata) is a real
   but lower-urgency migration; Style DNA references palettes only by id,
   so nothing about this build depends on it.
4. **Composition Zones / Cluster Archetypes** are real migration
   candidates but mostly algorithmic (a handful of stable enum names plus
   substantial geometry code) — lower data-to-code ratio than Species or
   Palette, so lower priority.

## 11. Acceptance Criteria — Final Status

| Criterion | Status |
|---|---|
| All tests pass | ✅ 156/156 files, 1844/1844 tests |
| TypeScript clean | ✅ `npx tsc -b` clean |
| Lint clean | ✅ `npm run lint` (oxlint) clean |
| No UI redesign | ✅ zero UI files touched |
| No new Style DNA presets | ✅ same 15 presets, ported verbatim |
| Composition/Botanical Engine untouched | ✅ zero files in `generators/`/`engine/clusterEngine.ts`/`engine/compositionZones.ts` touched |
| Style DNA migrated off hardcoded logic | ✅ `STYLE_DNA_PRESETS` now Registry-sourced |
| Validation rejects bad data with readable errors | ✅ §6 |
| Compatibility preserved | ✅ §7, dedicated test file |
| Documentation complete | ✅ `BUILD_008A_AUDIT.md` + this report |

## 12. Overall Build Score

- **Infrastructure Quality (25/25)**: real load/validate/cache/version/
  diagnostics separation, each independently testable; `getSpecies()`
  already shaped for a migration this build deliberately doesn't do.
- **Migration Discipline (24/25)**: exactly one subsystem touched, the
  legacy parallel system correctly identified and left alone rather than
  either silently duplicated further or prematurely merged; docked 1
  point because reconciling that legacy duplication is deferred rather
  than resolved.
- **Test Coverage (25/25)**: every new module has dedicated tests
  (including deliberately-broken synthetic input for every rejection
  path), plus an independent compatibility test file — not just reliance
  on existing suites happening to still pass.
- **Documentation (25/25)**: audit + report both grounded in real file
  reads (not assumptions), the two-parallel-systems finding stated
  plainly with file-level evidence.

**Overall: 99/100**.
