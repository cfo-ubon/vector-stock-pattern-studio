# BUILD 031C — AI Factory Controller — Report

**Repository:** `cfo-ubon/vector-stock-pattern-studio`
**Base branch:** `claude/build-030-ai-ceo-mission-control`
**Verified baseline:** Build 031B Hardening, commit `b72c82c`

## Status: PARTIALLY COMPLETE — honest disclosure below

The spec's 15 parts are large. This report documents exactly what was
built, tested, and verified, and what was explicitly **not** done, rather
than claiming full completion. This mirrors the disclosure convention set
by `BUILD_031B_HARDENING_REPORT.md` earlier in this branch's history.

## What "Factory Controller" means here

Decision OS (Build 031B) decides **what** should happen. The Factory
Controller decides **when / how / in which order**, using the already-
existing Autopilot, Commercial Pipeline, and Decision OS modules. It is a
coordination layer over Mission → Decision → Queue → Generator → QA →
Repair → SEO → Commercial Package → Export Ready — never a second AI,
never a redesign of any existing screen, never a replacement for Decision
OS.

## Files added/changed

**Domain + engines** (`app/src/factory/`):
- `domain/types.ts` — `FactoryTask`, `FactoryTaskType` (8 values),
  `FactoryTaskStatus` (6 values), `FactoryTimelineEntry`,
  `FactorySchedulerState`.
- `domain/factoryTask.ts` — state machine (`VALID_TRANSITIONS`,
  `transitionFactoryTask`, `InvalidFactoryTaskTransitionError`), task
  factory, id generators. Mirrors `autopilot/domain/autonomousDesignRun.ts`'s
  own pattern exactly.
- `dependencyEngine.ts` — Part 2. Resolves WAITING/READY/BLOCKED purely
  from each task's real `dependsOnTaskIds` edges (never from the advisory
  `FACTORY_TASK_TYPE_DEPENDENCIES` table at resolution time). A BLOCKED
  task's `blockedReason` always names the specific missing/cancelled
  dependency.
- `priorityEngine.ts` — Part 3. 4 independent Decision OS decisions (one
  per signal: high REVIEW/REJECT rate, large READY backlog, export-blocked
  packages, near-complete collections), so simultaneous true signals never
  silently collide into one shared `recommendedAction`.
- `batchController.ts` — Part 4. `createFactoryBatch` (one `generate` task
  per batch, count 10/30/50/100 or any positive number) +
  `expandFactoryBatchForAssets` (once `generate` produces real asset ids,
  builds the qa→{repair,seo}→package→exportValidation chain per asset with
  real task-id dependency edges).
- `scheduler.ts` — Part 5/8. `runNextFactoryTask` (lowest-priority READY
  task, one at a time, **never** auto-runs a `generate` task — Part 9),
  `replanFactoryQueue` (recomputes dependency status + priority boosts from
  scratch), `pauseFactoryScheduler`/`resumeFactoryScheduler`,
  `pauseGenerationOnRepairSpike`.
- `factoryMetrics.ts` — Part 7/10. `computeFactoryHealth`,
  `computeFactoryKpi`. Every rate with no real denominator yet reports
  `null` ("not enough data"), never a guessed 0 or 100.
- `taskExecutors.ts` — Part 1/5. 8 thin executors, each delegating to one
  already-existing module: `generateBatchToPortfolio` (generate),
  `prepareAutopilotSeoForItem` (seo), `buildCommercialPackage` +
  `recordCommercialPackageBuilt` (package), `canExportPackage` +
  `loadSafetyThresholdConfig` (exportValidation), `checkCollectionCompleteness`
  (collectionCompletion). No second implementation of generation, QA,
  repair, SEO, packaging, or completeness checking exists anywhere in
  this build.
- `index.ts` — barrel.

**Storage** (`app/src/factory/storage/`):
- `factoryQueueStore.ts`, `factoryTimelineStore.ts`,
  `factorySchedulerStateStore.ts` — `createGenericStore` pattern, 3 new
  IndexedDB stores (`storage/db.ts` `DB_VERSION` 14 → 15).

**Decision OS wiring**:
- `decisionOS/evidenceProviders/pipelineEvidence.ts`,
  `commercialEvidence.ts` — 2 new optional evidence fields
  (`readyBacklogCount`, `exportBlockedCount`) for the 2 dynamic-priority
  signals that had no existing single-asset evidence record to reuse.
- `decisionOS/policies/factoryPolicies.ts` — 4 new priority policies
  (`prioritizeRepairOnHighReviewRate`, `prioritizePackagingOnLargeBacklog`,
  `prioritizeExportValidationWhenBlocked`,
  `prioritizeCollectionCompletionWhenNear`), each its own distinct
  `requestedAction`.
- `decisionOS/adapters/factoryPriorityAdapter.ts` — new adapter, 4
  source-kind constants + 4 context builders.

**Backup**:
- `backup/appBackupFormat.ts` — `factoryQueue`, `factoryTimeline`,
  `factorySchedulerState` registered in `APP_BACKUP_STORE_NAMES`. No
  separate "Task History" store was added — each `FactoryTask.history`
  field is its own per-task audit trail (mirrors `AutonomousDesignRun`'s
  existing precedent), and `factoryTimeline` is the append-only global
  execution log the spec's "Task History" backup item maps to.

**Tests** (all new):
- `factory/domain/factoryTask.test.ts` — state machine, id generators,
  validity guard.
- `factory/dependencyEngine.test.ts` — WAITING→READY promotion, missing/
  cancelled-dependency blocking with named reasons, re-blocking, RUNNING/
  terminal tasks untouched.
- `factory/priorityEngine.test.ts` — each of the 4 signals independently,
  all 4 simultaneously (no signal dropped), boost/revert on
  `applyPriorityBoosts`.
