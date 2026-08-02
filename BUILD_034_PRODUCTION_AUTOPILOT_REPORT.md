# Build 034 (spec: Mission 4) — Production Autopilot

## Naming disclosure

The spec was titled "Mission 4 / Production Autopilot" and referenced
"Build 033 latest commit" as the verified baseline. This build is numbered
**Build 034** for continuity with this repository's own sequential Build
numbering (Build 031A/031B/031C, Build 032 = Mission 2, Build 033 =
Mission 3) — Mission 4 is this sequence's next build, not a renumbering of
anything that came before.

## What this means

The Factory could already Decide (Decision OS, Build 031B), Execute
(Factory Controller, Build 031C), Measure (Factory Intelligence, Mission
2/Build 032), and Improve (Continuous Factory Improvement, Mission
3/Build 033). This build makes the Factory **prepare its own production
session** — the owner no longer has to manually assemble today's plan.
Every function in this module composes an already-real engine from one of
those four prior builds; nothing here invents a new decision-making
authority, a new UX, or a new menu.

## Files

**New module — `app/src/productionAutopilot/`:**
- `domain/types.ts` — every Mission 4 domain type (`ProductionActionType`,
  `PreflightCheck`/`PreflightValidationResult`, `ProductionSessionPlan`,
  `ProductionQueueReview`, `FactoryWorkflowResult`, `OwnerDecisionRecord`,
  `ProductionCompletionReview`, `ContinueYesterdayCheck`,
  `ProductionDailyBrief`, `ProductionSession`/history,
  `ProductionAutopilotState`)
- `preflightValidation.ts` — Part 3. Reuses `autopilot/generationGate.ts`'s
  `evaluateGenerationGate` (the real, already-tested Decision OS
  `domain:'factory', requestedAction:'generate'` evaluation from Build
  031B Hardening) for the "should we generate now" question; every other
  check is a real counted READY/BLOCKED tally.
- `productionRecommendation.ts` — Part 4. Reuses
  `factoryIntelligence/opportunityFinder.ts`'s `findOpportunities`;
  priority order (`CONTINUE_PREVIOUS_BATCH > REPAIR > SEO > PACKAGE >
  EXPORT > FINISH_COLLECTION > GENERATE`) mirrors the real policy sequence
  already encoded in `decisionOS/policies/factoryPolicies.ts`.
- `productionSessionPlanner.ts` — Part 1. Reuses
  `computeFactoryIntelligenceMetrics`/`computeBusinessOutcomeScore`
  (Build 032). `targetPackages` counts real READY package/export tasks
  close to completion — never a fabricated goal.
- `productionQueueReview.ts` — Part 6. Reuses `analyzeBottleneck` (Build
  032) + `simulateAllOptimizations` (Build 033).
