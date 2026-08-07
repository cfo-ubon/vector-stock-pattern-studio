import type { BusinessImpact, ConfidenceBand } from '../../decisionOS/domain/types';
import type { FactoryStage, FactoryIntelligenceMetrics, TrendStatus } from '../../factoryIntelligence/domain/types';

// Mission 3 — Continuous Factory Improvement. Builds on Build 031C
// (execution) and Build 032/Mission 2 (measurement) to answer "what
// should improve next, why, how much impact." No new AI: every function
// in this module is a deterministic, disclosed rule over
// already-computed Factory Intelligence / Decision OS output. Every
// qualitative field reuses Decision OS's own vocabulary
// (`BusinessImpact`, `ConfidenceBand`) rather than inventing a parallel
// one — "Very High/High/Medium/Low/Unknown" (Part 3's allowed values) IS
// `BusinessImpact`. Never a fabricated revenue number, never a
// probability presented as fact.

/** Part 2 — the 8 categories the spec names, verbatim. */
export const IMPROVEMENT_BACKLOG_CATEGORY_VALUES = ['REPAIR', 'QUEUE', 'SEO', 'PACKAGING', 'COLLECTION', 'EXPORT', 'COMMERCIAL', 'PORTFOLIO'] as const;
export type ImprovementBacklogCategory = (typeof IMPROVEMENT_BACKLOG_CATEGORY_VALUES)[number];

export const IMPROVEMENT_BACKLOG_STATUS_VALUES = ['OPEN', 'IN_PROGRESS', 'DONE', 'DISMISSED'] as const;
export type ImprovementBacklogStatus = (typeof IMPROVEMENT_BACKLOG_STATUS_VALUES)[number];

export const IMPROVEMENT_RISK_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'] as const;
export type ImprovementRisk = (typeof IMPROVEMENT_RISK_VALUES)[number];

export const RECOMMENDED_OWNER_VALUES = ['FACTORY_AUTOMATION', 'OWNER_REVIEW', 'UNKNOWN'] as const;
export type RecommendedOwner = (typeof RECOMMENDED_OWNER_VALUES)[number];

/** Part 2 — persistent Improvement Backlog task. `businessImpact` is the
 * raw, structural signal straight from Factory Intelligence's Bottleneck/
 * Root Cause analysis; `estimatedBenefit` is Part 3's Expected Impact
 * Engine's refined view (impact re-weighted by real evidence confidence)
 * — two distinct, both real fields, never the same number twice. */
export interface ImprovementBacklogTask {
  id: string;
  priority: number;
  businessImpact: BusinessImpact;
  evidence: string[];
  confidence: ConfidenceBand;
  estimatedBenefit: BusinessImpact;
  estimatedRisk: ImprovementRisk;
  recommendedOwner: RecommendedOwner;
  status: ImprovementBacklogStatus;
  category: ImprovementBacklogCategory;
  title: string;
  reason: string;
  sourceStage: FactoryStage | null;
  sourceTaskIds: string[];
  sourceBatchId: string | null;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}
export const IMPROVEMENT_BACKLOG_SCHEMA_VERSION = 1;

/** Part 4 — the scenario chain the spec's example names, each an
 * independent named projection (not literal pipeline stages). */
export const OPTIMIZATION_SCENARIO_VALUES = ['REPAIR_FIRST', 'QUEUE_IMPROVEMENT', 'PACKAGING_EARLIER', 'COLLECTION_COMPLETION_FIRST'] as const;
export type OptimizationScenario = (typeof OPTIMIZATION_SCENARIO_VALUES)[number];

export interface OptimizationSimulationResult {
  scenario: OptimizationScenario;
  targetMetric: string;
  currentValue: number | null;
  expectedImprovement: BusinessImpact;
  confidence: ConfidenceBand;
  explanation: string[];
  evidenceCount: number;
  simulatedAt: number;
}

/** Part 6 — one real, bounded, one-batch trial. Nothing here ever
 * changes production behavior; it is a read-only measurement wrapped
 * around real Factory Controller data. */
export const FACTORY_EXPERIMENT_STATUS_VALUES = ['RUNNING', 'CONCLUDED'] as const;
export type FactoryExperimentStatus = (typeof FACTORY_EXPERIMENT_STATUS_VALUES)[number];

