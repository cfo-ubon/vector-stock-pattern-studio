# Mission 5 — Factory Orchestrator Integration Audit

Companion document to `BUILD_035_FACTORY_ORCHESTRATOR_REPORT.md` (Part 14).
Every real integration point between the five existing production
subsystems (Decision OS, Factory Controller, Factory Intelligence,
Continuous Improvement, Production Autopilot) and the new Factory
Orchestrator is listed below, confirming `StartFactory()` is the single
production entry point and that no business workflow was duplicated to
build it.

Columns: **Caller** (the module/function that touches the integration
point) · **Previous Flow** (how it worked before Mission 5) · **New Flow**
(how it works now) · **Migration Status** · **Remaining Duplication**.

---

## 1. The unified workflow entry point

| Caller | Previous Flow | New Flow | Migration Status | Remaining Duplication |
|---|---|---|---|---|
| Any future "Start Production" caller (no UI wired yet — see report's UI-gap disclosure) | Would have to call `startFactoryWorkflow()` directly, then separately call `createProductionSession()`, and track its own factory-level run state ad hoc — no single call existed. | Calls `StartFactory()` (`factoryOrchestrator/startFactory.ts`) once. It runs the real Preflight -> Plan -> Session sequence and returns a persisted `OrchestrationRun` + `FactoryExecutionContext`, always `requiresOwnerApproval: true`. | **Complete** — single entry point exists and is fully tested (`startFactory.test.ts`). | None — `StartFactory()` is the only wrapper; it contains no business logic of its own beyond sequencing and persistence. |

## 2. Production Autopilot's own workflow (`productionAutopilot/factoryWorkflow.ts`)

| Caller | Previous Flow | New Flow | Migration Status | Remaining Duplication |
|---|---|---|---|---|
| `startFactoryWorkflow()` | Mission 4's own top-level function — the highest-level entry point in the codebase before Mission 5, composing Decision Review -> Queue Validation -> Dependency Validation -> Improvement Validation -> Production Plan -> Recommendation. | Unchanged internally. Now invoked as the middle stage of `StartFactory()` rather than being any external caller's direct top-level call. | **Wrapped, not duplicated.** | None — `StartFactory()` calls it exactly once and does not re-implement any of its 5 internal stages. |

## 3. Decision OS (`productionAutopilot/preflightValidation.ts` -> `autopilot/generationGate.ts`)

| Caller | Previous Flow | New Flow | Migration Status | Remaining Duplication |
|---|---|---|---|---|
| `factoryWorkflow.ts` (Stage 1), `dailyFactoryBrief.ts`, `productionCompletionReview.ts` | Three independent call sites, pre-existing since Mission 4 — one starts a plan, two are read-only reporting views (daily brief, completion review). | Factory Orchestrator does **not** call `runPreflightValidation()` directly at all — it only receives the result via `workflow.decisionReview` returned from `startFactoryWorkflow()`. | **No change** — the three pre-existing call sites are untouched. | None — the reporting call sites re-read the same real Decision OS gate for their own display purposes; they were never a competing "start production" flow. |

## 4. Factory Controller (`factory/dependencyEngine.ts`'s `explainBlockedTasks`)

| Caller | Previous Flow | New Flow | Migration Status | Remaining Duplication |
|---|---|---|---|---|
| `factoryWorkflow.ts` (Stage 3, dependency notices) | Sole caller before Mission 5. | Also called by `factoryOrchestrator/commercialReadinessGate.ts` (Part 10's Factory Controller agreement check), scoped to the run's own `batchId`. | **New read-only call site added.** | None — both call sites consume the same single real dependency-graph function; neither recomputes a second blocked-task judgment. |

## 5. Factory Intelligence (`factoryIntelligence/factoryReview.ts`'s `createFactoryReview`)

| Caller | Previous Flow | New Flow | Migration Status | Remaining Duplication |
|---|---|---|---|---|
| `productionAutopilot/productionCompletionReview.ts` (batch completion review) | Sole caller before Mission 5. | Also called by `commercialReadinessGate.ts`'s Factory Intelligence agreement check. | **New read-only call site added.** | None — same reasoning as #4; the Commercial Readiness Gate never scores a batch itself. |

## 6. Continuous Improvement (`factoryImprovement/improvementEngine.ts`'s `identifyImprovementCandidates`)

| Caller | Previous Flow | New Flow | Migration Status | Remaining Duplication |
|---|---|---|---|---|
| `factoryWorkflow.ts` (Stage 4, improvement notices) | Sole caller before Mission 5. | Unchanged — Factory Orchestrator never calls this directly. `FactoryExecutionContext.improvementReferences` (Part 3) instead reads the already-durable `factoryImprovement/storage/improvementBacklogStore.ts`, a different, pre-existing read — not a re-decision of which candidates matter. | **No change.** | None. |

## 7. Commercial Readiness — per-asset engine vs. Part 10's batch gate

| Caller | Previous Flow | New Flow | Migration Status | Remaining Duplication |
|---|---|---|---|---|
| `commercial/readinessEngine.ts` (Build 031A, per-asset 14-check score) | Independent per-asset scoring engine used by the Commercial Pipeline / Export Readiness views. | **Untouched.** Part 10's `checkCommercialReadinessGate()` is a separate, smaller, batch-scoped check (3 real agreements: Decision OS trace, Factory Controller blocked-task scan, Factory Intelligence review) used only inside `completeFactoryRun()` to gate a *run's* completion — a different question at a different granularity from "is this one asset commercially ready." | **Deliberately not merged** — merging would misapply a per-asset scoring model to a batch-level gate, or vice versa. Documented explicitly in the Mission 5 conversation record and in code comments. | None new — both remain distinct, real authorities at their own granularity; neither recomputes the other. |

## 8. Production session state machine vs. the new orchestration state machine

| Caller | Previous Flow | New Flow | Migration Status | Remaining Duplication |
|---|---|---|---|---|
| `productionAutopilot/productionSession.ts` (5-state: `PLANNED -> APPROVED -> RUNNING -> COMPLETED`/`CANCELLED`) | Mission 4's sole state machine for a production run. | **Unchanged and still the only session-level state machine.** `orchestrationRun.ts`'s new 11-state machine (Part 2) is layered strictly on top — `productionLifecycle.ts`'s `approveFactoryRun`/`executeFactoryRun`/`completeFactoryRun` call the real `productionSession.ts` transition functions rather than reimplementing session transitions. | **Two machines coexist by design**, mapped 1:1 at every shared transition (documented in `orchestrationRun.ts`'s header comment). | None — orchestration states track factory-wide lifecycle stages (`PREFLIGHT`/`PLANNING`/`BLOCKED`/recovery) the session machine never modeled; session states track the session's own approve/run/complete lifecycle that the orchestration machine never re-implements. |

## 9. Owner interaction tracking (`productionAutopilot/ownerDecision.ts`)

| Caller | Previous Flow | New Flow | Migration Status | Remaining Duplication |
|---|---|---|---|---|
| `OwnerDecisionRecord` + `countOwnerDecisionsToday` / `isWithinDailyDecisionTarget` | Mission 4's owner-decision tracking, ≤3/day target. | Part 6's `ownerInteraction.ts`'s `summarizeOwnerInteraction` reads these exact functions/records — no new tracking store, no second daily counter. | **Reused as-is.** | None. |

## 10. Backup coverage (`backup/appBackupFormat.ts`)

| Caller | Previous Flow | New Flow | Migration Status | Remaining Duplication |
|---|---|---|---|---|
| `APP_BACKUP_STORE_NAMES` | Covered every store through Mission 4's `factoryProductionAutopilotState`. | Appended (not replaced) with the two new Mission 5 stores (`factoryOrchestrationRuns`, `factoryOrchestrationArchives`). | **Additive.** | None — no existing store's backup coverage was altered. |

---

## Conclusion

`StartFactory()` is confirmed as the single production entry point.
Every one of the five subsystems' authorities (Decision OS, Factory
Controller, Factory Intelligence, Continuous Improvement, Production
Autopilot) is reused by direct function call, never re-implemented. The
two new read-only call sites added in this mission (`explainBlockedTasks`,
`createFactoryReview`, both inside `commercialReadinessGate.ts`) consume
already-existing real functions and introduce no second decision, scoring,
or state-tracking system anywhere in the codebase.
