import { describe, it, expect } from 'vitest';
import { reviewProductionQueue } from './productionQueueReview';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';

const NOW = 1_700_000_000_000;

describe('reviewProductionQueue', () => {
  it('reports real queue/ready counts, never fabricated', () => {
    const ready = createFactoryTask({ type: 'seo', reason: 'x', assetId: 'A-1', now: NOW });
    let completed = createFactoryTask({ type: 'seo', reason: 'x', assetId: 'A-2', now: NOW });
    completed = transitionFactoryTask(transitionFactoryTask(completed, 'RUNNING', NOW + 100), 'COMPLETED', NOW + 200);
    const review = reviewProductionQueue([ready, completed], [], NOW);
    expect(review.readyCount).toBe(1);
    expect(review.currentQueueCount).toBe(1);
  });

  it('surfaces a real BLOCKED stage with its real count', () => {
    let repair = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', now: NOW });
    repair = transitionFactoryTask(transitionFactoryTask(repair, 'RUNNING', NOW + 100), 'BLOCKED', NOW + 200, 'no sidecar');
    const review = reviewProductionQueue([repair], [], NOW);
    expect(review.blockedTasks).toEqual([{ stage: 'repair', count: 1 }]);
  });

  it('reuses the real Bottleneck Analyzer output, never a second implementation', () => {
    const review = reviewProductionQueue([], [], NOW);
    expect(review.topBottleneck).toBeDefined();
    expect(review.computedAt).toBe(NOW);
  });

  it('reports no blocked stages when the queue has no BLOCKED tasks', () => {
    const ready = createFactoryTask({ type: 'seo', reason: 'x', assetId: 'A-1', now: NOW });
    const review = reviewProductionQueue([ready], [], NOW);
    expect(review.blockedTasks).toEqual([]);
  });
});
