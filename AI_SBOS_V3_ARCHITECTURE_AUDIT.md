# AI-SBOS v3 — Architecture Audit (Milestone 0)

**Gate result: PROCEED. No P0 architecture conflict found.**

Every capability v3 needs already exists as a real, callable, well-typed
function in the v2/shared codebase. v3's own new code is limited to: (1) a
keyword→style-intent adapter (nothing today maps free text to a
`StyleDna`/`GenerateParams`), (2) a thin "seamless score" aggregate (the
existing `seamlessIntegrity` metric is a hardcoded `100`; the real signal,
`cornerContinuity`, already exists but isn't surfaced as a gate on its
own), (3) a positive vector-primitive whitelist check (today's check is a
raster/external-ref blacklist, which is sufficient for blocking bad output
but not for a "prove this is 100% vector" audit), and (4) UI screens. No
business logic needs to be duplicated anywhere.

## 1. Multi-version shell (already built, this mission reuses it as-is)

- **Deployment structure**: `/studio/` (Version Selector, hand-authored
  static page), `/studio/v1/` (frozen), `/studio/v2/` (current). v3 adds
  `/studio/v3/` as a fourth independently-built Vite app, same pattern as
  v2's own `base`/`outDir` config in `vite.config.ts`.
- **Version manifest pattern**: `app/src/appMeta.ts` (v2's single source
  of truth: `PRODUCT_NAME`, `PRODUCT_VERSION` (semver), `VERSION_STATUS`,
  `VERSION_SELECTOR_PATH`, `APP_VERSION`/`BUILD_NAME` (internal build
  counter, deliberately separate), `COMMIT` (build-time injected),
  `CHANGELOG`). v3 will have its own `appMeta.ts` (own product identity:
  "AI-SBOS v3" / "Keyword-to-Vector Seamless Factory"), never sharing a
  module with v2's — each version's identity is self-contained, matching
  the v1/v2 precedent (v1 has its own `versionManifest.ts`, not a shared
  file).
- **Service worker isolation**: each version's Workbox PWA config sets its
  own `scope`/`start_url`/`navigateFallback` under its own `/studio/vN/`
  path, giving each a distinct default precache cache name (no shared
  code needed — this is Vite/Workbox config, not application logic).
- **What's New leak prevention**: v2's `whatsNewStore.ts` namespaces its
  localStorage keys by version line (`aisbos.v2.whatsNew.*`) because
  localStorage is origin-scoped, not path-scoped. v3 must do the same
  (`aisbos.v3.whatsNew.*`) — this is a **required** pattern, not optional,
  confirmed by direct testing in the prior mission.

## 2. Generation engine (see full signatures researched this session — summarized here)

