import { describe, it, expect } from 'vitest';
import { evaluateFactoryPriorityBoosts, applyPriorityBoosts, type FactoryPriorityInputs } from './priorityEngine';
import { createFactoryTask, transitionFactoryTask } from './domain/factoryTask';

const NO_SIGNALS: FactoryPriorityInputs = {
  reviewCount: 0,
  rejectCount: 0,
  totalEvaluated: 10,
  readyBacklogCount: 0,
  exportBlockedCount: 0,
  collectionsNearCompletion: [],
};

describe('evaluateFactoryPriorityBoosts', () => {
  it('produces no boosts when every signal is below threshold', () => {
    expect(evaluateFactoryPriorityBoosts(NO_SIGNALS, 1000)).toEqual([]);
  });

  it('boosts repair on a high REVIEW/REJECT rate, stamping a real Decision ID', () => {
    const boosts = evaluateFactoryPriorityBoosts({ ...NO_SIGNALS, reviewCount: 3, rejectCount: 2, totalEvaluated: 10 }, 1000);
    const repairBoost = boosts.find((b) => b.taskType === 'repair');
    expect(repairBoost).toBeDefined();
    expect(repairBoost!.decisionId).toMatch(/^DEC-/);
  });

  it('boosts packaging on a large READY backlog', () => {
    const boosts = evaluateFactoryPriorityBoosts({ ...NO_SIGNALS, readyBacklogCount: 15 }, 1000);
    expect(boosts.some((b) => b.taskType === 'package')).toBe(true);
  });

  it('boosts export validation when a package is export-blocked', () => {
    const boosts = evaluateFactoryPriorityBoosts({ ...NO_SIGNALS, exportBlockedCount: 2 }, 1000);
    expect(boosts.some((b) => b.taskType === 'exportValidation')).toBe(true);
  });

  it('boosts collection completion only when missing roles are within the near-complete threshold', () => {
    const near = evaluateFactoryPriorityBoosts({ ...NO_SIGNALS, collectionsNearCompletion: [{ collectionId: 'C1', missingRoles: ['colorway'] }] }, 1000);
    expect(near.some((b) => b.taskType === 'collectionCompletion')).toBe(true);

    const far = evaluateFactoryPriorityBoosts({ ...NO_SIGNALS, collectionsNearCompletion: [{ collectionId: 'C2', missingRoles: ['colorway', 'hero', 'toss'] }] }, 1000);
    expect(far.some((b) => b.taskType === 'collectionCompletion')).toBe(false);
  });

  it('produces an independent boost for every simultaneously-true signal (no signal silently dropped)', () => {
    const boosts = evaluateFactoryPriorityBoosts(
      { reviewCount: 4, rejectCount: 4, totalEvaluated: 10, readyBacklogCount: 20, exportBlockedCount: 1, collectionsNearCompletion: [{ collectionId: 'C1', missingRoles: [] }] },
      1000,
    );
    const types = boosts.map((b) => b.taskType).sort();
    expect(types).toEqual(['exportValidation', 'package', 'repair'].sort());
  });
});

describe('applyPriorityBoosts', () => {
  it('lowers the priority number (runs sooner) of a boosted, non-terminal task and stamps its Decision ID', () => {
    const task = createFactoryTask({ type: 'repair', reason: 'x', priority: 100, now: 1000 });
    const boosts = evaluateFactoryPriorityBoosts({ ...NO_SIGNALS, reviewCount: 5, rejectCount: 5, totalEvaluated: 10 }, 1000);
    const [boosted] = applyPriorityBoosts([task], boosts, 2000);
    expect(boosted.priority).toBeLessThan(task.basePriority);
    expect(boosted.sourceDecisionId).toBe(boosts[0].decisionId);
  });

  it('never boosts a RUNNING or terminal task', () => {
    let running = createFactoryTask({ type: 'repair', reason: 'x', priority: 100, now: 1000 });
    running = transitionFactoryTask(running, 'RUNNING', 1500);
    const boosts = evaluateFactoryPriorityBoosts({ ...NO_SIGNALS, reviewCount: 5, rejectCount: 5, totalEvaluated: 10 }, 1000);
    const [result] = applyPriorityBoosts([running], boosts, 2000);
    expect(result).toBe(running);
  });

  it('reverts a previously-boosted task back to basePriority once its own signal is gone (while another signal is still active)', () => {
    const task = createFactoryTask({ type: 'repair', reason: 'x', priority: 100, now: 1000 });
    const boosted = { ...task, priority: 50, sourceDecisionId: 'DEC-OLD' };
    const unrelatedBoosts = evaluateFactoryPriorityBoosts({ ...NO_SIGNALS, readyBacklogCount: 20 }, 3000);
    const [reverted] = applyPriorityBoosts([boosted], unrelatedBoosts, 3000);
    expect(reverted.priority).toBe(boosted.basePriority);
  });

  it('leaves every task untouched when there are no boosts to apply (an empty boost list is a no-op, not a mass revert)', () => {
    const task = createFactoryTask({ type: 'repair', reason: 'x', priority: 100, now: 1000 });
    const boosted = { ...task, priority: 50, sourceDecisionId: 'DEC-OLD' };
    const [result] = applyPriorityBoosts([boosted], [], 3000);
    expect(result).toBe(boosted);
  });
});
