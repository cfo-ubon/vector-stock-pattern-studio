import type { FactoryTask, FactoryTimelineEntry } from '../factory/domain/types';
import type { FactoryIntelligenceMetrics } from './domain/types';
import type { RootCauseAnalysis, RootCauseStep } from './domain/types';

// Mission 2, Part 3 — Root Cause Analysis. Every step in every chain is
// backed by a real count of real tasks/timeline entries — never a
// plausible-sounding guess. A chain simply stops (rather than continuing
// with an invented link) once no further supporting evidence exists.
// Thresholds are disclosed defaults (documented as such), not measured
// baselines — there is no historical data yet to derive one from.

export const ROOT_CAUSE_THRESHOLDS = {
  repairRatioPercent: 30,
  blockedTaskRatioPercent: 25,
};

function qaReviewRejectStep(timeline: FactoryTimelineEntry[]): RootCauseStep | null {
  const qaFinished = timeline.filter((e) => e.event === 'FINISHED' && e.taskType === 'qa');
  const reviewOrReject = qaFinished.filter((e) => e.note.endsWith(': REVIEW.') || e.note.endsWith(': REJECT.'));
  if (reviewOrReject.length === 0) return null;
  return {
    label: 'QA is rejecting or flagging-for-review a meaningful share of candidates',
    evidence: `${reviewOrReject.length} of ${qaFinished.length} QA decision(s) recorded were REVIEW or REJECT`,
    sourceTaskIds: reviewOrReject.map((e) => e.taskId),
    sourceDecisionIds: [],
  };
}

function blockedStageStep(tasks: FactoryTask[], type: FactoryTask['type'], label: string): RootCauseStep | null {
  const blocked = tasks.filter((t) => t.type === type && t.status === 'BLOCKED');
  if (blocked.length === 0) return null;
  return {
    label,
    evidence: `${blocked.length} ${type} task(s) are currently BLOCKED`,
    sourceTaskIds: blocked.map((t) => t.id),
    sourceDecisionIds: [...new Set(blocked.map((t) => t.sourceDecisionId).filter((id): id is string => !!id))],
  };
}

/** The downstream chain shared by every KPI trigger below — QA issues
 * cascade into missing SEO, which cascades into blocked packaging, which
 * cascades into blocked export. Only the steps with real evidence are
 * included, in this fixed causal order. */
function buildDownstreamChain(tasks: FactoryTask[], timeline: FactoryTimelineEntry[]): RootCauseStep[] {
  const steps: RootCauseStep[] = [];
  const qaStep = qaReviewRejectStep(timeline);
  if (qaStep) steps.push(qaStep);
  const seoStep = blockedStageStep(tasks, 'seo', 'Missing SEO metadata is blocking downstream work');
  if (seoStep) steps.push(seoStep);
  const packageStep = blockedStageStep(tasks, 'package', 'Commercial Package builds are blocked');
  if (packageStep) steps.push(packageStep);
  const exportStep = blockedStageStep(tasks, 'exportValidation', 'Export Validation is blocked');
  if (exportStep) steps.push(exportStep);
  return steps;
}

export function analyzeRootCauses(tasks: FactoryTask[], timeline: FactoryTimelineEntry[], metrics: FactoryIntelligenceMetrics): RootCauseAnalysis[] {
  const analyses: RootCauseAnalysis[] = [];
  const downstream = buildDownstreamChain(tasks, timeline);

  if (metrics.repairRatio !== null && metrics.repairRatio > ROOT_CAUSE_THRESHOLDS.repairRatioPercent) {
    analyses.push({
      kpi: 'repairRatio',
      value: metrics.repairRatio,
      threshold: ROOT_CAUSE_THRESHOLDS.repairRatioPercent,
      chain: [{ label: 'Repair Rate High', evidence: `Repair ratio is ${metrics.repairRatio}% (threshold ${ROOT_CAUSE_THRESHOLDS.repairRatioPercent}%)`, sourceTaskIds: [], sourceDecisionIds: [] }, ...downstream],
    });
  }

  if (metrics.blockedTaskRatio !== null && metrics.blockedTaskRatio > ROOT_CAUSE_THRESHOLDS.blockedTaskRatioPercent) {
    analyses.push({
      kpi: 'blockedTaskRatio',
      value: metrics.blockedTaskRatio,
      threshold: ROOT_CAUSE_THRESHOLDS.blockedTaskRatioPercent,
      chain: [{ label: 'Blocked Task Ratio High', evidence: `${metrics.blockedTaskRatio}% of tasks are BLOCKED (threshold ${ROOT_CAUSE_THRESHOLDS.blockedTaskRatioPercent}%)`, sourceTaskIds: [], sourceDecisionIds: [] }, ...downstream],
    });
  }

  const resolvedPackageWork = tasks.filter((t) => (t.type === 'package' || t.type === 'exportValidation') && (t.status === 'COMPLETED' || t.status === 'BLOCKED'));
  if (metrics.commercialThroughput === 0 && resolvedPackageWork.length > 0) {
    analyses.push({
      kpi: 'commercialThroughput',
      value: 0,
      threshold: 0,
      chain: [{ label: 'Commercial Throughput Is Zero Despite Queue Activity', evidence: `0 Commercial Packages completed while ${resolvedPackageWork.length} package/export task(s) have been resolved`, sourceTaskIds: resolvedPackageWork.map((t) => t.id), sourceDecisionIds: [] }, ...downstream],
    });
  }

  return analyses;
}