| Concern | Reuse this, verbatim | File |
|---|---|---|
| Core generation call | `buildTileForGenerate(params: GenerateParams)` | `src/engine/heroDetector.ts` |
| Single-shot tile build (used internally) | `buildTile(params)` | `src/engine/tile.ts` |
| Motif dispatch | `GENERATORS`/`GENERATOR_LIST` (14 categories) | `src/generators/index.ts` |
| Style→params resolution | `resolveStyleDna(dna: StyleDna, seed: string)` | `src/engine/styleDna.ts` |
| Style DNA library (15 built-in identities) | `STYLE_DNA_DATA`/`STYLE_DNA_DATA_BY_ID` | `src/style-dna/index.ts` |
| Scoring | `computeMetrics(tileData): CompositionMetrics` (28 fields) | `src/engine/scoring.ts` |
| Problem detection | `detectProblems(metrics, ctx)` | `src/critic/problems.ts` |
| Visual issue detection | `detectVisualIssues(tile, metrics)` | `src/critic/visualAnalysis.ts` |
| Real per-edit seam signal | `metrics.cornerContinuity` (via `computeMetrics`) | `src/engine/scoring.ts` |
| Repeat-tile preview (1×/2×/3×/4×) | `buildPreviewMarkup(tileData, repeat, instanceId)` | `src/export/previewMarkup.ts` |
| Diverse concept candidates | `generateBest(params, mode, qualityPreset)` / `generateCandidates(...)` | `src/engine/candidateEngine.ts` |
| SVG blacklist validity check | `checkSvgStringValidity(svgStr)`, `applyHardRejectRules(tileData)` | `src/engine/candidateEngine.ts` |
| Non-destructive versioning | `saveDesignVersion(...)`, `listDesignVersions(...)` | `src/design/designVersioning.ts` |
| Decision plan | `runDecisionSync(context, requiredSources)` | `src/decisionOS/decisionEngine.ts` |
| Factory orchestration | `drainFactoryQueue`, `createFactoryTask`, task executors | `src/factory/*.ts` |
| Commercial readiness | `computeCommercialReadiness(input)` (14 checks, 4 fundamental blockers) | `src/commercial/readinessEngine.ts` |
| SEO generation | `prepareAutopilotSeoForItem(patternId, params, marketplace)` | `src/autopilot/seoPreparation.ts` |
| Marketplace profiles | `MARKETPLACE_DATA_BY_ID`, `EXPORT_MARKETPLACE_OPTIONS` | `src/marketplaces/*.json`, `src/commercial/exportWorkflow.ts` |
| Duplicate detection (submission) | `detectDuplicateSubmission(candidate, existing)` | `src/catalog/submission/submissionDuplicateDetection.ts` |
| Duplicate detection (import) | `detectDuplicate(candidate, existingAssets)` | `src/catalog/import/duplicates.ts` |
| Catalog import | `importFileGroup(...)` | `src/catalog/import/importPipeline.ts` |
| Bulk marketplace export | `computeDuplicateSubmissionWarnings`, `executeBulkMarketplaceExport` | `src/commercial/bulkMarketplaceExport.ts` |
| Download Center | `DownloadCenter.tsx` (unmodified component reuse) | `src/components/portfolio/DownloadCenter.tsx` |

**No duplicate business logic will be written.** v3's own new modules are
listed in §3.

## 3. New adapters v3 must build (thin, all wrap the table above)

1. **`v3/keywordIntent.ts`** — keyword string → structured design intent
   → `GenerateParams` patch. Deterministic, local, rule-based (matches the
   mission's "reuse deterministic/local engines" instruction and "do not
   fabricate market-demand claims" constraint) — maps keyword tokens
   against `STYLE_DNA_DATA`'s existing category/mood/palette metadata and
   `GENERATOR_LIST`'s category ids, picks the closest matching
   `styleDnaId`/`categoryId`/`paletteId`, then calls `resolveStyleDna` for
   the rest. No new AI/ML model — a real, inspectable, testable mapping
   table plus token-overlap scoring.
2. **`v3/seamlessGate.ts`** — a real aggregate "SEAMLESS PASS/BLOCKED"
   decision from `metrics.cornerContinuity` (already computed, per-edit)
   plus a positive check that the 1×1 tile's edges tile cleanly (reusing
   `buildPreviewMarkup` to render a real 3×3 and inspecting for
   `svgHealth`/`cornerContinuity` thresholds) — not a new scoring engine,
   a threshold+report wrapper around metrics that already exist.
3. **`v3/vectorIntegrityGate.ts`** — extends `checkSvgStringValidity`'s
   blacklist with a positive whitelist pass (every node tag is in the
   existing closed `SvgTag` union from `engine/types.ts`; since generation
   already only ever emits that union via the `svgAst.ts` builder, this
   is a confirmation gate, not a new constraint on generation itself) —
   produces "VECTOR PASS/BLOCKED" per Milestone 7.
4. **`v3/commercialGate.ts`** — composes the 6 named mandatory gates
   (VECTOR/SEAMLESS/QUALITY/COMMERCIAL/METADATA/MARKETPLACE) by calling
   #2/#3 above plus the existing `computeCommercialReadiness` and
   `generateSeoPackage`/`prepareAutopilotSeoForItem` — a report
   aggregator, not new scoring.
