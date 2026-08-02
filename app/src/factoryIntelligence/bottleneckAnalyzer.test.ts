import { describe, it, expect } from 'vitest';
import { analyzeBottleneck } from './bottleneckAnalyzer';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';
import type { FactoryTimelineEntry } from '../factory/domain/types';

function timelineEntry(overrides: Partial<FactoryTimelineEntry>): FactoryTimelineEntry {
  return {
    id: `FTL-${Math.random()}`,
    taskId: 'FTASK-1',
    taskType: 'qa',
    batchId: null,
    event: 'FINISHED',
    note: 'ok',
    durationMs: 1000,
    decisionId: null,
    policyIds: [],
    evidenceIds: [],
    confidenceScore: null,
    confidenceBand: null,
    at: 1000,
    ...overrides,
  };
}

describe('analyzeBottleneck', () => {
  it('never invents a cause when there is no evidence at all', () => {
    const report = analyzeBottleneck([], [], 1000);
    expect(report.stage).toBeNull();
    expect(report.reason).toBeNull();
    expect(report.evidence).toEqual([]);
    expect(report.businessImpact).toBeNull();
  });

  it('picks the stage with the most BLOCKED tasks over any other signal', () => {
    let repair1 = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', now: 1000 });
    repair1 = transitionFactoryTask(transitionFactoryTask(repair1, 'RUNNING', 1500), 'BLOCKED', 2000, 'no sidecar');
    let repair2 = createFactoryTask({ type: 'repair', reason: 'y', assetId: 'A-2', now: 1000 });
    repair2 = transitionFactoryTask(transitionFactoryTask(repair2, 'RUNNING', 1500), 'BLOCKED', 2000, 'no sidecar');
    let qa1 = createFactoryTask({ type: 'qa', reason: 'z', assetId: 'A-3', now: 1000 });
    qa1 = transitionFactoryTask(transitionFactoryTask(qa1, 'RUNNING', 1500), 'BLOCKED', 2000, 'no snapshot');

    const report = analyzeBottleneck([repair1, repair2, qa1], [], 3000);
    expect(report.stage).toBe('repair');
    expect(report.sourceTaskIds).toEqual([repair1.id, repair2.id]);
    expect(report.businessImpact).toBe('HIGH');
    expect(report.recommendedImprovement).toContain('repair');
  });

  it('falls back to the highest average completion time when nothing is BLOCKED', () => {
    const timeline = [timelineEntry({ taskType: 'seo', durationMs: 500 }), timelineEntry({ taskType: 'package', durationMs: 9000 })];
    const report = analyzeBottleneck([], timeline, 5000);
    expect(report.stage).toBe('package');
    expect(report.evidence[0]).toContain('package');
  });

  it('flags the queue as the bottleneck when average wait time exceeds the threshold and nothing else has evidence', () => {
    let task = createFactoryTask({ type: 'qa', reason: 'x', assetId: 'A-1', now: 0 });
    task = transitionFactoryTask(task, 'RUNNING', 20 * 60 * 1000);
    const report = analyzeBottleneck([task], [], 25 * 60 * 1000);
    expect(report.stage).toBe('queue');
  });
});
