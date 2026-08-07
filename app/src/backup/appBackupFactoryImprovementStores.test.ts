import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { buildAppBackup } from './appBackupBuilder';
import { applyAppBackupRestore } from './appBackupRestore';
import { APP_BACKUP_STORE_NAMES } from './appBackupFormat';
import { FACTORY_IMPROVEMENT_BACKLOG_STORE, FACTORY_EXPERIMENTS_STORE, FACTORY_POLICY_EXPERIMENTS_STORE, FACTORY_IMPROVEMENT_REVIEWS_STORE, FACTORY_EVOLUTION_TIMELINE_STORE } from '../storage/db';
import { putImprovementBacklogTask, loadImprovementBacklog, clearImprovementBacklogForTest } from '../factoryImprovement/storage/improvementBacklogStore';
import { putFactoryExperiment, loadFactoryExperiments, clearFactoryExperimentsForTest } from '../factoryImprovement/storage/factoryExperimentStore';
import { putPolicyExperiment, loadPolicyExperiments, clearPolicyExperimentsForTest } from '../factoryImprovement/storage/policyExperimentStore';
import { putImprovementReview, loadImprovementReviews, clearImprovementReviewsForTest } from '../factoryImprovement/storage/improvementReviewStore';
import { appendFactoryEvolutionEntry, loadFactoryEvolutionTimeline, clearFactoryEvolutionTimelineForTest } from '../factoryImprovement/storage/factoryEvolutionTimelineStore';
import { computeFactoryIntelligenceMetrics } from '../factoryIntelligence/metricsEngine';

// Mission 3 (Continuous Factory Improvement) — .vspsb backup coverage for
// the 5 new stores, following the exact template
// `appBackupFactoryIntelligenceStores.test.ts` established.

const originalBlob = globalThis.Blob;
beforeEach(async () => {
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
  await Promise.all([clearImprovementBacklogForTest(), clearFactoryExperimentsForTest(), clearPolicyExperimentsForTest(), clearImprovementReviewsForTest(), clearFactoryEvolutionTimelineForTest()]);
});
afterEach(() => {
  globalThis.Blob = originalBlob;
});

describe('.vspsb coverage — all 5 Mission 3 stores are registered', () => {
  it('APP_BACKUP_STORE_NAMES includes every new Factory Improvement store', () => {
    for (const store of [FACTORY_IMPROVEMENT_BACKLOG_STORE, FACTORY_EXPERIMENTS_STORE, FACTORY_POLICY_EXPERIMENTS_STORE, FACTORY_IMPROVEMENT_REVIEWS_STORE, FACTORY_EVOLUTION_TIMELINE_STORE]) {
      expect(APP_BACKUP_STORE_NAMES).toContain(store);
    }
  });
});

