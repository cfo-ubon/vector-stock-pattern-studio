# Build 035 (spec: Mission 5) — Factory Orchestrator

## Naming disclosure

The spec was titled "Mission 5 / Factory Orchestrator" and referenced
"Mission 4 Production Autopilot" (commit `24a7cf3`) as the verified
baseline. This build is numbered **Build 035** for continuity with this
repository's own sequential Build numbering (Build 031A/031B/031C, Build
032 = Mission 2, Build 033 = Mission 3, Build 034 = Mission 4) — Mission 5
is this sequence's next build, not a renumbering of anything before it.

## What this means

The Factory already had five independent capabilities: Decide (Decision
OS, Build 031B), Execute (Factory Controller, Build 031C), Measure
(Factory Intelligence, Build 032/Mission 2), Improve (Continuous Factory
Improvement, Build 033/Mission 3), and Plan (Production Autopilot, Build
034/Mission 4). This build makes them behave as **one factory** by adding
a single coordination layer — `StartFactory()` — on top of all five,
without touching, duplicating, or re-deciding anything any of them already
owns. `factoryOrchestrator/` contains zero business-decision logic; every
real decision is still made by the same five modules it always was.

## Files

**New module — `app/src/factoryOrchestrator/`:**
- `domain/types.ts` — Part 2/3/6/7/9/10 domain types: `OrchestrationRun`
  (11-state `OrchestrationStatus`), `FactoryExecutionContext`,
  `OrchestrationResult`/`OrchestrationError`, `OwnerInteractionSummary`,
  `FactoryRecoveryResult`, `ProductionSessionArchive`,
  `CommercialReadinessGateResult`, `StartFactoryResult`.
- `orchestrationRun.ts` — Part 2's 11-state machine (Idle → Preparing →
  Preflight → Planning → WaitingOwnerApproval → Running →
  Paused/Blocked → Completed/Cancelled/Failed), layered strictly on top
  of — never replacing — `productionAutopilot/productionSession.ts`'s
  own unchanged 5-state machine.
