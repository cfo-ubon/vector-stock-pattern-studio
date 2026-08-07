import type { FactoryTask, FactoryTimelineEntry } from '../factory/domain/types';
import type { DecisionTimelineEntry } from '../decisionOS/domain/types';
import { analyzeBottleneck } from '../factoryIntelligence/bottleneckAnalyzer';
import { analyzeRootCauses } from '../factoryIntelligence/rootCauseAnalyzer';
import { findOpportunities } from '../factoryIntelligence/opportunityFinder';
import { computeFactoryIntelligenceMetrics } from '../factoryIntelligence/metricsEngine';
import type { FactoryStage } from '../factoryIntelligence/domain/types';
import type { ImprovementBacklogCategory } from './domain/types';

// Mission 3, Part 1 — Improvement Engine. Never invents an improvement:
// every candidate below is built directly from Factory Intelligence's own
// Bottleneck Analyzer / Root Cause Analyzer / Opportunity Finder (Build
// 032) plus the real Decision Timeline (Decision OS, Build 031B) and
// Factory Timeline (Build 031C). This module adds no new evidence
// gathering and no new heuristics — only turns already-real findings into
// improvement candidates. `generate` is structurally never a candidate
// stage (mirrors `opportunityFinder.ts`'s own "never recommend
// generation" guarantee) — Part 5's "never recommend generation unless
// Decision OS already agrees" is satisfied by never producing a
// generation-related candidate here at all, the same structural approach
// Build 032 already used, rather than re-evaluating Decision OS's own
// generate policy from this layer with a fabricated context.

export interface ImprovementCandidate {
  category: ImprovementBacklogCategory;
  stage: FactoryStage | null;
  title: string;
  reason: string;
  evidence: string[];
  sourceTaskIds: string[];
  businessImpact: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  /** True for Opportunity-sourced candidates — real READY work the
   * Scheduler can already run, as opposed to a Bottleneck/Root Cause
   * diagnosis whose fix is not yet determined. */
  isReadyWork: boolean;
}

const STAGE_TO_CATEGORY: Partial<Record<FactoryStage, ImprovementBacklogCategory>> = {
  qa: 'REPAIR',
  repair: 'REPAIR',
  seo: 'SEO',
  package: 'PACKAGING',
  exportValidation: 'EXPORT',
  collectionCompletion: 'COLLECTION',
  portfolioUpdate: 'PORTFOLIO',
  queue: 'QUEUE',
};

const KPI_TO_CATEGORY: Record<string, ImprovementBacklogCategory> = {
  repairRatio: 'REPAIR',
  blockedTaskRatio: 'QUEUE',
  commercialThroughput: 'COMMERCIAL',
};

const OPPORTUNITY_TO_CATEGORY: Record<string, ImprovementBacklogCategory> = {
  FINISH_SEO: 'SEO',
  COMPLETE_COLLECTION: 'COLLECTION',
  REPAIR_READY_ITEMS: 'REPAIR',
  PACKAGE_EXISTING_WORK: 'PACKAGING',
  EXPORT_READY_PACKAGES: 'EXPORT',
};

const CATEGORY_TITLES: Record<ImprovementBacklogCategory, string> = {
  REPAIR: 'Reduce Repair Time',
  QUEUE: 'Reduce Queue Delay',
  SEO: 'Improve SEO Completion',
  PACKAGING: 'Improve Packaging',
  COLLECTION: 'Improve Collection Completion',
  EXPORT: 'Improve Export Readiness',
  COMMERCIAL: 'Increase Commercial Throughput',
  PORTFOLIO: 'Improve Portfolio Update Flow',
};

export function identifyImprovementCandidates(tasks: FactoryTask[], timeline: FactoryTimelineEntry[], decisionTimeline: DecisionTimelineEntry[] = [], now: number = Date.now()): ImprovementCandidate[] {
  const candidates: ImprovementCandidate[] = [];
  const seen = new Set<ImprovementBacklogCategory>();

  const metrics = computeFactoryIntelligenceMetrics(tasks, timeline, now);
  const bottleneck = analyzeBottleneck(tasks, timeline, now);
  const rootCauses = analyzeRootCauses(tasks, timeline, metrics);
  const opportunities = findOpportunities(tasks);

  if (bottleneck.stage !== null && bottleneck.stage !== 'generate') {
    const category = STAGE_TO_CATEGORY[bottleneck.stage];
    if (category && !seen.has(category)) {
      seen.add(category);
      const relatedBlockedDecisions = decisionTimeline.filter((d) => d.domain === 'factory' && d.blockedReasons.length > 0);
      candidates.push({
        category,
        stage: bottleneck.stage,
        title: CATEGORY_TITLES[category],
        reason: bottleneck.reason ?? '',
        evidence: [...bottleneck.evidence, ...(relatedBlockedDecisions.length > 0 ? [`${relatedBlockedDecisions.length} related factory Decision(s) in the Decision Timeline recorded a blocked reason`] : [])],
        sourceTaskIds: bottleneck.sourceTaskIds,
        businessImpact: bottleneck.businessImpact,
        isReadyWork: false,
      });
    }
  }

  for (const analysis of rootCauses) {
    const category = KPI_TO_CATEGORY[analysis.kpi];
    if (!category || seen.has(category)) continue;
    seen.add(category);
    candidates.push({
      category,
      stage: null,
      title: CATEGORY_TITLES[category],
      reason: analysis.chain[0]?.evidence ?? analysis.kpi,
      evidence: analysis.chain.map((s) => s.evidence),
      sourceTaskIds: analysis.chain.flatMap((s) => s.sourceTaskIds),
      businessImpact: 'HIGH',
      isReadyWork: false,
    });
  }

  for (const opp of opportunities) {
    const category = OPPORTUNITY_TO_CATEGORY[opp.type];
    if (!category || seen.has(category)) continue;
    seen.add(category);
    candidates.push({
      category,
      stage: null,
      title: opp.title,
      reason: opp.reason,
      evidence: [`${opp.count} task(s) ready: ${opp.taskIds.slice(0, 5).join(', ')}${opp.taskIds.length > 5 ? '…' : ''}`],
      sourceTaskIds: opp.taskIds,
      businessImpact: 'MEDIUM',
      isReadyWork: true,
    });
  }

  return candidates;
}

/** Part 1's literal "Analyze every completed batch" — filters to one
 * `batchId` and only ever returns candidates once every task sharing
 * that batch has reached a terminal state (same gate `factoryReview.ts`
 * uses); returns `null` for an in-progress batch rather than a guess. */
export function identifyImprovementCandidatesForCompletedBatch(batchId: string, allTasks: FactoryTask[], allTimeline: FactoryTimelineEntry[], decisionTimeline: DecisionTimelineEntry[] = [], now: number = Date.now()): ImprovementCandidate[] | null {
  const batchTasks = allTasks.filter((t) => t.batchId === batchId);
  if (batchTasks.length === 0) return null;
  const allTerminal = batchTasks.every((t) => t.status === 'COMPLETED' || t.status === 'CANCELLED');
  if (!allTerminal) return null;
  const batchTaskIds = new Set(batchTasks.map((t) => t.id));
  const batchTimeline = allTimeline.filter((e) => batchTaskIds.has(e.taskId));
  return identifyImprovementCandidates(batchTasks, batchTimeline, decisionTimeline, now);
}