- `factoryWorkflow.ts` — Part 2. The ONE `startFactoryWorkflow` function:
  Decision Review → Queue Validation → Dependency Validation (reuses
  `factory/dependencyEngine.ts`'s `explainBlockedTasks`) → Improvement
  Validation (reuses `factoryImprovement/improvementEngine.ts`'s
  `identifyImprovementCandidates`) → Production Plan → recommendation.
  `requiresOwnerApproval: true` is a TypeScript literal type — this
  function structurally cannot self-approve.
- `ownerDecision.ts` — Part 5. Real, timestamped decision records; count
  today's decisions against the disclosed `DAILY_OWNER_DECISION_TARGET = 3`.
- `productionCompletionReview.ts` — Part 7. Reuses `createFactoryReview` +
  `computeBusinessOutcomeScore` (Build 032) +
  `identifyImprovementCandidatesForCompletedBatch` (Build 033).
- `continueYesterdayFactory.ts` — Part 8. Batch-level "continue unfinished
  work" — distinct from `aiCeo/continueYesterday.ts`'s asset-generation-run
  concept (different domain, same "pick, don't invent" philosophy).
- `dailyFactoryBrief.ts` — Part 10. Reuses `factoryIntelligence/dailyBrief.ts`'s
  `generateDailyBrief` (Build 032) + `factory/factoryMetrics.ts`'s
  `computeFactoryHealth` (Build 031C).
- `productionSession.ts` — Part 9/13. `ProductionSession` lifecycle
  (`PLANNED → APPROVED → RUNNING → COMPLETED/CANCELLED`), mirroring
  `autopilot/domain/autonomousDesignRun.ts`'s own state-machine shape.
- `storage/productionSessionStore.ts`, `storage/ownerDecisionStore.ts`,
  `storage/productionAutopilotStateStore.ts` — three
  `createGenericStore`-based IndexedDB stores.
- `index.ts` — barrel.

**Edited:**
- `app/src/storage/db.ts` — `DB_VERSION` 17 → 18; adds
  `factoryProductionSessions`, `factoryOwnerDecisions`,
  `factoryProductionAutopilotState` object stores in the shared
  `onupgradeneeded` handler.
- `app/src/backup/appBackupFormat.ts` — registers the 3 new stores in
  `APP_BACKUP_STORE_NAMES`.
- `app/src/storage/db.migration.test.ts` — `DB_VERSION` assertions bumped
  17 → 18; the 3 new stores added to the fresh-database store-list check.

**New tests** (one file per engine module, plus a dedicated backup
round-trip file, following this repo's established convention):
`preflightValidation.test.ts`, `productionRecommendation.test.ts`,
`productionSessionPlanner.test.ts`, `productionQueueReview.test.ts`,
`factoryWorkflow.test.ts`, `ownerDecision.test.ts`,
`productionCompletionReview.test.ts`, `continueYesterdayFactory.test.ts`,
`dailyFactoryBrief.test.ts`, `productionSession.test.ts` (all in
`app/src/productionAutopilot/`), and
`app/src/backup/appBackupProductionAutopilotStores.test.ts`.

## What was NOT built (honest disclosure)

There is **no new UI** in this build — no "START FACTORY" button, no new
screen. This is a deliberate, self-directed scope decision, consistent
with how Mission 2 (Build 032) and Mission 3 (Build 033) were shipped
before it, and directly supported by the spec's own closing constraints
("Do NOT redesign UX. Do NOT add unnecessary menus."). `startFactoryWorkflow`
is architected as the single function a future "START FACTORY" button
would call — every stage it needs (Decision Review, Queue Validation,
Dependency Validation, Improvement Validation, Production Plan,
Recommendation) is already wired and tested — so wiring a button to it
later is additive, not a redesign.

No automatic scheduler/timer creates a Production Session on its own;
something (a future UI, or a future timer) must call `startFactoryWorkflow`
and `createProductionSession`. This is the same disclosed gap Mission 3's
report noted for its own Backlog/Experiment/Review functions.

## What WAS verified

- `npx tsc -b` — clean, zero errors, across the whole app.
- `npm run lint` (oxlint) — clean; only 2 pre-existing warnings unrelated
  to this build.
- `npm run build` — clean production build; `/studio` rebuilt with the
  current bundle.
- Full regression suite, run twice clean (`node_modules/.vite`/`.vite-temp`
  cleared before each run):
  - Run 1: **468 test files passed (468), 4241 tests passed (4241)**.
  - Run 2: **468 test files passed (468), 4241 tests passed (4241)**
    (identical to run 1).
  - (Two earlier attempts at the second run failed with widespread
    "IndexedDB unavailable" errors across unrelated files — traced to the
    shell's working directory having reverted to the repo root between
    commands, so `vitest` ran without `app/`'s config and skipped
    `setupFiles`, not a code regression. Confirmed by the failing runs'
    own summary line reporting `setup 0ms` instead of the normal ~79s, and
    by the log's own `RUN v4.1.10 /home/user/vector-stock-pattern-studio`
    path — missing the `/app` suffix every successful run shows. Rerunning
    explicitly from `app/` produced the clean, reproducible result above.)

## Business Safety / architecture note

- **Never generates against Decision OS**: `preflightValidation.ts`
  reuses the exact, already-tested `evaluateGenerationGate` — this module
  has no second, competing "should we generate" implementation.
- **Owner approval is structural, not conventional**:
  `FactoryWorkflowResult.requiresOwnerApproval` is typed as the literal
  `true` — the type system itself prevents this module from ever
  representing an auto-approved workflow.
- **Export stays owner-approved**: nothing in this module uploads or
  finalizes an export; `OwnerDecisionType` includes `APPROVE_EXPORT` as a
  recorded decision, never an automatic action.
- **Every recommendation is traceable**: `ProductionRecommendation`
  always carries `evidence`, `sourceTaskIds`, and (when it comes from
  Decision OS) `decisionTrace` — never a bare assertion.
- **No duplicated workflow**: `startFactoryWorkflow` is the one function;
  every stage inside it calls exactly one existing engine.

## Commit

Committed to branch `claude/build-030-ai-ceo-mission-control`.
