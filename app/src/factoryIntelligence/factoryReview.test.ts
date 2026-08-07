import { describe, it, expect } from 'vitest';
import { createFactoryReview } from './factoryReview';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';
import type { FactoryTask, FactoryTimelineEntry } from '../factory/domain/types';

function timelineEntry(overrides: Partial<FactoryTimelineEntry>): FactoryTimelineEntry {
  return {
    id: `FTL-${Math.random()}`,
    taskId: 'FTASK-1',
    taskType: 'qa',
    batchId: 'B1',
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

describe('createFactoryReview', () => {
  it('returns null when the batch does not exist', () => {
    expect(createFactoryReview('B-MISSING', [], [], 1000)).toBeNull();
  });

  it('returns null while any task in the batch is still non-terminal', () => {
    let generate = createFactoryTask({ type: 'generate', reason: 'batch', now: 1000, batchId: 'B1' });
    generate = transitionFactoryTask(transitionFactoryTask(generate, 'RUNNING', 1500), 'COMPLETED', 2000);
    const qa = createFactoryTask({ type: 'qa', reason: 'x', assetId: 'A-1', batchId: 'B1', now: 1000 });
    expect(createFactoryReview('B1', [generate, qa], [], 3000)).toBeNull();
  });

  it('builds a real review once every task in the batch is terminal', () => {
    let generate = createFactoryTask({ type: 'generate', reason: 'batch', now: 1000, batchId: 'B1' });
    generate = transitionFactoryTask(transitionFactoryTask(generate, 'RUNNING', 1500), 'COMPLETED', 2000);

    let pkg = createFactoryTask({ type: 'package', reason: 'x', assetId: 'A-1', batchId: 'B1', now: 1000 });
    pkg = transitionFactoryTask(transitionFactoryTask(pkg, 'RUNNING', 2500), 'COMPLETED', 3000);

    let exportValidation = createFactoryTask({ type: 'exportValidation', reason: 'x', assetId: 'A-1', batchId: 'B1', now: 1000 });
    exportValidation = transitionFactoryTask(transitionFactoryTask(exportValidation, 'RUNNING', 3100), 'COMPLETED', 3200);

    const tasks: FactoryTask[] = [generate, pkg, exportValidation];
    const timeline: FactoryTimelineEntry[] = [
      timelineEntry({ taskId: 'unrelated', batchId: null, taskType: 'qa', note: 'QA decision for X: REVIEW.' }),
      timelineEntry({ taskId: pkg.id, batchId: 'B1', taskType: 'package', durationMs: 500 }),
    ];

    const review = createFactoryReview('B1', tasks, timeline, 3300);
    expect(review).not.toBeNull();
    expect(review!.batchId).toBe('B1');
    expect(review!.packagesProduced).toBe(1);
    expect(review!.commercialReady).toBe(1);
    expect(review!.averageCompletionTimeMs).toBe(3200 - 1000);
    // Timeline entries with a different batchId never leak into this batch's review.
    expect(review!.review).toBe(0);
    expect(review!.rejected).toBe(0);
    expect(review!.ownerTimeSavedMinutes).toBeGreaterThan(0);
  });

  it('counts real repair attempts and parses QA review/reject decisions scoped strictly to the batch', () => {
    let generate = createFactoryTask({ type: 'generate', reason: 'batch', now: 1000, batchId: 'B2' });
    generate = transitionFactoryTask(transitionFactoryTask(generate, 'RUNNING', 1500), 'COMPLETED', 2000);
    let qa = createFactoryTask({ type: 'qa', reason: 'x', assetId: 'A-1', batchId: 'B2', now: 1000 });
    qa = transitionFactoryTask(transitionFactoryTask(qa, 'RUNNING', 2100), 'COMPLETED', 2200);
    let repair = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', batchId: 'B2', now: 1000 });
    repair = transitionFactoryTask(transitionFactoryTask(repair, 'RUNNING', 2300), 'COMPLETED', 2400);

    const timeline: FactoryTimelineEntry[] = [timelineEntry({ taskId: qa.id, batchId: 'B2', taskType: 'qa', note: 'QA decision for A-1: REVIEW.' })];
    const review = createFactoryReview('B2', [generate, qa, repair], timeline, 2500);
    expect(review!.repairCount).toBe(1);
    expect(review!.review).toBe(1);
  });
});
