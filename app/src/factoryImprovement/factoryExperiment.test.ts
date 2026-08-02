import { describe, it, expect } from 'vitest';
import { startFactoryExperiment, concludeFactoryExperiment } from './factoryExperiment';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';
import type { FactoryTask } from '../factory/domain/types';

function complete(task: FactoryTask, now: number): FactoryTask {
  return transitionFactoryTask(transitionFactoryTask(task, 'RUNNING', now), 'COMPLETED', now + 10);
}

describe('startFactoryExperiment', () => {
  it('snapshots real live metrics as the Before baseline', () => {
    const generateTask = complete(createFactoryTask({ type: 'generate', reason: 'x', assetId: 'A-1', now: 1000 }), 1000);
    const repairTask = complete(createFactoryTask({ type: 'repair', reason: 'y', assetId: 'A-1', now: 1000 }), 1000);
    const experiment = startFactoryExperiment('REPAIR_FIRST', 'B-1', [generateTask, repairTask], [], 2000);
    expect(experiment.status).toBe('RUNNING');
    expect(experiment.afterMetrics).toBeNull();
    expect(experiment.beforeMetrics.repairRatio).toBe(50);
  });
});

describe('concludeFactoryExperiment', () => {
  it('returns null while the target batch is still in progress', () => {
    const running = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', batchId: 'B-1', now: 1000 });
    const experiment = startFactoryExperiment('REPAIR_FIRST', 'B-1', [], [], 1000);
    const result = concludeFactoryExperiment(experiment, [running], [], 2000);
    expect(result).toBeNull();
  });

  it('reports SUCCESS when the targeted metric genuinely improves after the one-batch trial', () => {
    const generateTask = complete(createFactoryTask({ type: 'generate', reason: 'x', assetId: 'A-1', now: 1000 }), 1000);
    const repairTask = complete(createFactoryTask({ type: 'repair', reason: 'y', assetId: 'A-1', now: 1000 }), 1000);
    const experiment = startFactoryExperiment('REPAIR_FIRST', 'B-1', [generateTask, repairTask], [], 2000);
    expect(experiment.beforeMetrics.repairRatio).toBe(50);

    const batchTasks = [
      complete(createFactoryTask({ type: 'generate', reason: 'a', assetId: 'A-2', batchId: 'B-1', now: 3000 }), 3000),
      complete(createFactoryTask({ type: 'repair', reason: 'b', assetId: 'A-2', batchId: 'B-1', now: 3000 }), 3000),
      complete(createFactoryTask({ type: 'package', reason: 'c', assetId: 'A-2', batchId: 'B-1', now: 3000 }), 3000),
      complete(createFactoryTask({ type: 'exportValidation', reason: 'd', assetId: 'A-2', batchId: 'B-1', now: 3000 }), 3000),
    ];
    const concluded = concludeFactoryExperiment(experiment, batchTasks, [], 4000);
    expect(concluded).not.toBeNull();
    expect(concluded?.status).toBe('CONCLUDED');
    expect(concluded?.afterMetrics?.repairRatio).toBe(25);
    expect(concluded?.result).toBe('SUCCESS');
    expect(concluded?.resultExplanation.length).toBeGreaterThan(0);
  });

  it('reports UNKNOWN (never a fabricated verdict) when the metric has no real data on either side', () => {
    const experiment = startFactoryExperiment('COLLECTION_COMPLETION_FIRST', 'B-2', [], [], 1000);
    const batchTasks = [complete(createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', batchId: 'B-2', now: 1000 }), 1000)];
    const concluded = concludeFactoryExperiment(experiment, batchTasks, [], 2000);
    expect(concluded?.result).toBe('UNKNOWN');
  });
});
