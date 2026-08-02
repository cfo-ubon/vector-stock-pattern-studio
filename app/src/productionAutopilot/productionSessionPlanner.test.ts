import { describe, it, expect } from 'vitest';
import { planProductionSession } from './productionSessionPlanner';
import { runPreflightValidation } from './preflightValidation';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';
import type { FactoryReview } from '../factoryIntelligence/domain/types';

const NOW = 1_700_000_000_000;

function review(overrides: Partial<FactoryReview> = {}): FactoryReview {
  return {
    id: 'FREV-1',
    batchId: 'B-1',
    packagesProduced: 5,
    commercialReady: 3,
    review: 1,
    rejected: 1,
    averageCompletionTimeMs: 60000,
    repairCount: 1,
    queueDelaysMs: null,
    factoryEfficiency: 80,
    ownerTimeSavedMinutes: 15,
    topBottleneckStage: null,
    topRecommendation: null,
    createdAt: NOW - 1000,
    schemaVersion: 1,
    ...overrides,
  };
}

describe('planProductionSession', () => {
  it('never invents a target — counts real READY package/export tasks close to completion', () => {
    const readyPackage = createFactoryTask({ type: 'package', reason: 'x', assetId: 'A-1', now: NOW });
    const preflight = runPreflightValidation([readyPackage], [], [], [], NOW);
    const plan = planProductionSession([readyPackage], [], [], preflight, NOW);
    expect(plan.targetPackages).toBe(1);
    expect(plan.productionGoal).toContain('1 Commercial Package');
  });

  it('falls back to a generate-oriented goal when nothing is close to completion and Decision OS allows it', () => {
    const preflight = runPreflightValidation([], [], [], [], NOW);
    const plan = planProductionSession([], [], [], preflight, NOW);
    expect(plan.targetPackages).toBe(0);
    expect(plan.productionGoal).toMatch(/Generate new/);
  });

  it('carries the real Preflight decisionTrace, never a second independent decision', () => {
    const preflight = runPreflightValidation([], [], [], [], NOW);
    const plan = planProductionSession([], [], [], preflight, NOW);
    expect(plan.decisionTrace).toBe(preflight.decisionTrace);
    expect(plan.policyIds).toEqual(preflight.decisionTrace.policyIds);
    expect(plan.confidence).toBe(preflight.decisionTrace.confidenceBand);
  });

  it('averages expected outcomes from real recent reviews, honest null with none', () => {
    const preflight = runPreflightValidation([], [], [], [], NOW);
    const withReviews = planProductionSession([], [], [review({ commercialReady: 4 }), review({ commercialReady: 6 })], preflight, NOW);
    expect(withReviews.expectedReadyPackages).toBe(5);

    const withoutReviews = planProductionSession([], [], [], preflight, NOW);
    expect(withoutReviews.expectedReadyPackages).toBeNull();
  });

  it('excludes non-READY tasks from the target count', () => {
    let pkg = createFactoryTask({ type: 'package', reason: 'x', assetId: 'A-1', now: NOW });
    pkg = transitionFactoryTask(pkg, 'RUNNING', NOW + 100);
    const preflight = runPreflightValidation([pkg], [], [], [], NOW);
    const plan = planProductionSession([pkg], [], [], preflight, NOW);
    expect(plan.targetPackages).toBe(0);
  });
});
