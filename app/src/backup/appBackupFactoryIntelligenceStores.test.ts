import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { buildAppBackup } from './appBackupBuilder';
import { applyAppBackupRestore } from './appBackupRestore';
import { APP_BACKUP_STORE_NAMES } from './appBackupFormat';
import { FACTORY_DAILY_KPI_STORE, FACTORY_REVIEWS_STORE, FACTORY_IMPROVEMENT_QUEUE_STORE, FACTORY_BUSINESS_OUTCOME_HISTORY_STORE } from '../storage/db';
import { putFactoryDailyKpi, loadFactoryDailyKpiHistory, clearFactoryDailyKpiForTest } from '../factoryIntelligence/storage/factoryDailyKpiStore';
import { putFactoryReview, loadFactoryReviews, clearFactoryReviewsForTest } from '../factoryIntelligence/storage/factoryReviewStore';
import { putImprovementTask, loadImprovementTasks, clearImprovementTasksForTest } from '../factoryIntelligence/storage/improvementTaskStore';
import { putBusinessOutcomeScore, loadBusinessOutcomeHistory, clearBusinessOutcomeHistoryForTest } from '../factoryIntelligence/storage/businessOutcomeHistoryStore';
import { computeFactoryIntelligenceMetrics } from '../factoryIntelligence/metricsEngine';
import { FACTORY_REVIEW_SCHEMA_VERSION, IMPROVEMENT_TASK_SCHEMA_VERSION, BUSINESS_OUTCOME_SCHEMA_VERSION } from '../factoryIntelligence/domain/types';

// Mission 2 (Factory Intelligence) — .vspsb backup coverage for the 4 new
// stores, following the exact template `appBackup031CStores.test.ts`
// established.

const originalBlob = globalThis.Blob;
beforeEach(async () => {
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
  await Promise.all([clearFactoryDailyKpiForTest(), clearFactoryReviewsForTest(), clearImprovementTasksForTest(), clearBusinessOutcomeHistoryForTest()]);
});
afterEach(() => {
  globalThis.Blob = originalBlob;
});

describe('.vspsb coverage — all 4 Mission 2 stores are registered', () => {
  it('APP_BACKUP_STORE_NAMES includes factoryDailyKpi, factoryReviews, factoryImprovementQueue, factoryBusinessOutcomeHistory', () => {
    for (const store of [FACTORY_DAILY_KPI_STORE, FACTORY_REVIEWS_STORE, FACTORY_IMPROVEMENT_QUEUE_STORE, FACTORY_BUSINESS_OUTCOME_HISTORY_STORE]) {
      expect(APP_BACKUP_STORE_NAMES).toContain(store);
    }
  });
});

describe('.vspsb — non-empty round trip across all 4 stores', () => {
  it('backs up and restores real records from every store', async () => {
    const metrics = computeFactoryIntelligenceMetrics([], [], 1000);
    await putFactoryDailyKpi({ dateKey: '2026-08-01', capturedAt: 1000, metrics, businessOutcomeScore: 42 });
    await putFactoryReview({
      id: 'FREV-1',
      batchId: 'B1',
      packagesProduced: 3,
      commercialReady: 2,
      review: 1,
      rejected: 0,
      averageCompletionTimeMs: 5000,
      repairCount: 1,
      queueDelaysMs: 200,
      factoryEfficiency: 90,
      ownerTimeSavedMinutes: 45,
      topBottleneckStage: 'qa',
      topRecommendation: 'Review recent REVIEW/REJECT reasons.',
      createdAt: 1000,
      schemaVersion: FACTORY_REVIEW_SCHEMA_VERSION,
    });
    await putImprovementTask({
      id: 'FIMP-1',
      category: 'REDUCE_REPAIR_TIME',
      title: 'Reduce Repair Time',
      reason: 'Repair ratio is high',
      evidence: ['Repair ratio is 40%'],
      status: 'OPEN',
      createdAt: 1000,
      updatedAt: 1000,
      schemaVersion: IMPROVEMENT_TASK_SCHEMA_VERSION,
    });
    await putBusinessOutcomeScore({
      id: 'FBOS-1',
      score: 72,
      components: [{ name: 'commercialThroughput', value: 100, weight: 0.1, contribution: 10 }],
      explanation: ['test'],
      createdAt: 1000,
      schemaVersion: BUSINESS_OUTCOME_SCHEMA_VERSION,
    });

    const backup = await buildAppBackup();
    expect(backup.manifest.stats.storeRecordCounts[FACTORY_DAILY_KPI_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[FACTORY_REVIEWS_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[FACTORY_IMPROVEMENT_QUEUE_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[FACTORY_BUSINESS_OUTCOME_HISTORY_STORE]).toBe(1);

    await Promise.all([clearFactoryDailyKpiForTest(), clearFactoryReviewsForTest(), clearImprovementTasksForTest(), clearBusinessOutcomeHistoryForTest()]);

    const result = await applyAppBackupRestore(backup.blob);
    expect(result.storeRecordCounts[FACTORY_DAILY_KPI_STORE]).toBe(1);
    expect(result.storeRecordCounts[FACTORY_REVIEWS_STORE]).toBe(1);
    expect(result.storeRecordCounts[FACTORY_IMPROVEMENT_QUEUE_STORE]).toBe(1);
    expect(result.storeRecordCounts[FACTORY_BUSINESS_OUTCOME_HISTORY_STORE]).toBe(1);

    const restoredKpi = await loadFactoryDailyKpiHistory();
    expect(restoredKpi).toHaveLength(1);
    expect(restoredKpi[0].dateKey).toBe('2026-08-01');
    expect(await loadFactoryReviews()).toHaveLength(1);
    expect(await loadImprovementTasks()).toHaveLength(1);
    expect(await loadBusinessOutcomeHistory()).toHaveLength(1);
  });
});

describe('.vspsb — empty-store behavior', () => {
  it('builds and restores cleanly when every new store is empty', async () => {
    const backup = await buildAppBackup();
    for (const store of [FACTORY_DAILY_KPI_STORE, FACTORY_REVIEWS_STORE, FACTORY_IMPROVEMENT_QUEUE_STORE, FACTORY_BUSINESS_OUTCOME_HISTORY_STORE]) {
      expect(backup.manifest.stats.storeRecordCounts[store]).toBe(0);
    }
    const result = await applyAppBackupRestore(backup.blob);
    for (const store of [FACTORY_DAILY_KPI_STORE, FACTORY_REVIEWS_STORE, FACTORY_IMPROVEMENT_QUEUE_STORE, FACTORY_BUSINESS_OUTCOME_HISTORY_STORE]) {
      expect(result.storeRecordCounts[store]).toBe(0);
    }
  });
});
