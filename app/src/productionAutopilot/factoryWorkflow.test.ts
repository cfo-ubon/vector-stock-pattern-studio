import { describe, it, expect } from 'vitest';
import { startFactoryWorkflow } from './factoryWorkflow';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';

const NOW = 1_700_000_000_000;

describe('startFactoryWorkflow', () => {
  it('always requires owner approval — never self-approves or auto-executes', () => {
    const result = startFactoryWorkflow([], [], [], [], [], [], NOW);
    expect(result.requiresOwnerApproval).toBe(true);
  });

  it('runs every stage from a single real engine, producing all 6 result fields', () => {
    const task = createFactoryTask({ type: 'seo', reason: 'x', assetId: 'A-1', now: NOW });
    const result = startFactoryWorkflow([task], [], [], [], [], [], NOW);
    expect(result.decisionReview).toBeDefined();
    expect(result.queueValidation).toBeDefined();
    expect(Array.isArray(result.dependencyIssues)).toBe(true);
    expect(Array.isArray(result.improvementNotices)).toBe(true);
    expect(result.productionPlan).toBeDefined();
    expect(result.recommendation).toBeDefined();
  });

  it('the recommendation is consistent with the decision review it was computed from', () => {
    const result = startFactoryWorkflow([], [], [], [], [], [], NOW);
    expect(result.recommendation.decisionTrace).toEqual(result.decisionReview.decisionTrace);
  });

  it('surfaces real dependency-blocked reasons, never a fabricated explanation', () => {
    let blocked = createFactoryTask({ type: 'package', reason: 'x', assetId: 'A-1', now: NOW });
    blocked = transitionFactoryTask(transitionFactoryTask(blocked, 'RUNNING', NOW + 100), 'BLOCKED', NOW + 200, 'missing dependency');
    const result = startFactoryWorkflow([blocked], [], [], [], [], [], NOW);
    expect(result.dependencyIssues).toEqual(['missing dependency']);
  });

  it('stamps computedAt with the provided now', () => {
    const result = startFactoryWorkflow([], [], [], [], [], [], NOW);
    expect(result.computedAt).toBe(NOW);
  });
});
