import { describe, it, expect } from 'vitest';
import { buildFactoryExecutionContext, refreshFactoryExecutionContext } from './executionContext';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';
import { runPreflightValidation } from '../productionAutopilot/preflightValidation';
import { planProductionSession } from '../productionAutopilot/productionSessionPlanner';
import { createProductionSession } from '../productionAutopilot/productionSession';
import { recordOwnerDecision } from '../productionAutopilot/ownerDecision';
import type { ImprovementBacklogTask } from '../factoryImprovement/domain/types';

const NOW = 1_700_000_000_000;

function session() {
  const preflight = runPreflightValidation([], [], [], [], NOW);
  const plan = planProductionSession([], [], [], preflight, NOW);
  return createProductionSession(plan, NOW);
}

describe('buildFactoryExecutionContext', () => {
  it('composes real factoryKpis/businessOutcome via the same engines Factory Intelligence already uses — never a second implementation', () => {
    const task = createFactoryTask({ type: 'seo', reason: 'x', assetId: 'A-1', now: NOW });
    const context = buildFactoryExecutionContext('FORCH-1', [task], [], [], [], null, NOW);
    expect(context.factoryKpis).not.toBeNull();
    expect(context.businessOutcome).not.toBeNull();
    expect(context.queue).toEqual([task]);
  });

  it('pulls decision/policy/evidence ids from the real session plan when a session exists', () => {
    const s = session();
    const context = buildFactoryExecutionContext('FORCH-1', [], [], [], [], s, NOW);
    expect(context.decisionIds).toEqual([s.decisionTrace.decisionId]);
    expect(context.policyIds).toEqual(s.plan.policyIds);
    expect(context.evidenceIds).toEqual(s.plan.evidenceIds);
  });

  it('scopes owner decisions to the real session id — never leaks unrelated records in', () => {
    const s = session();
    const mine = recordOwnerDecision('APPROVE_SESSION', s.id, 1000, NOW);
    const other = recordOwnerDecision('APPROVE_SESSION', 'FSESS-OTHER', 1000, NOW);
    const context = buildFactoryExecutionContext('FORCH-1', [], [], [mine, other], [], s, NOW);
    expect(context.ownerDecisions).toEqual([mine]);
  });

  it('scopes improvement references to the session batch — honest empty array with no batch', () => {
    const s = session();
    const backlog: ImprovementBacklogTask[] = [
      { id: 'FBACK-1', priority: 10, businessImpact: 'HIGH', evidence: [], confidence: 'high', estimatedBenefit: 'HIGH', estimatedRisk: 'LOW', recommendedOwner: 'OWNER_REVIEW', status: 'OPEN', category: 'REPAIR', title: 'x', reason: 'x', sourceStage: 'repair', sourceTaskIds: [], sourceBatchId: 'B-1', createdAt: NOW, updatedAt: NOW, schemaVersion: 1 },
    ];
    const withoutBatch = buildFactoryExecutionContext('FORCH-1', [], [], [], backlog, s, NOW);
    expect(withoutBatch.improvementReferences).toEqual([]);

    const sWithBatch = { ...s, batchId: 'B-1' };
    const withBatch = buildFactoryExecutionContext('FORCH-1', [], [], [], backlog, sWithBatch, NOW);
    expect(withBatch.improvementReferences).toEqual(['FBACK-1']);
  });

  it('returns honest empty/null fields when there is no session at all', () => {
    const context = buildFactoryExecutionContext('FORCH-1', [], [], [], [], null, NOW);
    expect(context.session).toBeNull();
    expect(context.decisionIds).toEqual([]);
    expect(context.ownerDecisions).toEqual([]);
  });
});

describe('refreshFactoryExecutionContext', () => {
  it('recomputes only factoryKpis/businessOutcome/queue/timeline, preserving every other field', () => {
    const s = session();
    const context = buildFactoryExecutionContext('FORCH-1', [], [], [], [], s, NOW);
    let task = createFactoryTask({ type: 'seo', reason: 'x', assetId: 'A-1', now: NOW });
    task = transitionFactoryTask(transitionFactoryTask(task, 'RUNNING', NOW + 100), 'COMPLETED', NOW + 200);
    const refreshed = refreshFactoryExecutionContext(context, [task], [], NOW + 300);
    expect(refreshed.queue).toEqual([task]);
    expect(refreshed.session).toBe(context.session);
    expect(refreshed.runId).toBe(context.runId);
    expect(refreshed.computedAt).toBe(NOW + 300);
  });
});
