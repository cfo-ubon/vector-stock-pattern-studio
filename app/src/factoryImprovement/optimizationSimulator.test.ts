import { describe, it, expect } from 'vitest';
import { simulateOptimization, simulateAllOptimizations } from './optimizationSimulator';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';

describe('simulateOptimization', () => {
  it('returns UNKNOWN with no evidence for a scenario whose stage is not the current bottleneck', () => {
    const result = simulateOptimization('REPAIR_FIRST', [], [], 1000);
    expect(result.expectedImprovement).toBe('UNKNOWN');
    expect(result.confidence).toBe('unknown');
    expect(result.evidenceCount).toBe(0);
  });

  it('projects real improvement only when the scenario matches the actual current bottleneck', () => {
    let repair1 = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', now: 1000 });
    repair1 = transitionFactoryTask(transitionFactoryTask(repair1, 'RUNNING', 1500), 'BLOCKED', 2000, 'no sidecar');
    let repair2 = createFactoryTask({ type: 'repair', reason: 'y', assetId: 'A-2', now: 1000 });
    repair2 = transitionFactoryTask(transitionFactoryTask(repair2, 'RUNNING', 1500), 'BLOCKED', 2000, 'no sidecar');

    const result = simulateOptimization('REPAIR_FIRST', [repair1, repair2], [], 3000);
    expect(result.evidenceCount).toBeGreaterThan(0);
    expect(result.expectedImprovement).not.toBe('UNKNOWN');
    expect(result.targetMetric).toBe('repairRatio');
  });

  it('never returns a numeric revenue figure — only a named BusinessImpact level', () => {
    const result = simulateOptimization('QUEUE_IMPROVEMENT', [], [], 1000);
    expect(['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']).toContain(result.expectedImprovement);
  });
});

describe('simulateAllOptimizations', () => {
  it('returns exactly the 4 named scenarios', () => {
    const results = simulateAllOptimizations([], [], 1000);
    expect(results.map((r) => r.scenario).sort()).toEqual(['COLLECTION_COMPLETION_FIRST', 'PACKAGING_EARLIER', 'QUEUE_IMPROVEMENT', 'REPAIR_FIRST'].sort());
  });
});
