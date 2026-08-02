import { describe, it, expect } from 'vitest';
import { runPreflightValidation } from './preflightValidation';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';
import type { FactoryTask } from '../factory/domain/types';

const NOW = 1_700_000_000_000;

function readyTask(overrides: Partial<Parameters<typeof createFactoryTask>[0]> = {}): FactoryTask {
  return createFactoryTask({ type: 'seo', reason: 'x', assetId: 'A-1', now: NOW, ...overrides });
}

describe('runPreflightValidation', () => {
  it('never generates against Decision OS — reuses the real evaluateGenerationGate result', () => {
    const result = runPreflightValidation([], [], [], [], NOW);
    expect(result.shouldGenerate).toBe(true);
    expect(result.generateBlockedReason).toBeNull();
    expect(result.decisionTrace.domain).toBe('factory');
  });

  it('reports OK for READY backlog checks with a small READY count', () => {
    const tasks = [readyTask()];
    const result = runPreflightValidation(tasks, [], [], [], NOW);
    const backlogCheck = result.checks.find((c) => c.name === 'READY backlog');
    expect(backlogCheck?.status).toBe('OK');
    expect(backlogCheck?.count).toBe(1);
  });

  it('reports ATTENTION once a READY backlog check crosses its threshold', () => {
    const tasks = Array.from({ length: 12 }, (_, i) => readyTask({ assetId: `A-${i}` }));
    const result = runPreflightValidation(tasks, [], [], [], NOW);
    const backlogCheck = result.checks.find((c) => c.name === 'READY backlog');
    expect(backlogCheck?.status).toBe('ATTENTION');
  });

  it('reports BLOCKED for a check with a real BLOCKED task, regardless of the READY count', () => {
    let repair = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', now: NOW });
    repair = transitionFactoryTask(transitionFactoryTask(repair, 'RUNNING', NOW + 100), 'BLOCKED', NOW + 200, 'no sidecar');
    const result = runPreflightValidation([repair], [], [], [], NOW + 300);
    const repairCheck = result.checks.find((c) => c.name === 'Outstanding Repair');
    expect(repairCheck?.status).toBe('BLOCKED');
  });

  it('produces exactly the 6 named checks every time', () => {
    const result = runPreflightValidation([], [], [], [], NOW);
    expect(result.checks.map((c) => c.name)).toEqual(['READY backlog', 'Unfinished Collections', 'Outstanding Repair', 'Outstanding SEO', 'Outstanding Packaging', 'Export Queue']);
  });
});
