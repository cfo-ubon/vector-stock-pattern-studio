import { describe, it, expect } from 'vitest';
import { generateDailyBrief } from './dailyBrief';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';

describe('generateDailyBrief', () => {
  it('reports a clear-queue recommendation when there is nothing to do', () => {
    const brief = generateDailyBrief([], [], 1000);
    expect(brief.commercialPackagesReady).toBe(0);
    expect(brief.topBottleneck).toBeNull();
    expect(brief.topOpportunity).toBeNull();
    expect(brief.recommendedAction).toBe('No action needed — the queue is clear.');
  });

  it('counts commercialPackagesReady from real COMPLETED exportValidation tasks', () => {
    let exportValidation = createFactoryTask({ type: 'exportValidation', reason: 'x', assetId: 'A-1', now: 1000 });
    exportValidation = transitionFactoryTask(transitionFactoryTask(exportValidation, 'RUNNING', 1500), 'COMPLETED', 2000);
    const brief = generateDailyBrief([exportValidation], [], 3000);
    expect(brief.commercialPackagesReady).toBe(1);
  });

  it('surfaces the top opportunity as the recommended action when there is no active bottleneck', () => {
    const seo = createFactoryTask({ type: 'seo', reason: 'x', assetId: 'A-1', now: 1000 });
    const brief = generateDailyBrief([seo], [], 2000);
    expect(brief.topOpportunity?.type).toBe('FINISH_SEO');
    expect(brief.recommendedAction).toContain('Finish SEO');
  });

  it('prefers the bottleneck recommendation over an opportunity when both exist', () => {
    let blockedRepair1 = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', now: 1000 });
    blockedRepair1 = transitionFactoryTask(transitionFactoryTask(blockedRepair1, 'RUNNING', 1500), 'BLOCKED', 2000, 'no sidecar');
    let blockedRepair2 = createFactoryTask({ type: 'repair', reason: 'y', assetId: 'A-2', now: 1000 });
    blockedRepair2 = transitionFactoryTask(transitionFactoryTask(blockedRepair2, 'RUNNING', 1500), 'BLOCKED', 2000, 'no sidecar');
    const seo = createFactoryTask({ type: 'seo', reason: 'x', assetId: 'A-3', now: 1000 });
    const brief = generateDailyBrief([blockedRepair1, blockedRepair2, seo], [], 3000);
    expect(brief.topBottleneck?.stage).toBe('repair');
    expect(brief.recommendedAction).toBe(brief.topBottleneck?.recommendedImprovement);
  });
});