export const FACTORY_EXPERIMENT_RESULT_VALUES = ['SUCCESS', 'NEUTRAL', 'FAILED', 'UNKNOWN'] as const;
export type FactoryExperimentResult = (typeof FACTORY_EXPERIMENT_RESULT_VALUES)[number];

export interface FactoryExperiment {
  id: string;
  scenario: OptimizationScenario;
  description: string;
  targetBatchId: string;
  beforeMetrics: FactoryIntelligenceMetrics;
  afterMetrics: FactoryIntelligenceMetrics | null;
  status: FactoryExperimentStatus;
  result: FactoryExperimentResult | null;
  resultExplanation: string[];
  startedAt: number;
  concludedAt: number | null;
  schemaVersion: number;
}
export const FACTORY_EXPERIMENT_SCHEMA_VERSION = 1;

/** Part 7 — a named policy is a label over one real Part 4 scenario,
 * measured across the 4 KPIs the spec names. `activated` is always
 * `false`: nothing in this module can ever switch live behavior. */
export const POLICY_EXPERIMENT_NAME_VALUES = ['FINISH_COLLECTION_FIRST', 'REPAIR_FIRST_POLICY', 'PACKAGE_EARLIER_POLICY', 'QUEUE_IMPROVEMENT_POLICY'] as const;
export type PolicyExperimentName = (typeof POLICY_EXPERIMENT_NAME_VALUES)[number];

export interface PolicyExperimentKpiComparison {
  kpi: 'commercialReadyRatio' | 'repairRatio' | 'averageQueueTimeMs' | 'ownerWaitingTimeMs';
  label: string;
  currentValue: number | null;
  expectedDirection: 'IMPROVE' | 'WORSEN' | 'NO_CHANGE' | 'UNKNOWN';
}

export interface PolicyExperiment {
  id: string;
  policyName: PolicyExperimentName;
  description: string;
  scenario: OptimizationScenario;
  simulation: OptimizationSimulationResult;
  kpiComparisons: PolicyExperimentKpiComparison[];
  activated: false;
  createdAt: number;
  schemaVersion: number;
}
export const POLICY_EXPERIMENT_SCHEMA_VERSION = 1;

/** Part 8 — Daily/Weekly/Monthly Improvement Review. */
export const IMPROVEMENT_REVIEW_PERIOD_VALUES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type ImprovementReviewPeriod = (typeof IMPROVEMENT_REVIEW_PERIOD_VALUES)[number];

export interface ImprovementReviewMetricChange {
  metric: string;
  status: TrendStatus;
  startValue: number | null;
  endValue: number | null;
}

export interface ImprovementReview {
  id: string;
  period: ImprovementReviewPeriod;
  periodStart: number;
  periodEnd: number;
  metricChanges: ImprovementReviewMetricChange[];
  bestImprovement: string | null;
  worstBottleneckStage: FactoryStage | null;
  topRecommendation: string | null;
  batchesReviewed: number;
  createdAt: number;
  schemaVersion: number;
}
export const IMPROVEMENT_REVIEW_SCHEMA_VERSION = 1;

/** Part 9 — explains a Business Outcome Score change between two
 * already-computed, already-persisted scores (Build 032, Part 7). No new
 * scoring logic lives here, only the diff/explanation. */
export interface BusinessOutcomeComponentChange {
  name: string;
  fromValue: number | null;
  toValue: number | null;
  fromContribution: number | null;
  toContribution: number | null;
}

export interface BusinessOutcomeEvolutionExplanation {
  fromScore: number | null;
  toScore: number | null;
  scoreDelta: number | null;
  componentChanges: BusinessOutcomeComponentChange[];
  explanation: string[];
}

/** Part 10 — append-only, mirrors `decisionTimeline`/`factoryTimeline`'s
 * own pattern. `refId` always names a real, persisted record elsewhere
 * in this module. */
export const FACTORY_EVOLUTION_EVENT_TYPE_VALUES = ['BACKLOG_TASK_CREATED', 'BACKLOG_TASK_STATUS_CHANGED', 'EXPERIMENT_CONCLUDED', 'POLICY_EXPERIMENT_CREATED', 'REVIEW_GENERATED'] as const;
export type FactoryEvolutionEventType = (typeof FACTORY_EVOLUTION_EVENT_TYPE_VALUES)[number];

export interface FactoryEvolutionEntry {
  id: string;
  type: FactoryEvolutionEventType;
  refId: string;
  summary: string;
  at: number;
}
