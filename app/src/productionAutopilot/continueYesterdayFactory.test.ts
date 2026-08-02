import { describe, it, expect } from 'vitest';
import { checkContinueYesterday } from './continueYesterdayFactory';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';

const NOW = 1_700_000_000_000;

describe('checkContinueYesterday', () => {
  it('reports no unfinished work when every batch is terminal', () => {
    let task = createFactoryTask({ type: 'seo', reason: 'x', assetId: 'A-1', batchId: 'B1', now: NOW });
    task = transitionFactoryTask(transitionFactoryTask(task, 'RUNNING', NOW + 100), 'COMPLETED', NOW + 200);
    const result = checkContinueYesterday([task]);
    expect(result.hasUnfinishedWork).toBe(false);
    expect(result.batchId).toBeNull();
  });

  it('finds a real unfinished batch with an accurate incomplete count', () => {
    const done = (() => {
      let t = createFactoryTask({ type: 'seo', reason: 'x', assetId: 'A-1', batchId: 'B1', now: NOW });
      return transitionFactoryTask(transitionFactoryTask(t, 'RUNNING', NOW + 100), 'COMPLETED', NOW + 200);
    })();
    const pending = createFactoryTask({ type: 'package', reason: 'x', assetId: 'A-2', batchId: 'B1', now: NOW });

    const result = checkContinueYesterday([done, pending]);
    expect(result.hasUnfinishedWork).toBe(true);
    expect(result.batchId).toBe('B1');
    expect(result.incompleteTaskCount).toBe(1);
  });

  it('ignores tasks with no batchId — never fabricates a batch', () => {
    const task = createFactoryTask({ type: 'seo', reason: 'x', assetId: 'A-1', now: NOW });
    const result = checkContinueYesterday([task]);
    expect(result.hasUnfinishedWork).toBe(false);
  });

  it('returns honest nulls for reason/batchId when there is nothing to continue', () => {
    const result = checkContinueYesterday([]);
    expect(result.reason).toBeNull();
    expect(result.batchId).toBeNull();
    expect(result.incompleteTaskCount).toBe(0);
  });
});
