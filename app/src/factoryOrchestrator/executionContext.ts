import type { FactoryTask, FactoryTimelineEntry } from '../factory/domain/types';
import { computeFactoryHealth } from '../factory/factoryMetrics';
import { computeBusinessOutcomeScore } from '../factoryIntelligence/businessOutcomeScore';
import type { ImprovementBacklogTask } from '../factoryImprovement/domain/types';
import type { OwnerDecisionRecord, ProductionSession } from '../productionAutopilot/domain/types';
import type { FactoryExecutionContext } from './domain/types';

// Mission 5, Part 3 — Execution Context. A pure builder (no storage
// access of its own — callers pass in already-loaded records, matching
// this codebase's own separation of pure engines from storage modules)
// that composes real data from Decision OS (via the session's own
// `DecisionTrace`), Factory Controller (`FactoryTask`/`FactoryTimelineEntry`),
// Factory Intelligence (`computeFactoryHealth`/`computeBusinessOutcomeScore`
// — reused, never recomputed a second way), Continuous Improvement (real
// Improvement Backlog task ids scoped to this run's batch), and
// Production Autopilot (the `ProductionSession` itself, and its own
// Owner Decision records). Part 11's "avoid duplicate calculations":
// this is the ONE place `computeFactoryHealth`/`computeBusinessOutcomeScore`
// are called per run — every other orchestrator function reads the
// result off this object instead of calling them again.

export function buildFactoryExecutionContext(
  runId: string,
  tasks: FactoryTask[],
  timeline: FactoryTimelineEntry[],
  ownerDecisionRecords: OwnerDecisionRecord[],
  improvementBacklog: ImprovementBacklogTask[],
  session: ProductionSession | null,
  now: number = Date.now(),
): FactoryExecutionContext {
  const factoryKpis = computeFactoryHealth(tasks, timeline, now);
  const businessOutcome = computeBusinessOutcomeScore(tasks, timeline, now);

  const decisionIds = session ? [session.decisionTrace.decisionId] : [];
  const policyIds = session ? session.plan.policyIds : [];
  const evidenceIds = session ? session.plan.evidenceIds : [];
  const ownerDecisions = session ? ownerDecisionRecords.filter((d) => d.sessionId === session.id) : [];
  const improvementReferences = session?.batchId ? improvementBacklog.filter((t) => t.sourceBatchId === session.batchId).map((t) => t.id) : [];

  return {
    runId,
    session,
    decisionIds,
    policyIds,
    evidenceIds,
    timeline,
    queue: tasks,
    factoryKpis,
    businessOutcome,
    ownerDecisions,
    improvementReferences,
    computedAt: now,
  };
}

/** Part 11 — incremental refresh: rebuilds only the two derived fields
 * (`factoryKpis`/`businessOutcome`) that can change as new
 * tasks/timeline entries arrive, reusing every other already-computed
 * field on the existing context instead of rebuilding it from scratch. */
export function refreshFactoryExecutionContext(context: FactoryExecutionContext, tasks: FactoryTask[], timeline: FactoryTimelineEntry[], now: number = Date.now()): FactoryExecutionContext {
  return {
    ...context,
    queue: tasks,
    timeline,
    factoryKpis: computeFactoryHealth(tasks, timeline, now),
    businessOutcome: computeBusinessOutcomeScore(tasks, timeline, now),
    computedAt: now,
  };
}
