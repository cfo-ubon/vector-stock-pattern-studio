import type { FactoryTask, FactoryTimelineEntry } from '../factory/domain/types';
import { analyzeBottleneck } from '../factoryIntelligence/bottleneckAnalyzer';
import { computeFactoryIntelligenceMetrics } from '../factoryIntelligence/metricsEngine';
import type { FactoryIntelligenceMetrics, FactoryStage } from '../factoryIntelligence/domain/types';
import { assessExpectedImpact } from './expectedImpactEngine';
import type { OptimizationScenario, OptimizationSimulationResult } from './domain/types';
import { OPTIMIZATION_SCENARIO_VALUES } from './domain/types';

// Mission 3, Part 4 — Optimization Simulator. This is a bounded,
// evidence-grounded PROJECTION, not a discrete-event factory simulation:
// it never actually reorders or executes anything (Part 6/7's "no
// automatic permanent changes"), and it reuses the real, already-computed
// Bottleneck Analyzer + Expected Impact Engine (Part 3, itself reusing
// Decision OS's Confidence Engine) rather than inventing a second impact
// model. Disclosed explicitly here and in the build report: "Expected
// Improvement" is a qualitative projection derived from how much real
// evidence currently supports the targeted stage genuinely being a
// bottleneck, not a measured backtest against historical before/after
// data — Part 6's Factory Experiments are what supplies that empirical
// one-batch comparison.

const SCENARIO_TARGET_STAGE: Record<OptimizationScenario, FactoryStage> = {
  REPAIR_FIRST: 'repair',
  QUEUE_IMPROVEMENT: 'queue',
  PACKAGING_EARLIER: 'package',
  COLLECTION_COMPLETION_FIRST: 'collectionCompletion',
};

const SCENARIO_TARGET_METRIC: Record<OptimizationScenario, keyof FactoryIntelligenceMetrics> = {
  REPAIR_FIRST: 'repairRatio',
  QUEUE_IMPROVEMENT: 'averageQueueTimeMs',
  PACKAGING_EARLIER: 'averagePackagingTimeMs',
  COLLECTION_COMPLETION_FIRST: 'commercialReadyRatio',
};

export function simulateOptimization(scenario: OptimizationScenario, tasks: FactoryTask[], timeline: FactoryTimelineEntry[], now: number = Date.now()): OptimizationSimulationResult {
  const targetStage = SCENARIO_TARGET_STAGE[scenario];
  const targetMetric = SCENARIO_TARGET_METRIC[scenario];
  const metrics = computeFactoryIntelligenceMetrics(tasks, timeline, now);
  const bottleneck = analyzeBottleneck(tasks, timeline, now);

  const currentValue = metrics[targetMetric];
  const matchesCurrentBottleneck = bottleneck.stage === targetStage;
  const evidence = matchesCurrentBottleneck ? bottleneck.evidence : [];

  if (evidence.length === 0) {
    return {
      scenario,
      targetMetric,
      currentValue,
      expectedImprovement: 'UNKNOWN',
      confidence: 'unknown',
      explanation: [`No real evidence currently identifies ${targetStage} as the factory's bottleneck — insufficient evidence to project this scenario's impact.`],
      evidenceCount: 0,
      simulatedAt: now,
    };
  }

  const { expectedImpact, confidence } = assessExpectedImpact(evidence, bottleneck.businessImpact, now);
  return {
    scenario,
    targetMetric,
    currentValue,
    expectedImprovement: expectedImpact,
    confidence: confidence.band,
    explanation: [`${targetStage} is currently the factory's identified bottleneck (${bottleneck.reason ?? ''}); addressing it first is projected to have ${expectedImpact} impact on ${targetMetric}.`, ...confidence.explanation],
    evidenceCount: evidence.length,
    simulatedAt: now,
  };
}

export function simulateAllOptimizations(tasks: FactoryTask[], timeline: FactoryTimelineEntry[], now: number = Date.now()): OptimizationSimulationResult[] {
  return OPTIMIZATION_SCENARIO_VALUES.map((s) => simulateOptimization(s, tasks, timeline, now));
}