- `executionContext.ts` — Part 3/11. `buildFactoryExecutionContext`
  (pure builder from already-loaded records) and
  `refreshFactoryExecutionContext` (recomputes only
  `factoryKpis`/`businessOutcome`/`queue`/`timeline`, preserving
  everything else — Part 11's "incremental updates only").
- `errorHandling.ts` — Part 7. `OrchestrationResult<T>` +
  `runOrchestrationStep`/`runOrchestrationStepWithRetry`/
  `runOrchestrationStepWithRollback` — every engine call returns a typed
  result, nothing is ever silently swallowed.
- `commercialReadinessGate.ts` — Part 10. Composes exactly three
  already-real checks (Factory Controller's `explainBlockedTasks`,
  Factory Intelligence's `createFactoryReview`, the run's own real
  `DecisionTrace.blockedReasons`) — never a fourth scoring model.
- `ownerInteraction.ts` — Part 6. `summarizeOwnerInteraction` reuses
  Production Autopilot's own `OwnerDecisionRecord`s and
  `countOwnerDecisionsToday`/`isWithinDailyDecisionTarget` (same ≤3/day
  target) — no second decision-tracking system.
- `productionLifecycle.ts` — Part 5. Ten lifecycle actions (Prepare,
  Validate, Plan, Approve, Execute, Pause, Resume, Cancel, Complete,
  Archive) over the Part 2 state machine plus the underlying
  `ProductionSession`. `completeFactoryRun` calls Part 10's gate first and
  refuses (a typed `BLOCKED` result, never a thrown error) unless all
  three authorities agree.
- `sessionArchive.ts` — Part 9. `buildProductionSessionArchive` filters
  already-persisted full stores down to the records that belong to this
  run's batch/decisions/session — never a second full copy.
- `recovery.ts` — Part 8. `recoverQueue`/`recoverTimeline`/
  `recoverFactoryState` re-read real durable stores;
  `resumeInterruptedFactoryRun` finds the most recent non-terminal
  `OrchestrationRun` and rebuilds its real `FactoryExecutionContext`,
  returning an honest `recovered: false` when nothing was interrupted.
- `startFactory.ts` — Part 1. `StartFactory()`, the single production
  entry point. Reuses `productionAutopilot/factoryWorkflow.ts`'s
  `startFactoryWorkflow` (which already composes Decision OS → Factory
  Controller → Factory Intelligence → Continuous Improvement) as its
  middle stage, then creates and persists an `OrchestrationRun` +
  `ProductionSession`. Always returns `requiresOwnerApproval: true`.
- `storage/orchestrationRunStore.ts`, `storage/sessionArchiveStore.ts` —
  two `createGenericStore`-based IndexedDB stores.
- `index.ts` — barrel, with an explicit Part 4 "Single Source of Truth"
  header documenting which module owns which authority.

**Edited:**
- `app/src/storage/db.ts` — `DB_VERSION` 18 → 19; adds
  `factoryOrchestrationRuns`, `factoryOrchestrationArchives` object stores
  in the shared `onupgradeneeded` handler.
- `app/src/backup/appBackupFormat.ts` — registers the 2 new stores in
  `APP_BACKUP_STORE_NAMES`.
- `app/src/storage/db.migration.test.ts` — `DB_VERSION` assertions bumped
  18 → 19 (every occurrence); the 2 new stores added to the
  fresh-database store-list check.

**New tests** (one file per engine module, plus a dedicated backup
round-trip file, following this repo's established convention):
`orchestrationRun.test.ts`, `executionContext.test.ts`,
`errorHandling.test.ts`, `commercialReadinessGate.test.ts`,
`ownerInteraction.test.ts`, `productionLifecycle.test.ts`,
`recovery.test.ts`, `sessionArchive.test.ts`, `startFactory.test.ts` (all
in `app/src/factoryOrchestrator/`), and
`app/src/backup/appBackupFactoryOrchestratorStores.test.ts`.

**New audit doc:** `FACTORY_ORCHESTRATOR_AUDIT.md` (Part 14's explicit
deliverable) — lists every real integration point between the five
subsystems and the new orchestration layer (Caller / Previous Flow / New
Flow / Migration Status / Remaining Duplication), confirming `StartFactory()`
is the single entry point and no business workflow was duplicated.

## What was NOT built (honest disclosure)

There is **no new UI** in this build — no new screen, no new menu, no
"START FACTORY" button wired into any component. This is a deliberate,
self-directed scope decision, directly supported by the spec's own
closing constraints ("Do NOT redesign UI. Do NOT add unnecessary menus.").
`StartFactory()` is architected as the single function a future button
would call — every stage it needs (Prepare, Preflight, Plan, the Owner
Approval gate, Execute, Complete, Archive, Recovery) is already wired and
tested — so adding that button later is additive, not a redesign.

No automatic scheduler/timer calls `StartFactory()` on its own; something
(a future UI, or a future timer) must call it. This is the same disclosed
gap Mission 4's report noted for `startFactoryWorkflow`.

## What WAS verified

- `npx tsc -b` — clean, zero errors, across the whole app.
- `npm run lint` (oxlint) — clean; only 2 pre-existing warnings unrelated
  to this build (`submissionPackageBuilder.ts` no-control-regex,
  `evidenceDisplay.tsx` only-export-components).
- `npm run build` — clean production build; `/studio` rebuilt with the
  current bundle.
- Full regression suite, run twice clean (`node_modules/.vite`/`.vite-temp`
  cleared before each run, both runs executed explicitly from within
  `app/`):
  - Run 1: **478 test files passed (478), 4308 tests passed (4308)**.
  - Run 2: **478 test files passed (478), 4308 tests passed (4308)**
    (identical to run 1).
  - One real test bug was found and fixed during verification (not a
    module bug): `productionLifecycle.test.ts`'s "completes both run and
    session once the gate agrees" test called `completeFactoryRun` against
    a `ProductionSession` still in its initial `PLANNED` status — the real
    `productionSession.ts` state machine correctly rejected the
    `PLANNED → COMPLETED` transition (`RUNNING → COMPLETED` is the only
    valid path). Fixed by transitioning the test's session through
    `APPROVED → RUNNING` before completing it, matching the real lifecycle
    every other test in the suite already exercises.

## Business Safety / architecture note

- **Single Source of Truth preserved (Part 4)**: Decision OS remains the
  only decision authority, Factory Controller the only execution
  authority, Factory Intelligence the only measurement authority,
  Continuous Improvement the only improvement authority, Production
  Autopilot the workflow coordinator. `factoryOrchestrator/` only
  coordinates — verified in `FACTORY_ORCHESTRATOR_AUDIT.md`.
- **Owner approval is structural, not conventional**:
  `StartFactoryResult.requiresOwnerApproval` is typed as the literal
  `true` — the type system itself prevents this module from ever
  representing an auto-approved workflow.
- **Commercial completion is gated, not assumed (Part 10)**:
  `completeFactoryRun` refuses (typed `BLOCKED`, never a crash) unless
  Decision OS, Factory Controller, and Factory Intelligence all agree.
- **Errors are never hidden (Part 7)**: every engine call inside the
  orchestrator is wrapped by `runOrchestrationStep`, converting any thrown
  exception into a typed `OrchestrationError` rather than crashing or
  silently continuing.
- **No fabricated evidence**: every honest-empty case (no batch attached,
  no session yet, nothing to recover, no real decision trace) is returned
  as `null`/`[]`/`false` with a real reason string — never guessed.

## Commit

Committed to branch `claude/build-030-ai-ceo-mission-control`.
