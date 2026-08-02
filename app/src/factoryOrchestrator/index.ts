// Mission 5 — Factory Orchestrator barrel.
//
// Part 4 — Single Source of Truth (enforced by import discipline, not
// just documentation): this module NEVER reimplements a decision, an
// execution step, a measurement, an improvement recommendation, or a
// production plan. Every one of those stays owned by its real authority:
//   - Decision authority   -> `decisionOS/` (via Production Autopilot's
//                              `evaluateGenerationGate`)
//   - Execution authority  -> `factory/` (Factory Controller)
//   - Measurement authority -> `factoryIntelligence/`
//   - Improvement authority -> `factoryImprovement/`
//   - Workflow authority    -> `productionAutopilot/` (`startFactoryWorkflow`,
//                              `ProductionSession`)
// `factoryOrchestrator/` only coordinates: it sequences calls into those
// five modules, carries a shared `FactoryExecutionContext` between them,
// and adds its own real bookkeeping (the `OrchestrationRun` state
// machine, the Commercial Readiness Gate, recovery, archiving) — none of
// which duplicates a decision/execution/measurement/improvement/plan a
// moment earlier subsystem already produced.
export * from './domain/types';
export * from './orchestrationRun';
export * from './executionContext';
export * from './productionLifecycle';
export * from './startFactory';
export * from './ownerInteraction';
export * from './errorHandling';
export * from './recovery';
export * from './sessionArchive';
export * from './commercialReadinessGate';
export { loadOrchestrationRuns, getOrchestrationRun, putOrchestrationRun, loadResumableOrchestrationRuns } from './storage/orchestrationRunStore';
export { loadProductionSessionArchives, getProductionSessionArchive, putProductionSessionArchive } from './storage/sessionArchiveStore';
