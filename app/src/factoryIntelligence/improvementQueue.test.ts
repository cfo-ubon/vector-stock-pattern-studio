import { describe, it, expect } from 'vitest';
import { generateImprovementTasks } from './improvementQueue';
import { analyzeBottleneck } from './bottleneckAnalyzer';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';

describe('generateImprovementTasks', () => {
  it('produces nothing when there is no bottleneck and no root causes', () => {
    const bottleneck = analyzeBottleneck([], [], 1000);
    expect(generateImprovementTasks(bottleneck, [], 1000)).toEqual([]);
  });

  it('maps a repair bottleneck to the "Reduce Repair Time" category, recommendation-only', () => {
    let repair1 = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', now: 1000 });
    repair1 = transitionFactoryTask(transitionFactoryTask(repair1, 'RUNNING', 1500), 'BLOCKED', 2000, 'no sidecar');
    const bottleneck = analyzeBottleneck([repair1], [], 3000);
    const tasks = generateImprovementTasks(bottleneck, [], 3000);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].category).toBe('REDUCE_REPAIR_TIME');
    expect(tasks[0].title).toBe('Reduce Repair Time');
    expect(tasks[0].status).toBe('OPEN');
    expect(tasks[0].evidence).toEqual(bottleneck.evidence);
  });

  it('deduplicates by category when both the bottleneck and a root cause point to the same category', () => {
    let repair1 = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', now: 1000 });
    repair1 = transitionFactoryTask(transitionFactoryTask(repair1, 'RUNNING', 1500), 'BLOCKED', 2000, 'no sidecar');
    const bottleneck = analyzeBottleneck([repair1], [], 3000);
    const tasks = generateImprovementTasks(bottleneck, [{ kpi: 'repairRatio', value: 50, threshold: 30, chain: [{ label: 'Repair Rate High', evidence: '50%', sourceTaskIds: [], sourceDecisionIds: [] }] }], 3000);
    expect(tasks).toHaveLength(1);
  });
});
