import { describe, it, expect } from 'vitest';
import { checkCommercialReadinessGate } from './commercialReadinessGate';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';
import type { DecisionTrace } from '../aiCeo/domain/types';

const NOW = 1_700_000_000_000;

function completedBatch() {
  let generate = createFactoryTask({ type: 'generate', reason: 'batch', now: NOW, batchId: 'B1' });
  generate = transitionFactoryTask(transitionFactoryTask(generate, 'RUNNING', NOW + 500), 'COMPLETED', NOW + 1000);

  let pkg = createFactoryTask({ type: 'package', reason: 'x', assetId: 'A-1', batchId: 'B1', now: NOW });
  pkg = transitionFactoryTask(transitionFactoryTask(pkg, 'RUNNING', NOW + 1500), 'COMPLETED', NOW + 2000);

  let exportValidation = createFactoryTask({ type: 'exportValidation', reason: 'x', assetId: 'A-1', batchId: 'B1', now: NOW });
  exportValidation = transitionFactoryTask(transitionFactoryTask(exportValidation, 'RUNNING', NOW + 2100), 'COMPLETED', NOW + 2200);

  return [generate, pkg, exportValidation];
}

function cleanTrace(): DecisionTrace {
  return { decisionId: 'DEC-1', domain: 'factory', policyIds: [], evidenceIds: [], confidenceScore: 90, confidenceBand: 'high', businessImpact: 'HIGH', alternative: null, blockedReasons: [] };
}

describe('checkCommercialReadinessGate', () => {
  it('refuses completion honestly when there is no batch at all', () => {
    const result = checkCommercialReadinessGate(null, [], [], null, NOW);
    expect(result.allAgree).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('all three authorities agree once the batch is terminal, unblocked, and the decision trace is clean', () => {
    const tasks = completedBatch();
    const result = checkCommercialReadinessGate('B1', tasks, [], cleanTrace(), NOW + 3000);
    expect(result.allAgree).toBe(true);
    expect(result.decisionOSAgrees).toBe(true);
    expect(result.factoryControllerAgrees).toBe(true);
    expect(result.factoryIntelligenceAgrees).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('Factory Controller refuses when a task in this batch is BLOCKED', () => {
    const tasks = completedBatch();
    let repair = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-2', batchId: 'B1', now: NOW });
    repair = transitionFactoryTask(transitionFactoryTask(repair, 'RUNNING', NOW + 100), 'BLOCKED', NOW + 200, 'no sidecar');
    const result = checkCommercialReadinessGate('B1', [...tasks, repair], [], cleanTrace(), NOW + 3000);
    expect(result.factoryControllerAgrees).toBe(false);
    expect(result.allAgree).toBe(false);
  });

  it('Factory Intelligence refuses when the batch is not yet fully terminal', () => {
    const inProgress = createFactoryTask({ type: 'generate', reason: 'x', batchId: 'B2', now: NOW });
    const result = checkCommercialReadinessGate('B2', [inProgress], [], cleanTrace(), NOW + 100);
    expect(result.factoryIntelligenceAgrees).toBe(false);
    expect(result.allAgree).toBe(false);
  });

  it('Decision OS refuses when the trace carries a real blocked reason', () => {
    const tasks = completedBatch();
    const blockedTrace: DecisionTrace = { ...cleanTrace(), blockedReasons: ['Repair backlog must clear first.'] };
    const result = checkCommercialReadinessGate('B1', tasks, [], blockedTrace, NOW + 3000);
    expect(result.decisionOSAgrees).toBe(false);
    expect(result.allAgree).toBe(false);
  });

  it('Decision OS refuses honestly when there is no real trace at all', () => {
    const tasks = completedBatch();
    const result = checkCommercialReadinessGate('B1', tasks, [], null, NOW + 3000);
    expect(result.decisionOSAgrees).toBe(false);
    expect(result.allAgree).toBe(false);
  });
});
