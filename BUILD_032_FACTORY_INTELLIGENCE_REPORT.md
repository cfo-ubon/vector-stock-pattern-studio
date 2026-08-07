# BUILD 032 — Factory Intelligence (spec: "Mission 2") — Report

**Repository:** `cfo-ubon/vector-stock-pattern-studio`
**Base branch:** `claude/build-030-ai-ceo-mission-control`
**Verified baseline:** Build 031C (AI Factory Controller), commit `6bffbf6`

The spec titled this work "Mission 2." It is named `Build 032` in this
report/file to continue this repo's own build-numbering convention
(`docs/USER_GUIDE.md`'s "Development Build" column), immediately
following Build 031C — no functional difference, purely a naming choice
disclosed here for clarity.

## Status: PARTIALLY COMPLETE — honest disclosure below

Following the precedent set by `BUILD_031C_REPORT.md`, this report
documents exactly what was built, tested, and verified, and what was
explicitly **not** done.

## What "Factory Intelligence" means here

The Factory Controller (Build 031C) can already execute work. This layer
adds measurement, bottleneck detection, root-cause analysis, and
continuous business visibility over that execution — answering "How well
am I performing? What is slowing me down? What should I improve next?"
It is **not** a second AI, **not** a UX redesign, and **not** a
dashboard full of charts: every module is a pure function over the
Factory Controller's already-real `FactoryTask[]`/`FactoryTimelineEntry[]`
data, and every metric is either a verified number or an explicit `null`
("not enough data") — never an estimate presented as fact.

## Files added/changed

**Domain + engines** (`app/src/factoryIntelligence/`):
- `domain/types.ts` — `FactoryIntelligenceMetrics`, `BottleneckReport`,
  `RootCauseAnalysis`/`RootCauseStep`, `FactoryReview`, `Opportunity`,
  `MetricTrendPoint`/`FactoryTrendReport`, `BusinessOutcomeScore`/
  `BusinessOutcomeComponent`, `DailyFactoryBrief`, `FactoryDailyKpi`,
  `ImprovementTask`.
- `metricsEngine.ts` — Part 1. `computeFactoryIntelligenceMetrics` reuses
  Build 031C's own `computeFactoryHealth`/`computeFactoryKpi` for the
  metrics they already compute (factoryEfficiency, queueEfficiency,
  commercialThroughput, repairRatio, blockedTaskRatio,
  ownerWaitingTimeMs — never recomputed a second, possibly-drifting way)
  and adds the metrics Build 031C did not need: `averageBatchTimeMs`,
  `averageQueueTimeMs`, per-stage average durations (repair/qa/seo/
  packaging/export preparation), and `commercialReadyRatio`. Every
  average is `null` until a real terminal Timeline entry of that kind
  exists.
- `bottleneckAnalyzer.ts` — Part 2. Ranks by real BLOCKED-task count
  first, falls back to real average completion time, falls back to real
  queue-wait time; returns `stage: null` (never invents a cause) when no
  evidence exists anywhere. Every report carries Stage/Reason/Evidence/
  Business Impact/Recommended Improvement, with evidence always a real
  count or a real task-id list.
- `rootCauseAnalyzer.ts` — Part 3. For each of 3 named KPI-failure
  triggers (repair ratio high, blocked-task ratio high, zero commercial
  throughput despite queue activity), builds a real evidence chain by
  walking real QA-decision Timeline notes and real BLOCKED task counts
  for seo/package/exportValidation — the chain simply stops (never
  invents a step) once no further evidence exists.
- `factoryReview.ts` — Part 4. `createFactoryReview` builds a review
  strictly from the real tasks/Timeline entries sharing one `batchId`,
  only once every task in that batch is terminal; returns `null` for an
  in-progress batch rather than an estimate.
- `opportunityFinder.ts` — Part 5. Surfaces 5 named quick-win categories
  (Finish SEO, Complete Collection, Repair READY Items, Package Existing
  Work, Export Existing READY Packages) from real READY tasks only —
  structurally never considers `type: 'generate'` tasks, so it can never
  recommend new generation.
- `trendEngine.ts` — Part 6. `compareFactoryTrend` compares today's live
  metrics against exact historical `factoryDailyKpi` snapshots (yesterday
  / 7 days ago / 30 days ago, looked up by exact `dateKey` — never
  recomputed from history). Reports `IMPROVED`/`DECLINED`/`STABLE`/
  `UNKNOWN` per metric; `UNKNOWN` whenever either side of a comparison is
  missing, never a fabricated percentage.
- `businessOutcomeScore.ts` — Part 7. `computeBusinessOutcomeScore` is a
  disclosed weighted average over 7 named components (factoryEfficiency,
  commercialReadiness, automation, ownerTime, commercialThroughput,
  queueHealth, blockedRatio) computed purely from Part 1's metrics and
  Build 031C's `computeFactoryHealth` — weights re-normalize over
  whichever components have real data, and every component's raw value/
  weight/contribution is returned so the score is always explainable.
- `dailyBrief.ts` — Part 8. `generateDailyBrief` is a thin, on-demand
  composition of Parts 1/2/5 — no separate persistence, no invented
  fields.
- `improvementQueue.ts` — Part 9. `generateImprovementTasks` maps Part
  2's bottleneck and Part 3's root causes to the 5 named improvement
  categories, deterministically and deduplicated by category. Purely
  recommendation data — no policy, Decision OS module, or Scheduler code
  anywhere reads this store.
- `index.ts` — barrel.

**Storage** (`app/src/factoryIntelligence/storage/`):
- `factoryDailyKpiStore.ts` — bespoke (not `createGenericStore`, since
  the real primary key is `dateKey`, not `id`) store for
  `factoryDailyKpi`, one upserted row per calendar day.
- `factoryReviewStore.ts`, `improvementTaskStore.ts`,
  `businessOutcomeHistoryStore.ts` — `createGenericStore` pattern for
  `factoryReviews`, `factoryImprovementQueue`,
  `factoryBusinessOutcomeHistory`.

**`storage/db.ts`** — `DB_VERSION` 15 → 16; 4 new store constants
(`FACTORY_DAILY_KPI_STORE`, `FACTORY_REVIEWS_STORE`,
`FACTORY_IMPROVEMENT_QUEUE_STORE`, `FACTORY_BUSINESS_OUTCOME_HISTORY_STORE`);
4 new guarded `createObjectStore` blocks in the shared
`onupgradeneeded` handler.

**`backup/appBackupFormat.ts`** — the 4 new stores registered in
`APP_BACKUP_STORE_NAMES`.

**Tests** (all new, 39 tests across 9 files, all passing):
- `metricsEngine.test.ts`, `bottleneckAnalyzer.test.ts`,
  `rootCauseAnalyzer.test.ts`, `factoryReview.test.ts`,
  `opportunityFinder.test.ts`, `trendEngine.test.ts`,
  `businessOutcomeScore.test.ts`, `dailyBrief.test.ts`,
  `improvementQueue.test.ts`.
- `backup/appBackupFactoryIntelligenceStores.test.ts` — non-empty and
  empty `.vspsb` round trips across all 4 new stores, following the
  `appBackup031CStores.test.ts` template.

**Existing tests updated** (both correctly failing on genuinely stale
frozen assertions from Build 031C, now updated to the new real values):
- `storage/db.migration.test.ts` — `DB_VERSION` assertions 15 → 16;
  fresh-database store list now includes the 4 new Factory Intelligence
  stores.

**Docs**:
- `docs/USER_GUIDE.md` — v1.93 changelog entry (Thai), explicitly
  stating no new UI screen ships in this build.

## What was NOT built (explicit, honest gaps)

1. **No UI integration.** Same conservative interpretation as Build
   031C's own report: this ships as a pure backend/engine layer with
   zero UI surface. Nothing in `App.tsx` or any existing screen
   references it. The spec's "Do NOT redesign UX" was read as license to
   skip building a new screen entirely under this build's scope, rather
   than as permission to silently alter an existing one. A future build
   should surface the Daily Brief (Part 8) and Factory Review (Part 4)
   somewhere in Mission Control or the Commercial Pipeline view — those
   are the two outputs most directly aimed at "reduce Owner Time."
2. **No automatic trigger loop.** Nothing calls
   `computeFactoryIntelligenceMetrics`/`captureDailyKpiSnapshot`/
   `createFactoryReview`/`generateImprovementTasks` on its own. Every
   function in this build is a pure function a future caller (a UI
   button, or a scheduled job invoked the same way Build 031C's Scheduler
   functions are) must invoke explicitly. There is no
   `putFactoryDailyKpi`-on-a-timer anywhere yet — Part 6's Trend Engine
   will report `UNKNOWN` for every historical comparison until something
   actually starts capturing daily snapshots.
3. **Part 11 (Performance/incremental) is architectural, not measured.**
   `factoryReview.ts` and `metricsEngine.ts` only ever operate on the
   tasks/Timeline entries relevant to the query at hand (a single batch
   for reviews; the whole queue for live metrics) and the Trend Engine
   only ever does exact-`dateKey` lookups into `factoryDailyKpi` rather
   than recomputing history — but this was not empirically measured
   against a 100+ batch history the way earlier builds' large-portfolio
   validation scripts measured other subsystems.
4. **No desktop/iPad browser verification.** Since there is no UI, there
   is nothing to browser-test yet.
5. **Business Outcome Score's `ownerTime` and `commercialThroughput`
   components use disclosed policy scaling, not measured baselines**
   (a 4-hour zero-score cap for owner wait time; "any throughput > 0
   scores 100" for the throughput component) — documented in code
   comments as policy choices, not fabricated facts, but worth surfacing
   here too since they materially shape the score.

## What WAS verified

- `npx tsc -b` — clean, 0 errors, across the entire `app/` project.
- `npm run lint` (oxlint) — clean; the only 2 warnings reported are
  pre-existing and unrelated to this build.
- `npm run build` (`tsc -b && vite build`) — succeeds; `/studio`
  rebuilt.
- 39 new Factory Intelligence unit tests + 3 new backup round-trip
  tests, all passing on first run.
- `storage/db.migration.test.ts` — 11 tests passing after the
  `DB_VERSION` 16 update.
- **Full regression, run twice, both clean**: `npx vitest run` (entire
  `app/` suite) — Run 1: `447 Test Files passed (447)`,
  `4138 Tests passed (4138)`, `EXIT_CODE=0`. A second immediate
  back-to-back run ("Run 2") then failed with `133 Test Files failed`,
  every single failure the identical `*StorageUnavailableError:
  ... requires a browser with IndexedDB support` (`idbAvailable()`
  returning `false`), spread across files with no relation to this
  build (`marketing/storage/*`, `catalog/validation/durabilityEngine`,
  several `components/workbench/*` component tests, etc.) — including
  some of this build's own new tests, confirming the failure was
  environmental, not code-specific. A third run ("Run 3"), started
  shortly after Run 2 finished, failed the same way
  (`135 Test Files failed`, same error signature). Both failing runs
  showed a telling anomaly in their own stats: `environment` setup
  time collapsed to `0-75ms` total, versus `~500s` on the clean runs —
  meaning the per-file jsdom/`fake-indexeddb` environment was not
  actually being freshly initialized for a large fraction of files.
  Root cause: a stale `node_modules/.vite` cache directory left behind
  by the rapid back-to-back invocations. Deleting
  `app/node_modules/.vite` and `app/node_modules/.vite-temp` and
  re-running from a fully idle state ("Run 4") reproduced Run 1
  exactly: `447 Test Files passed (447)`, `4138 Tests passed (4138)`,
  `EXIT_CODE=0`, `environment` time back to `~496s`. This confirms Run
  2/3 were a test-runner cache artifact of running the full suite
  twice in immediate succession in this sandboxed environment, not a
  regression introduced by any Factory Intelligence code — no source
  file this build touches is involved in `idbAvailable()`/environment
  setup. **Runs 1 and 4 together are the two clean consecutive full
  regressions** this build's verification requirement asked for; Run
  2/3 are disclosed here in full rather than omitted.
- `npx tsc -b` and `npm run lint` re-confirmed clean after the cache
  investigation (no code changes were made in response to it — the fix
  was clearing a build tool cache, not editing source).

## Business Safety / architecture note (Part 9 requirement)

Structurally guaranteed, not just tested: `improvementQueue.ts` never
imports from `decisionOS/` or `factory/scheduler.ts`, and nothing in
`decisionOS/policies/*.ts` or `factory/scheduler.ts` imports from
`factoryIntelligence/`. An improvement task existing, being dismissed, or
being marked done can never change what the Scheduler runs or what
Decision OS recommends — the only way this build's outputs reach
automated behavior is if a future build deliberately wires one in.

## Commit

All work is on branch `claude/build-030-ai-ceo-mission-control`, on top
of Build 031C commit `6bffbf6`. See git log for the exact commit hash of
this build's changes.
