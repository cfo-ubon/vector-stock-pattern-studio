import type { FactoryEvolutionEntry, FactoryEvolutionEventType, ImprovementBacklogTask, FactoryExperiment, PolicyExperiment, ImprovementReview } from './domain/types';

// Mission 3, Part 10 — Factory Evolution Timeline. Append-only, mirroring
// `decisionTimeline.ts`/`factory/domain/types.ts`'s own Timeline pattern:
// every entry's `refId` names a real, persisted record elsewhere in this
// module (never a synthetic/inferred event), so every improvement is
// traceable back to its source record.

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
export function generateFactoryEvolutionEntryId(now: number = Date.now()): string {
  return `FEVT-${dateStamp(now)}-${randomSuffix()}`;
}

function makeEntry(type: FactoryEvolutionEventType, refId: string, summary: string, at: number): FactoryEvolutionEntry {
  return { id: generateFactoryEvolutionEntryId(at), type, refId, summary, at };
}

export function evolutionEntryForBacklogTask(task: ImprovementBacklogTask): FactoryEvolutionEntry {
  const type: FactoryEvolutionEventType = task.createdAt === task.updatedAt ? 'BACKLOG_TASK_CREATED' : 'BACKLOG_TASK_STATUS_CHANGED';
  return makeEntry(type, task.id, `${task.title} (${task.category}) — ${task.status}`, task.updatedAt);
}

/** Returns `null` for a still-`RUNNING` experiment — nothing real to
 * record on the timeline yet. */
export function evolutionEntryForExperiment(experiment: FactoryExperiment): FactoryEvolutionEntry | null {
  if (experiment.status !== 'CONCLUDED') return null;
  return makeEntry('EXPERIMENT_CONCLUDED', experiment.id, `Experiment "${experiment.description}" concluded: ${experiment.result}`, experiment.concludedAt ?? experiment.startedAt);
}

export function evolutionEntryForPolicyExperiment(policyExperiment: PolicyExperiment): FactoryEvolutionEntry {
  return makeEntry('POLICY_EXPERIMENT_CREATED', policyExperiment.id, `Policy experiment "${policyExperiment.policyName}" compared (not activated): expected ${policyExperiment.simulation.expectedImprovement}`, policyExperiment.createdAt);
}

export function evolutionEntryForReview(review: ImprovementReview): FactoryEvolutionEntry {
  return makeEntry('REVIEW_GENERATED', review.id, `${review.period} review generated — ${review.batchesReviewed} batch(es) reviewed`, review.createdAt);
}
