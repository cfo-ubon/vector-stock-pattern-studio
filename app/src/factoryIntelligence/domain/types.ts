// Mission 2 — Factory Intelligence. Decision OS (Build 031B) decides WHAT
// should happen; the Factory Controller (Build 031C) decides WHEN/HOW/IN
// WHICH ORDER; this layer answers "how well am I performing, what is
// slowing me down, what should I improve next" — purely by measuring and
// explaining data the Factory Controller already produced. No new AI, no
// dashboard-full-of-charts, no invented facts: every field here is either
// a real derived number or an explicit `null`/`'UNKNOWN'` when there is
// not enough data yet.

export const FACTORY_STAGE_VALUES = ['generate', 'qa', 'repair', 'seo', 'package', 'exportValidation', 'collectionCompletion', 'portfolioUpdate', 'queue'] as const;
export type FactoryStage = (typeof FACTORY_STAGE_VALUES)[number];

/** Part 1 — every average is `null` ("not enough data") until at least
 * one real, terminal (FINISHED) Timeline entry of that type exists. */
export interface FactoryIntelligenceMetrics {
  computedAt: number;
  factoryEfficiency: number | null;
  queueEfficiency: number | null;
  commercialThroughput: number;
  averageBatchTimeMs: number | null;
  averageQueueTimeMs: number | null;
  averageRepairTimeMs: number | null;
  averageQaTimeMs: number | null;
  averageSeoTimeMs: number | null;
  averagePackagingTimeMs: number | null;
  averageExportPreparationTimeMs: number | null;
  blockedTaskRatio: number | null;
  repairRatio: number | null;
  commercialReadyRatio: number | null;
  ownerWaitingTimeMs: number | null;
}

/** Part 2. `evidence` always names real, counted facts (task ids, counts,
 * durations) — never a guessed cause. `stage` is `null` only when there
 * is no evidence anywhere in the queue/timeline to identify one. */
export interface BottleneckReport {
  computedAt: number;
  stage: FactoryStage | null;
  reason: string | null;
  evidence: string[];
  businessImpact: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  recommendedImprovement: string | null;
  sourceTaskIds: string[];
}

/** Part 3. One step in a real, evidence-only causal chain — never an
 * invented link. `sourceTaskIds`/`sourceDecisionIds` let a caller verify
 * every step against the real Factory Timeline / Decision Timeline. */
export interface RootCauseStep {
  label: string;
  evidence: string;
  sourceTaskIds: string[];
  sourceDecisionIds: string[];
}

export interface RootCauseAnalysis {
  kpi: string;
  value: number;
  threshold: number;
  chain: RootCauseStep[];
}

/** Part 4. Persisted, keyed by `id`, one row per completed batch. */
export interface FactoryReview {
  id: string;
  batchId: string;
  packagesProduced: number;
  commercialReady: number;
  review: number;
  rejected: number;
  averageCompletionTimeMs: number | null;
  repairCount: number;
  queueDelaysMs: number | null;
  factoryEfficiency: number | null;
  ownerTimeSavedMinutes: number;
  topBottleneckStage: FactoryStage | null;
  topRecommendation: string | null;
  createdAt: number;
  schemaVersion: number;
}

export const FACTORY_REVIEW_SCHEMA_VERSION = 1;

/** Part 5. Never `type: 'generate'` — Opportunity Finder only ever
 * surfaces work on assets/collections/packages that already exist. */
export const OPPORTUNITY_TYPE_VALUES = ['FINISH_SEO', 'COMPLETE_COLLECTION', 'REPAIR_READY_ITEMS', 'PACKAGE_EXISTING_WORK', 'EXPORT_READY_PACKAGES'] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPE_VALUES)[number];

export interface Opportunity {
  type: OpportunityType;
  title: string;
  reason: string;
  taskIds: string[];
  count: number;
}

/** Part 6. `null`/`'UNKNOWN'` whenever either side of a comparison is
 * missing — never a fabricated percentage. */
export const TREND_STATUS_VALUES = ['IMPROVED', 'DECLINED', 'STABLE', 'UNKNOWN'] as const;
export type TrendStatus = (typeof TREND_STATUS_VALUES)[number];

export interface MetricTrendPoint {
  metric: string;
  today: number | null;
  yesterday: number | null;
  last7Days: number | null;
  last30Days: number | null;
  statusVsYesterday: TrendStatus;
  statusVs7Days: TrendStatus;
  statusVs30Days: TrendStatus;
}

export interface FactoryTrendReport {
  computedAt: number;
  metrics: MetricTrendPoint[];
}

/** Part 7. Weighted, but only over the components that actually have
 * real data — weights re-normalize when a component is unavailable so
 * missing data never silently drags the score toward zero. */
export interface BusinessOutcomeComponent {
  name: string;
  value: number | null;
  weight: number;
  contribution: number | null;
}

export interface BusinessOutcomeScore {
  id: string;
  score: number | null;
  components: BusinessOutcomeComponent[];
  explanation: string[];
  createdAt: number;
  schemaVersion: number;
}

export const BUSINESS_OUTCOME_SCHEMA_VERSION = 1;

/** Part 8. Computed on demand, never persisted separately — every field
 * is sourced from Parts 1/2/5/7's already-persisted or already-computed
 * output. */
export interface DailyFactoryBrief {
  generatedAt: number;
  commercialPackagesReady: number;
  topBottleneck: BottleneckReport | null;
  topOpportunity: Opportunity | null;
  estimatedOwnerTimeSavedMinutes: number;
  recommendedAction: string;
}

/** Part 10 — one snapshot row per calendar day, keyed by `dateKey`
 * (`YYYY-MM-DD`, local time). The basis for Part 6's trend comparisons —
 * capturing today's snapshot is an upsert (same day overwrites), so this
 * store never grows unbounded and trend lookups never need to recompute
 * historical days from the full task/timeline history (Part 11). */
export interface FactoryDailyKpi {
  dateKey: string;
  capturedAt: number;
  metrics: FactoryIntelligenceMetrics;
  businessOutcomeScore: number | null;
}

/** Part 9. Recommendation-only — nothing in Decision OS or the Scheduler
 * ever reads this store, so creating/dismissing an improvement task can
 * never change automated behavior. */
export const IMPROVEMENT_TASK_STATUS_VALUES = ['OPEN', 'DISMISSED', 'DONE'] as const;
export type ImprovementTaskStatus = (typeof IMPROVEMENT_TASK_STATUS_VALUES)[number];

export const IMPROVEMENT_CATEGORY_VALUES = ['REDUCE_REPAIR_TIME', 'IMPROVE_QA', 'IMPROVE_PACKAGING', 'REDUCE_QUEUE_DELAY', 'IMPROVE_COLLECTION_COMPLETION'] as const;
export type ImprovementCategory = (typeof IMPROVEMENT_CATEGORY_VALUES)[number];

export interface ImprovementTask {
  id: string;
  category: ImprovementCategory;
  title: string;
  reason: string;
  evidence: string[];
  status: ImprovementTaskStatus;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export const IMPROVEMENT_TASK_SCHEMA_VERSION = 1;
