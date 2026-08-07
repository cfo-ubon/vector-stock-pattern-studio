import type { FactoryTimelineEntry } from '../factory/domain/types';
import type { DecisionTimelineEntry } from '../decisionOS/domain/types';
import type { FactoryEvolutionEntry } from '../factoryImprovement/domain/types';
import type { OwnerDecisionRecord } from '../productionAutopilot/domain/types';
import type { FactoryExecutionContext, OrchestrationRun, ProductionSessionArchive } from './domain/types';
import { PRODUCTION_SESSION_ARCHIVE_SCHEMA_VERSION } from './domain/types';

// Mission 5, Part 9 — Production Session Archive. Every field below is a
// real, already-computed record scoped to this run — nothing is
// recomputed for the archive. `decisionTimeline`/`improvementHistory`
// are filtered from the full, already-persisted Decision Timeline
// (Build 031B) and Factory Evolution Timeline (Mission 3) down to only
// the entries that actually belong to this run's batch/decisions, so the
// archive stays a real, bounded record rather than a second full copy of
// every store.

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}
function dateStamp(now: number): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1, 2)}${pad(d.getUTCDate(), 2)}`;
}
function randomSuffix(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
export function generateProductionSessionArchiveId(now: number = Date.now()): string {
  return `FARCH-${dateStamp(now)}-${randomSuffix()}`;
}

export function buildProductionSessionArchive(
  run: OrchestrationRun,
  context: FactoryExecutionContext,
  allTimeline: FactoryTimelineEntry[],
  allDecisionTimeline: DecisionTimelineEntry[],
  allEvolutionTimeline: FactoryEvolutionEntry[],
  ownerDecisionRecords: OwnerDecisionRecord[],
  now: number = Date.now(),
): ProductionSessionArchive {
  const executionTimeline = run.batchId ? allTimeline.filter((t) => t.batchId === run.batchId) : [];
  const decisionTimeline = context.decisionIds.length > 0 ? allDecisionTimeline.filter((d) => context.decisionIds.includes(d.decisionId)) : [];
  const improvementHistory = context.improvementReferences.length > 0 ? allEvolutionTimeline.filter((e) => context.improvementReferences.includes(e.refId)) : [];
  const ownerDecisions = context.session ? ownerDecisionRecords.filter((d) => d.sessionId === context.session!.id) : [];

  return {
    id: generateProductionSessionArchiveId(now),
    runId: run.id,
    sessionId: run.sessionId,
    batchId: run.batchId,
    executionTimeline,
    decisionTimeline,
    factoryKpis: context.factoryKpis,
    businessOutcome: context.businessOutcome,
    improvementHistory,
    ownerDecisions,
    finalStatus: run.status,
    archivedAt: now,
    schemaVersion: PRODUCTION_SESSION_ARCHIVE_SCHEMA_VERSION,
  };
}

export function isValidProductionSessionArchive(value: unknown): value is ProductionSessionArchive {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.runId === 'string' && typeof v.archivedAt === 'number' && Array.isArray(v.executionTimeline);
}
