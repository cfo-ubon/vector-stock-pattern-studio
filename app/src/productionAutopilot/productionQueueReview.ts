import type { FactoryTask, FactoryTimelineEntry, FactoryTaskType } from '../factory/domain/types';
import { analyzeBottleneck } from '../factoryIntelligence/bottleneckAnalyzer';
import { computeFactoryIntelligenceMetrics } from '../factoryIntelligence/metricsEngine';
import { simulateAllOptimizations } from '../factoryImprovement/optimizationSimulator';
import type { FactoryStage } from '../factoryIntelligence/domain/types';
import type { ProductionQueueReview } from './domain/types';

// Mission 4, Part 6 — Production Queue Review, shown before execution.
// Entirely composed from Factory Intelligence's Bottleneck Analyzer
// (Build 032) and Continuous Factory Improvement's Optimization
// Simulator (Build 033) — no new bottleneck/impact logic here.

const BLOCKABLE_TYPES: FactoryTaskType[] = ['generate', 'repair', 'qa', 'seo', 'package', 'exportValidation', 'collectionCompletion', 'portfolioUpdate'];

export function reviewProductionQueue(tasks: FactoryTask[], timeline: FactoryTimelineEntry[], now: number = Date.now()): ProductionQueueReview {
  const bottleneck = analyzeBottleneck(tasks, timeline, now);
  const metrics = computeFactoryIntelligenceMetrics(tasks, timeline, now);

  const blockedTasks: { stage: FactoryStage; count: number }[] = [];
  for (const type of BLOCKABLE_TYPES) {
    const count = tasks.filter((t) => t.type === type && t.status === 'BLOCKED').length;
    if (count > 0) blockedTasks.push({ stage: type as FactoryStage, count });
  }

  const simulations = simulateAllOptimizations(tasks, timeline, now);
  const expectedImprovement = simulations.find((s) => s.expectedImprovement !== 'UNKNOWN') ?? null;

  return {
    currentQueueCount: tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length,
    readyCount: tasks.filter((t) => t.status === 'READY').length,
    blockedTasks,
    estimatedCompletionMs: metrics.averageBatchTimeMs,
    topBottleneck: bottleneck,
    expectedImprovement,
    computedAt: now,
  };
}
