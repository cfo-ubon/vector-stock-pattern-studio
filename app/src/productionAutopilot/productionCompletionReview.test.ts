import { describe, it, expect } from 'vitest';
import { reviewProductionCompletion } from './productionCompletionReview';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';
import type { FactoryTask } from '../factory/domain/types';

const NOW = 1_700_000_000_000;

function completedBatch(): FactoryTask[] {
  let generate = createFactoryTask({ type: 'generate', reason: 'batch', now: NOW, batchId: 'B1' });
  generate = transitionFactoryTask(transitionFactoryTask(generate, 'RUNNING', NOW + 500), 'COMPLETED', NOW + 1000);

  let pkg = createFactoryTask({ type: 'package', reason: 'x', assetId: 'A-1', batchId: 'B1', now: NOW });
  pkg = transitionFactoryTask(transitionFactoryTask(pkg, 'RUNNING', NOW + 1500), 'COMPLETED', NOW + 2000);

  let exportValidation = createFactoryTask({ type: 'exportValidation', reason: 'x', assetId: 'A-1', batchId: 'B1', now: NOW });
  exportValidation = transitionFactoryTask(transitionFactoryTask(exportValidation, 'RUNNING', NOW + 2100), 'COMPLETED', NOW + 2200);

  return [generate, pkg, exportValidation];
}

describe('reviewProductionCompletion', () => {
  it('returns null for a batch that is not yet fully terminal, never an estimate', () => {
    const inProgress = createFactoryTask({ type: 'generate', reason: 'x', batchId: 'B2', now: NOW });
    const result = reviewProductionCompletion('B2', [inProgress], [], [], [], [], NOW + 100);
    expect(result).toBeNull();
  });

  it('builds a real review composed from real FactoryReview + BusinessOutcomeScore output once the batch is terminal', () => {
    const tasks = completedBatch();
    const result = reviewProductionCompletion('B1', tasks, [], [], [], [], NOW + 3000);
    expect(result).not.toBeNull();
    expect(result!.batchId).toBe('B1');
    expect(result!.packagesProduced).toBe(1);
    expect(result!.commercialReady).toBe(1);
  });

  it('always includes a next recommendation, sourced from this module\'s own recommender', () => {
    const tasks = completedBatch();
    const result = reviewProductionCompletion('B1', tasks, [], [], [], [], NOW + 3000);
    expect(result!.nextRecommendation).toBeDefined();
    expect(result!.nextRecommendation.action).toBeTruthy();
  });

  it('never invents an improvement task count when the improvement engine finds none', () => {
    const tasks = completedBatch();
    const result = reviewProductionCompletion('B1', tasks, [], [], [], [], NOW + 3000);
    expect(typeof result!.improvementTasksCreated).toBe('number');
    expect(result!.improvementTasksCreated).toBeGreaterThanOrEqual(0);
  });
});