describe('.vspsb — non-empty round trip across all 5 stores', () => {
  it('backs up and restores real records from every store', async () => {
    const metrics = computeFactoryIntelligenceMetrics([], [], 1000);

    await putImprovementBacklogTask({
      id: 'FBACK-1',
      priority: 30,
      businessImpact: 'HIGH',
      evidence: ['3 BLOCKED repair task(s)'],
      confidence: 'high',
      estimatedBenefit: 'VERY_HIGH',
      estimatedRisk: 'LOW',
      recommendedOwner: 'OWNER_REVIEW',
      status: 'OPEN',
      category: 'REPAIR',
      title: 'Reduce Repair Time',
      reason: 'real reason',
      sourceStage: 'repair',
      sourceTaskIds: ['T-1'],
      sourceBatchId: 'B-1',
      createdAt: 1000,
      updatedAt: 1000,
      schemaVersion: 1,
    });

    await putFactoryExperiment({
      id: 'FEXP-1',
      scenario: 'REPAIR_FIRST',
      description: 'Move Repair before Generation',
      targetBatchId: 'B-1',
      beforeMetrics: metrics,
      afterMetrics: null,
      status: 'RUNNING',
      result: null,
      resultExplanation: [],
      startedAt: 1000,
      concludedAt: null,
      schemaVersion: 1,
    });

    await putPolicyExperiment({
      id: 'FPOL-1',
      policyName: 'REPAIR_FIRST_POLICY',
      description: 'Prioritize Repair over new Generation',
      scenario: 'REPAIR_FIRST',
      simulation: { scenario: 'REPAIR_FIRST', targetMetric: 'repairRatio', currentValue: null, expectedImprovement: 'UNKNOWN', confidence: 'unknown', explanation: [], evidenceCount: 0, simulatedAt: 1000 },
      kpiComparisons: [],
      activated: false,
      createdAt: 1000,
      schemaVersion: 1,
    });

    await putImprovementReview({
      id: 'FIREV-1',
      period: 'DAILY',
      periodStart: 0,
      periodEnd: 1000,
      metricChanges: [],
      bestImprovement: null,
      worstBottleneckStage: null,
      topRecommendation: null,
      batchesReviewed: 0,
      createdAt: 1000,
      schemaVersion: 1,
    });

    await appendFactoryEvolutionEntry({ id: 'FEVT-1', type: 'BACKLOG_TASK_CREATED', refId: 'FBACK-1', summary: 'Reduce Repair Time (REPAIR) — OPEN', at: 1000 });

    const backup = await buildAppBackup();
    expect(backup.manifest.stats.storeRecordCounts[FACTORY_IMPROVEMENT_BACKLOG_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[FACTORY_EXPERIMENTS_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[FACTORY_POLICY_EXPERIMENTS_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[FACTORY_IMPROVEMENT_REVIEWS_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[FACTORY_EVOLUTION_TIMELINE_STORE]).toBe(1);

    await Promise.all([clearImprovementBacklogForTest(), clearFactoryExperimentsForTest(), clearPolicyExperimentsForTest(), clearImprovementReviewsForTest(), clearFactoryEvolutionTimelineForTest()]);

    const result = await applyAppBackupRestore(backup.blob);
    expect(result.storeRecordCounts[FACTORY_IMPROVEMENT_BACKLOG_STORE]).toBe(1);
    expect(result.storeRecordCounts[FACTORY_EXPERIMENTS_STORE]).toBe(1);
    expect(result.storeRecordCounts[FACTORY_POLICY_EXPERIMENTS_STORE]).toBe(1);
    expect(result.storeRecordCounts[FACTORY_IMPROVEMENT_REVIEWS_STORE]).toBe(1);
    expect(result.storeRecordCounts[FACTORY_EVOLUTION_TIMELINE_STORE]).toBe(1);

    expect(await loadImprovementBacklog()).toHaveLength(1);
    expect(await loadFactoryExperiments()).toHaveLength(1);
    expect(await loadPolicyExperiments()).toHaveLength(1);
    expect(await loadImprovementReviews()).toHaveLength(1);
    expect(await loadFactoryEvolutionTimeline()).toHaveLength(1);
  });
});

describe('.vspsb — empty-store behavior', () => {
  it('builds and restores cleanly when every new store is empty', async () => {
    const backup = await buildAppBackup();
    for (const store of [FACTORY_IMPROVEMENT_BACKLOG_STORE, FACTORY_EXPERIMENTS_STORE, FACTORY_POLICY_EXPERIMENTS_STORE, FACTORY_IMPROVEMENT_REVIEWS_STORE, FACTORY_EVOLUTION_TIMELINE_STORE]) {
      expect(backup.manifest.stats.storeRecordCounts[store]).toBe(0);
    }
    const result = await applyAppBackupRestore(backup.blob);
    for (const store of [FACTORY_IMPROVEMENT_BACKLOG_STORE, FACTORY_EXPERIMENTS_STORE, FACTORY_POLICY_EXPERIMENTS_STORE, FACTORY_IMPROVEMENT_REVIEWS_STORE, FACTORY_EVOLUTION_TIMELINE_STORE]) {
      expect(result.storeRecordCounts[store]).toBe(0);
    }
  });
});
