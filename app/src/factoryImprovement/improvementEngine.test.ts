import { describe, it, expect } from 'vitest';
import { identifyImprovementCandidates, identifyImprovementCandidatesForCompletedBatch } from './improvementEngine';
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

describe('identifyImprovementCandidates', () => {
  it('never invents a candidate when there is no evidence at all', () => {
    const candidates = identifyImprovementCandidates([], [], [], 1000);
    expect(candidates).toEqual([]);
  });

  it('produces a REPAIR candidate from real BLOCKED repair tasks', () => {
    let repair1 = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', now: 1000 });
    repair1 = transitionFactoryTask(transitionFactoryTask(repair1, 'RUNNING', 1500), 'BLOCKED', 2000, 'no sidecar');
    const candidates = identifyImprovementCandidates([repair1], [], [], 3000);
    expect(candidates.some((c) => c.category === 'REPAIR' && c.stage === 'repair')).toBe(true);
  });

  it('never produces a candidate for the generate stage even when it is the top bottleneck signal', () => {
    const timeline = [timelineEntry({ taskType: 'generate', durationMs: 9000 }), timelineEntry({ taskType: 'seo', durationMs: 500 })];
    const candidates = identifyImprovementCandidates([], timeline, [], 5000);
    expect(candidates.every((c) => c.stage !== 'generate')).toBe(true);
  });

  it('surfaces READY opportunity work with isReadyWork=true', () => {
    const readySeo = createFactoryTask({ type: 'seo', reason: 'ready', assetId: 'A-1', now: 1000 });
    const candidates = identifyImprovementCandidates([readySeo], [], [], 2000);
    const seoCandidate = candidates.find((c) => c.category === 'SEO');
    expect(seoCandidate?.isReadyWork).toBe(true);
  });

  it('includes real Decision Timeline evidence for a factory-domain blocked decision', () => {
    let repair1 = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', now: 1000 });
    repair1 = transitionFactoryTask(transitionFactoryTask(repair1, 'RUNNING', 1500), 'BLOCKED', 2000, 'no sidecar');
    const decisionTimeline = [
      {
        id: 'DECTL-1',
        decisionId: 'DEC-1',
        domain: 'factory' as const,
        requestedAction: null,
        recommendedAction: null,
        businessImpact: 'HIGH' as const,
        confidenceScore: 80,
        confidenceBand: 'high' as const,
        policyIds: [],
        evidenceIds: [],
        blockedReasons: ['repair backlog'],
        warnings: [],
        explanation: [],
        createdAt: 1000,
      },
    ];
    const candidates = identifyImprovementCandidates([repair1], [], decisionTimeline, 3000);
    const repairCandidate = candidates.find((c) => c.category === 'REPAIR');
    expect(repairCandidate?.evidence.some((e) => e.includes('Decision Timeline'))).toBe(true);
  });
});

describe('identifyImprovementCandidatesForCompletedBatch', () => {
  it('returns null for a batch that is still in progress', () => {
    const task = createFactoryTask({ type: 'generate', reason: 'x', assetId: 'A-1', batchId: 'B-1', now: 1000 });
    const result = identifyImprovementCandidatesForCompletedBatch('B-1', [task], [], [], 2000);
    expect(result).toBeNull();
  });

  it('returns null for a batchId with no matching tasks', () => {
    expect(identifyImprovementCandidatesForCompletedBatch('B-nope', [], [], [], 1000)).toBeNull();
  });

  it('returns candidates once every task in the batch is terminal', () => {
    let task = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', batchId: 'B-1', now: 1000 });
    task = transitionFactoryTask(task, 'RUNNING', 1300);
    task = transitionFactoryTask(task, 'COMPLETED', 1400);
    const result = identifyImprovementCandidatesForCompletedBatch('B-1', [task], [], [], 2000);
    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(true);
  });
});