5. **`v3/conceptDiversity.ts`** — thin wrapper choosing N meaningfully
   different `GenerateParams` seeds/composition-zone/layout combinations
   before handing each to `generateBest` (reuses candidateEngine's own
   seed-derivation and hard-reject/duplicate-rejection, does not
   reimplement it).
6. **v3 own UI screens** — Keyword Workspace, Design Brief, Preview
   Gallery, Refinement (wraps `DesignEditView`'s real flow),
   Production Workspace shell (wraps Today's Production Workspace's own
   Export/Marketplace/Download components, matching v2's own
   `commercial/bulkMarketplaceExport.ts` reuse pattern rather than a
   second copy).

## 4. Data / IndexedDB

`src/storage/db.ts`: single shared `vsp-db`, `DB_VERSION = 19` (confirmed
unchanged since Mission 5/Factory Orchestrator, well before Design
Refinement Studio Pro or the AI-SBOS Mission — i.e. v1 and v2 already
share byte-identical schema, proven in `AI_SBOS_VERSION_AUDIT.md`).

v3 introduces exactly one new concept the existing schema has no store
for: a **Keyword Session** (the keyword text, resolved design intent,
Design Brief, and the set of concept/candidate results generated from
it — needed for "Adjust"/re-generate and for Collection Mode grouping).
This is genuinely new data, not a reshape of an existing store, so it
requires a real `DB_VERSION` bump (`19 -> 20`, adding one new object
store, e.g. `keywordSessions`) following the existing, well-established
convention in `db.ts`'s own upgrade-comment history (purely additive
`onupgradeneeded` — never destructive, matching every prior bump from v1
through v18). Everything else v3 produces (`PortfolioAsset`,
`SubmissionRecord`, `QualitySnapshot`, `CommercialPackageHistoryEntry`)
reuses the existing stores exactly as Autopilot/Factory do today — **no
isolation needed for those**, per the same evidence
`AI_SBOS_VERSION_AUDIT.md` already established for v1/v2 (shared,
additive-only schema is safe; isolating would only fragment data with no
compatibility benefit). The one new store is additive-only and
100% backward compatible: v1 and v2 simply never read or write
`keywordSessions` and are otherwise completely unaffected — confirmed
against `db.ts`'s upgrade pattern, which creates new stores without
touching existing ones.

## 5. Backup

`src/backup/appBackupFormat.ts`'s `APP_BACKUP_STORE_NAMES` list is a
manually-registered whitelist ("register a store only once it holds real
data," per the file's own convention). v3's one new store
(`keywordSessions`) must be added to this list — the exact same
one-line-per-build pattern already used for every prior store addition
(Build 026 through Mission 5). No format/schema-version change needed
(`APP_BACKUP_SCHEMA_VERSION` stays `1` — only the *list of stores backed
up* grows, matching how every prior build added its own stores to this
same list without bumping the schema version).

## 6. Portfolio / Production Workspace / Commercial Pipeline

All reused as-is, matching the v2 Production Workspace's own precedent
(`PRODUCTION_WORKSPACE_GUIDE.md`): v3's Production Workspace screen calls
the same `commercial/bulkMarketplaceExport.ts`, `DownloadCenter.tsx`, and
`computeCommercialReadiness`/SEO functions v2 already uses — v3 is a
**new front door** (keyword-driven) onto the **same back-end pipeline**,
not a parallel pipeline. Portfolio itself needs zero changes — assets
generated by v3 import through the same `importFileGroup` as any other
generator and appear in the one shared Portfolio catalog, filterable like
any other asset (a future enhancement, not required for this mission, is
tagging assets with their originating keyword — deferred unless
requested).

## 7. Conclusion

**PROCEED.** No P0 conflict. One real (additive, non-destructive, fully
backward-compatible) `DB_VERSION` bump is needed for the one genuinely new
concept (Keyword Session); everything else is direct reuse. Proceeding to
V3-A per the mission's own delivery strategy (Milestone 34).
