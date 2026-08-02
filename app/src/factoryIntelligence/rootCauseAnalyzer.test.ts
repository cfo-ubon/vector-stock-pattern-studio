import { describe, it, expect } from 'vitest';
import { analyzeRootCauses, ROOT_CAUSE_THRESHOLDS } from './rootCauseAnalyzer';
import { computeFactoryIntelligenceMetrics } from './metricsEngine';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';
import type { FactoryTimelineEntry, FactoryTask } from '../factory/domain/types';

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

describe('analyzeRootCauses', () => {
  it('reports no root causes when every KPI is within threshold', () => {
    const tasks: FactoryTask[] = [];
    const metrics = computeFactoryIntelligenceMetrics(tasks, [], 1000);
    expect(analyzeRootCauses(tasks, [], metrics)).toEqual([]);
  });

  it('traces a real repairRatio-high chain from QA notes through blocked SEO/package/export tasks', () => {
    const repairTasks = Array.from({ length: 4 }, (_, i) => createFactoryTask({ type: 'repair', reason: 'x', assetId: `A-${i}`, now: 1000 }));
    const otherTasks = Array.from({ length: 6 }, (_, i) => createFactoryTask({ type: 'qa', reason: 'x', assetId: `B-${i}`, now: 1000 }));
    const tasks = [...repairTasks, ...otherTasks];

    let blockedSeo = createFactoryTask({ type: 'seo', reason: 'x', assetId: 'A-0', now: 1000 });
    blockedSeo = transitionFactoryTask(transitionFactoryTask(blockedSeo, 'RUNNING', 1500), 'BLOCKED', 2000, 'no sidecar');
    tasks.push(blockedSeo);

    const timeline: FactoryTimelineEntry[] = [
      timelineEntry({ taskType: 'qa', note: 'QA decision for A-0: REJECT.' }),
      timelineEntry({ taskType: 'qa', note: 'QA decision for A-1: REVIEW.' }),
      timelineEntry({ taskType: 'qa', note: 'QA decision for A-2: READY.' }),
    ];

    const metrics = computeFactoryIntelligenceMetrics(tasks, timeline, 3000);
    expect(metrics.repairRatio).toBeGreaterThan(ROOT_CAUSE_THRESHOLDS.repairRatioPercent);

    const analyses = analyzeRootCauses(tasks, timeline, metrics);
    const repairAnalysis = analyses.find((a) => a.kpi === 'repairRatio');
    expect(repairAnalysis).toBeDefined();
    expect(repairAnalysis!.chain[0].label).toBe('Repair Rate High');
    const qaStep = repairAnalysis!.chain.find((s) => s.label.includes('QA is rejecting'));
    expect(qaStep).toBeDefined();
    expect(qaStep!.evidence).toContain('2 of 3');
    const seoStep = repairAnalysis!.chain.find((s) => s.label.includes('Missing SEO'));
    expect(seoStep).toBeDefined();
    expect(seoStep!.sourceTaskIds).toEqual([blockedSeo.id]);
  });

  it('stops the chain rather than inventing steps with no supporting evidence', () => {
    const blockedTasks = Array.from({ length: 5 }, (_, i) => {
      let t = createFactoryTask({ type: 'qa', reason: 'x', assetId: `C-${i}`, now: 1000 });
      t = transitionFactoryTask(transitionFactoryTask(t, 'RUNNING', 1500), 'BLOCKED', 2000, 'no snapshot');
      return t;
    });
    const readyTasks = Array.from({ length: 10 }, (_, i) => createFactoryTask({ type: 'generate', reason: 'x', now: 1000, batchId: `B-${i}` }));
    const tasks = [...blockedTasks, ...readyTasks];
    const metrics = computeFactoryIntelligenceMetrics(tasks, [], 3000);
    expect(metrics.blockedTaskRatio).toBeGreaterThan(ROOT_CAUSE_THRESHOLDS.blockedTaskRatioPercent);

    const analyses = analyzeRootCauses(tasks, [], metrics);
    const blockedAnalysis = analyses.find((a) => a.kpi === 'blockedTaskRatio');
    expect(blockedAnalysis).toBeDefined();
    expect(blockedAnalysis!.chain).toHaveLength(1);
  });
});
