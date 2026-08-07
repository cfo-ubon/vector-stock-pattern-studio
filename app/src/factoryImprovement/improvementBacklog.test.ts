import { describe, it, expect } from 'vitest';
import { createImprovementBacklogTask, createImprovementBacklogTasks, rankImprovementBacklog, setImprovementBacklogStatus } from './improvementBacklog';
import type { ImprovementCandidate } from './improvementEngine';

function candidate(overrides: Partial<ImprovementCandidate>): ImprovementCandidate {
  return {
    category: 'REPAIR',
    stage: 'repair',
    title: 'Reduce Repair Time',
    reason: 'real reason',
    evidence: ['3 BLOCKED repair task(s)'],
    sourceTaskIds: ['T-1', 'T-2', 'T-3'],
    businessImpact: 'HIGH',
    isReadyWork: false,
    ...overrides,
  };
}

describe('createImprovementBacklogTask', () => {
  it('assigns OWNER_REVIEW for a diagnosis candidate and FACTORY_AUTOMATION for ready work', () => {
    const diagnosis = createImprovementBacklogTask(candidate({}), null, 1000);
    expect(diagnosis.recommendedOwner).toBe('OWNER_REVIEW');

    const readyWork = createImprovementBacklogTask(candidate({ isReadyWork: true, businessImpact: 'MEDIUM' }), null, 1000);
    expect(readyWork.recommendedOwner).toBe('FACTORY_AUTOMATION');
  });

  it('returns UNKNOWN risk/owner when there is no real evidence', () => {
    const task = createImprovementBacklogTask(candidate({ evidence: [], businessImpact: null }), null, 1000);
    expect(task.estimatedRisk).toBe('UNKNOWN');
    expect(task.recommendedOwner).toBe('UNKNOWN');
    expect(task.estimatedBenefit).toBe('UNKNOWN');
  });

  it('never assigns a category outside the 8 named values', () => {
    const task = createImprovementBacklogTask(candidate({}), null, 1000);
    expect(['REPAIR', 'QUEUE', 'SEO', 'PACKAGING', 'COLLECTION', 'EXPORT', 'COMMERCIAL', 'PORTFOLIO']).toContain(task.category);
  });

  it('starts every new task as OPEN', () => {
    const task = createImprovementBacklogTask(candidate({}), null, 1000);
    expect(task.status).toBe('OPEN');
  });
});

describe('createImprovementBacklogTasks', () => {
  it('maps every candidate to a backlog task', () => {
    const tasks = createImprovementBacklogTasks([candidate({ category: 'REPAIR' }), candidate({ category: 'SEO', title: 'Finish SEO' })], 'B-1', 1000);
    expect(tasks).toHaveLength(2);
    expect(tasks.every((t) => t.sourceBatchId === 'B-1')).toBe(true);
  });
});

describe('rankImprovementBacklog', () => {
  it('sorts highest priority first among OPEN tasks and excludes non-OPEN ones', () => {
    const high = createImprovementBacklogTask(candidate({ businessImpact: 'HIGH', evidence: Array.from({ length: 8 }, (_, i) => `fact ${i}`) }), null, 1000);
    const low = setImprovementBacklogStatus(createImprovementBacklogTask(candidate({ businessImpact: 'LOW', evidence: ['one fact'] }), null, 1000), 'DONE', 1100);
    const medium = createImprovementBacklogTask(candidate({ businessImpact: 'MEDIUM', evidence: ['fact'] }), null, 1000);

    const ranked = rankImprovementBacklog([medium, high, low]);
    expect(ranked.every((t) => t.status === 'OPEN')).toBe(true);
    expect(ranked.length).toBe(2);
    expect(ranked[0].priority).toBeGreaterThanOrEqual(ranked[1].priority);
  });

  it('breaks priority ties oldest-first', () => {
    const a = createImprovementBacklogTask(candidate({}), null, 1000);
    const b = createImprovementBacklogTask(candidate({}), null, 2000);
    const ranked = rankImprovementBacklog([b, a]);
    if (ranked[0].priority === ranked[1].priority) {
      expect(ranked[0].createdAt).toBeLessThanOrEqual(ranked[1].createdAt);
    }
  });
});

describe('setImprovementBacklogStatus', () => {
  it('updates status and updatedAt without mutating the original', () => {
    const task = createImprovementBacklogTask(candidate({}), null, 1000);
    const done = setImprovementBacklogStatus(task, 'DONE', 2000);
    expect(task.status).toBe('OPEN');
    expect(done.status).toBe('DONE');
    expect(done.updatedAt).toBe(2000);
  });
});
