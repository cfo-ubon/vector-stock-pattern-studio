import { describe, it, expect } from 'vitest';
import { runPolicyExperiment } from './policyExperiment';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';

describe('runPolicyExperiment', () => {
  it('never activates — activated is always false', () => {
    const result = runPolicyExperiment('REPAIR_FIRST_POLICY', [], [], 1000);
    expect(result.activated).toBe(false);
  });

  it('measures exactly the 4 named KPIs (Commercial Ready, Repair, Queue, Owner Time)', () => {
    const result = runPolicyExperiment('FINISH_COLLECTION_FIRST', [], [], 1000);
    expect(result.kpiComparisons.map((c) => c.kpi).sort()).toEqual(['averageQueueTimeMs', 'commercialReadyRatio', 'ownerWaitingTimeMs', 'repairRatio'].sort());
  });

  it('never asserts Owner Time will change without its own supporting evidence', () => {
    let repair1 = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', now: 1000 });
    repair1 = transitionFactoryTask(transitionFactoryTask(repair1, 'RUNNING', 1500), 'BLOCKED', 2000, 'no sidecar');
    const result = runPolicyExperiment('REPAIR_FIRST_POLICY', [repair1], [], 3000);
    const ownerTime = result.kpiComparisons.find((c) => c.kpi === 'ownerWaitingTimeMs');
    expect(ownerTime?.expectedDirection).toBe('NO_CHANGE');
  });

  it('is a thin wrapper over the real Part 4 simulator — same expectedImprovement value', () => {
    let repair1 = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', now: 1000 });
    repair1 = transitionFactoryTask(transitionFactoryTask(repair1, 'RUNNING', 1500), 'BLOCKED', 2000, 'no sidecar');
    const result = runPolicyExperiment('REPAIR_FIRST_POLICY', [repair1], [], 3000);
    const repairComparison = result.kpiComparisons.find((c) => c.kpi === 'repairRatio');
    expect(repairComparison?.expectedDirection).toBe(result.simulation.expectedImprovement === 'UNKNOWN' ? 'UNKNOWN' : 'IMPROVE');
  });
});