- `factory/batchController.test.ts` — batch creation, per-asset expansion,
  real dependency-edge wiring, empty-asset-list edge case.
- `factory/scheduler.test.ts` — no-runnable-tasks case, generate never
  auto-run, Timeline entries appended, pause/resume, replan promotion +
  priority boost + `lastReplanAt`, `pauseGenerationOnRepairSpike`
  threshold behavior.
- `factory/factoryMetrics.test.ts` — empty-queue nulls, real
  completion/blocked/throughput counts, CANCELLED excluded from
  denominators, Timeline-derived KPI durations and efficiency.
- `backup/appBackup031CStores.test.ts` — non-empty and empty `.vspsb`
  round trips across all 3 new stores, following the
  `appBackup031BStores.test.ts` template exactly.

**Existing tests updated** (both were correctly failing on genuinely
stale frozen assertions from Build 031B, now updated to the new real
values — not weakened):
- `storage/db.migration.test.ts` — `DB_VERSION` assertions 14 → 15;
  fresh-database store list now includes `factoryQueue`, `factoryTimeline`,
  `factorySchedulerState`.
- `decisionOS/policies/factoryPolicies.test.ts` — `FACTORY_POLICIES`
  count assertion 7 → 11 (the 4 new priority policies).

**Docs**:
- `docs/USER_GUIDE.md` — v1.92 changelog entry (Thai), explicitly stating
  no new UI screen ships in this build.

## What was NOT built (explicit, honest gaps)

1. **No UI integration (Part 14).** The spec's "without changing UX" was
   interpreted conservatively: rather than risk introducing an untested,
   unverified new screen under significant session context pressure, this
   build ships the Factory Controller as a pure backend/engine layer with
   **zero UI surface** — nothing in `App.tsx` or any existing screen
   references it yet. This is the single largest gap versus the spec's
   literal ask (a Factory Timeline view, Factory KPI dashboard, and Batch
   Controller trigger were all named in the spec but not built). A future
   build should wire a minimal panel into Mission Control or the
   Commercial Pipeline view.
2. **No dedicated Part 13 performance test at 100+ packages.** The
   Scheduler/replan functions are architecturally O(n) per pass over the
   queue (no quadratic re-scan), and `replanFactoryQueue` only persists
   tasks that actually changed — but this was not empirically measured
   against a 100+ package queue the way Build 013's/Build 018's
   large-portfolio validation scripts did for other subsystems.
3. **No explicit "Offline" integration test.** Architecturally the entire
   Factory Controller module makes zero network calls (confirmed by
   inspection — every function is IndexedDB + pure computation only,
   consistent with every reused module it delegates to), but this was not
   verified with an actual airplane-mode/offline browser session the way
   Build 027's offline work was.
4. **No desktop/iPad browser verification.** Since there is no UI, there
   is nothing to browser-test. Once Part 14's UI is built, Part 15's
   Desktop/iPad Browser testing requirement will need to be satisfied
   then.
5. **The `pauseGenerationOnRepairSpike` repair-spike trigger and the
   Batch Controller's per-asset expansion are not wired into any
   automatic caller.** They exist as tested, callable functions but
   nothing in the codebase invokes them yet outside tests — a caller
   (either the eventual UI or a scheduled job) needs to call
   `expandFactoryBatchForAssets` after a `generate` task completes, and
   call `pauseGenerationOnRepairSpike` after `computeFactoryKpi` runs.

## What WAS verified

- `npx tsc -b` — clean, 0 errors, across the entire `app/` project
  (including every new/edited Factory Controller, Decision OS, storage,
  and backup file).
- `npm run lint` (oxlint) — clean; the only 2 warnings reported are
  pre-existing and unrelated to this build
  (`submissionPackageBuilder.ts`, `evidenceDisplay.tsx`).
- `npm run build` (`tsc -b && vite build`) — succeeds; `/studio` rebuilt
  with the current build output, per this repo's `CLAUDE.md` requirement.
- **Two consecutive full clean regressions**: `npx vitest run` — 437
  files / 4096 tests, 100% pass, run twice in a row with no failures on
  either pass. (One run in between hit 3 timeouts in pre-existing,
  unrelated `src/trend/collectionPlan.test.ts` /
  `src/trend/designSpecCollection.test.ts` files under full-suite resource
  contention — confirmed flaky, not a real regression, by re-running both
  files in isolation where they passed cleanly in ~1 minute combined.)
- 55 new Factory Controller unit/integration tests + 3 new backup
  round-trip tests, all passing.
- Business Safety (Part 9) verified structurally, not just by test: the
  Scheduler's `nextRunnableTask()` filter explicitly excludes
  `type === 'generate'`, so generation can only ever be triggered by an
  explicit external call to `executeGenerateTask` — confirmed by the
  `scheduler.test.ts` test asserting a queue containing only a READY
  `generate` task returns `ranTaskId: null`.

## Known limitations carried forward

- Same as Build 031B Hardening's own known-limitations list — nothing new
  introduced by this build breaks any of those.
- The Factory Controller has no automatic trigger loop (e.g. a
  `setInterval` calling `runNextFactoryTask`/`replanFactoryQueue`) — every
  call in this build is a function a future caller (UI button, scheduled
  job) must invoke explicitly. This is intentional (matches "no parallel
  execution unless already supported" and avoids inventing background
  polling infrastructure this spec didn't ask for), but means the Factory
  Controller does nothing on its own until something calls it.

## Commit

All work is on branch `claude/build-030-ai-ceo-mission-control`, on top
of Build 031B Hardening commit `b72c82c`. See git log for the exact
commit hash of this build's changes.
