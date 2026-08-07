import { describe, it, expect } from 'vitest';
import { evolutionEntryForBacklogTask, evolutionEntryForExperiment, evolutionEntryForPolicyExperiment, evolutionEntryForReview } from './factoryEvolutionTimeline';
import { createImprovementBacklogTask, setImprovementBacklogStatus } from './improvementBacklog';
import type { ImprovementCandidate } from './improvementEngine';
import { startFactoryExperiment, concludeFactoryExperiment } from './factoryExperiment';
import { runPolicyExperiment } from './policyExperiment';
import { generateImprovementReview } from './improvementReview';

const candidate: ImprovementCandidate = {
  category: 'REPAIR',
  stage: 'repair',
  title: 'Reduce Repair Time',
  reason: 'x',
  evidence: ['3 BLOCKED repair task(s)'],
  sourceTaskIds: ['T-1'],
  businessImpact: 'HIGH',
  isReadyWork: false,
};

describe('evolutionEntryForBacklogTask', () => {
  it('refIds the real backlog task and distinguishes created vs status-changed', () => {
    const task = createImprovementBacklogTask(candidate, null, 1000);
    const createdEntry = evolutionEntryForBacklogTask(task);
    expect(createdEntry.type).toBe('BACKLOG_TASK_CREATED');
    expect(createdEntry.refId).toBe(task.id);

    const done = setImprovementBacklogStatus(task, 'DONE', 2000);
    const changedEntry = evolutionEntryForBacklogTask(done);
    expect(changedEntry.type).toBe('BACKLOG_TASK_STATUS_CHANGED');
  });
});

describe('evolutionEntryForExperiment', () => {
  it('returns null for a still-RUNNING experiment', () => {
    const experiment = startFactoryExperiment('REPAIR_FIRST', 'B-1', [], [], 1000);
    expect(evolutionEntryForExperiment(experiment)).toBeNull();
  });

  it('refIds the real experiment once CONCLUDED', () => {
    const experiment = startFactoryExperiment('REPAIR_FIRST', 'B-1', [], [], 1000);
    const concluded = concludeFactoryExperiment(experiment, [], [], 2000);
    expect(concluded).toBeNull(); // no tasks in batch B-1 -> nothing to conclude
  });
});

describe('evolutionEntryForPolicyExperiment', () => {
  it('refIds the real policy experiment and never claims activation', () => {
    const policyExperiment = runPolicyExperiment('REPAIR_FIRST_POLICY', [], [], 1000);
    const entry = evolutionEntryForPolicyExperiment(policyExperiment);
    expect(entry.refId).toBe(policyExperiment.id);
    expect(entry.summary).toContain('not activated');
  });
});

describe('evolutionEntryForReview', () => {
  it('refIds the real generated review', () => {
    const review = generateImprovementReview('DAILY', 0, 1000, [], [], 1000);
    const entry = evolutionEntryForReview(review);
    expect(entry.refId).toBe(review.id);
    expect(entry.type).toBe('REVIEW_GENERATED');
  });
});
