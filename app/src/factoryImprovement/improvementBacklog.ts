import type { ImprovementCandidate } from './improvementEngine';
import type { ImprovementBacklogTask, ImprovementBacklogStatus } from './domain/types';
import { IMPROVEMENT_BACKLOG_SCHEMA_VERSION } from './domain/types';
import { assessExpectedImpact } from './expectedImpactEngine';
import type { ConfidenceBand, BusinessImpact } from '../decisionOS/domain/types';

// Mission 3, Part 2/5 — Improvement Backlog. Turns Part 1's evidence-only
// candidates into persistent, ranked tasks. `businessImpact` is the raw,
// structural signal from Factory Intelligence (Bottleneck/Root Cause);
// `estimatedBenefit` is Part 3's Expected Impact Engine's refined view
// (impact re-weighted by real evidence confidence) — two different, both
// real fields, never the same number reported twice.
// `estimatedRisk`/`recommendedOwner` are disclosed, deterministic
// policies (documented inline), never invented per-task guesses.

const IMPACT_SCORE: Record<BusinessImpact, number> = { VERY_HIGH: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
const CONFIDENCE_SCORE: Record<ConfidenceBand, number> = { high: 3, medium: 2, low: 1, unknown: 0 };

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
export function generateImprovementBacklogTaskId(now: number = Date.now()): string {
  return `FBACK-${dateStamp(now)}-${randomSuffix()}`;
}

/** Disclosed policy: ready-to-run work (an Opportunity — already-READY
 * tasks the Scheduler can execute) needs no new decision, so it is
 * FACTORY_AUTOMATION / LOW risk; a Bottleneck/Root Cause diagnosis names
 * a systemic issue whose fix is not yet determined, so it always needs
 * OWNER_REVIEW. Risk otherwise tracks confidence — well-evidenced
 * findings are lower-risk to act on than sparse ones. */
function riskAndOwnerFor(isReadyWork: boolean, confidence: ConfidenceBand): { risk: ImprovementBacklogTask['estimatedRisk']; owner: ImprovementBacklogTask['recommendedOwner'] } {
  if (confidence === 'unknown') return { risk: 'UNKNOWN', owner: 'UNKNOWN' };
  if (isReadyWork) return { risk: 'LOW', owner: 'FACTORY_AUTOMATION' };
  return { risk: confidence === 'high' ? 'LOW' : 'MEDIUM', owner: 'OWNER_REVIEW' };
}

export function createImprovementBacklogTask(candidate: ImprovementCandidate, sourceBatchId: string | null = null, now: number = Date.now()): ImprovementBacklogTask {
  const { expectedImpact, confidence } = assessExpectedImpact(candidate.evidence, candidate.businessImpact, now);
  const { risk, owner } = riskAndOwnerFor(candidate.isReadyWork, confidence.band);
  const priority = IMPACT_SCORE[expectedImpact] * 10 + CONFIDENCE_SCORE[confidence.band];

  return {
    id: generateImprovementBacklogTaskId(now),
    priority,
    businessImpact: candidate.businessImpact ?? 'UNKNOWN',
    evidence: candidate.evidence,
    confidence: confidence.band,
    estimatedBenefit: expectedImpact,
    estimatedRisk: risk,
    recommendedOwner: owner,
    status: 'OPEN',
    category: candidate.category,
    title: candidate.title,
    reason: candidate.reason,
    sourceStage: candidate.stage,
    sourceTaskIds: candidate.sourceTaskIds,
    sourceBatchId,
    createdAt: now,
    updatedAt: now,
    schemaVersion: IMPROVEMENT_BACKLOG_SCHEMA_VERSION,
  };
}

export function createImprovementBacklogTasks(candidates: ImprovementCandidate[], sourceBatchId: string | null = null, now: number = Date.now()): ImprovementBacklogTask[] {
  return candidates.map((c) => createImprovementBacklogTask(c, sourceBatchId, now));
}

/** Part 5 — Continuous Improvement Queue: highest impact first among OPEN
 * tasks. Ties broken oldest-first, never randomly. */
export function rankImprovementBacklog(tasks: ImprovementBacklogTask[]): ImprovementBacklogTask[] {
  return tasks
    .filter((t) => t.status === 'OPEN')
    .slice()
    .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
}

export function setImprovementBacklogStatus(task: ImprovementBacklogTask, status: ImprovementBacklogStatus, now: number = Date.now()): ImprovementBacklogTask {
  return { ...task, status, updatedAt: now };
}
