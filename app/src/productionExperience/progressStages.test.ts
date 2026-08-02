import { describe, it, expect } from 'vitest';
import { deriveProductionProgress } from './progressStages';
import { createOrchestrationRun, transitionOrchestrationRun, attachOrchestrationRunBatch } from '../factoryOrchestrator/orchestrationRun';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';

const NOW = 1_700_000_000_000;

describe('deriveProductionProgress', () => {
  it('marks PREPARING current and everything after pending for a fresh run', () => {
    const run = createOrchestrationRun(NOW);
    const progress = deriveProductionProgress(run, []);
    expect(progress.steps.map((s) => s.state)).toEqual(['CURRENT', 'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING']);
    expect(progress.haltedStatus).toBeNull();
  });

  it('marks WAITING_APPROVAL current with PREPARING/PLANNING done', () => {
    let run = createOrchestrationRun(NOW);
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 1);
    run = transitionOrchestrationRun(run, 'PREFLIGHT', NOW + 2);
    run = transitionOrchestrationRun(run, 'PLANNING', NOW + 3);
    run = transitionOrchestrationRun(run, 'WAITING_OWNER_APPROVAL', NOW + 4);
    const progress = deriveProductionProgress(run, []);
    const byStage = Object.fromEntries(progress.steps.map((s) => [s.stage, s.state]));
    expect(byStage.PREPARING).toBe('DONE');
    expect(byStage.PLANNING).toBe('DONE');
    expect(byStage.WAITING_APPROVAL).toBe('CURRENT');
    expect(byStage.RUNNING).toBe('PENDING');
  });

  it('derives a real QA sub-stage when the batch has active qa/repair tasks', () => {
    let run = createOrchestrationRun(NOW);
    run = attachOrchestrationRunBatch(run, 'B1', NOW);
    run = { ...run, status: 'RUNNING' };
    const qaTask = createFactoryTask({ type: 'qa', reason: 'x', batchId: 'B1', now: NOW });
    const tasks = [qaTask];
    const progress = deriveProductionProgress(run, tasks);
    const byStage = Object.fromEntries(progress.steps.map((s) => [s.stage, s.state]));
    expect(byStage.QA).toBe('CURRENT');
    expect(byStage.PACKAGING).toBe('PENDING');
  });

  it('derives a real PACKAGING sub-stage when only packaging-stage tasks are active', () => {
    let run = createOrchestrationRun(NOW);
    run = attachOrchestrationRunBatch(run, 'B1', NOW);
    run = { ...run, status: 'RUNNING' };
    let qaTask = createFactoryTask({ type: 'qa', reason: 'x', batchId: 'B1', now: NOW });
    qaTask = transitionFactoryTask(transitionFactoryTask(qaTask, 'RUNNING', NOW + 1), 'COMPLETED', NOW + 2);
    const pkgTask = createFactoryTask({ type: 'package', reason: 'x', batchId: 'B1', now: NOW });
    const progress = deriveProductionProgress(run, [qaTask, pkgTask]);
    const byStage = Object.fromEntries(progress.steps.map((s) => [s.stage, s.state]));
    expect(byStage.QA).toBe('DONE');
    expect(byStage.PACKAGING).toBe('CURRENT');
  });

  it('marks COMPLETED current with every earlier stage done', () => {
    let run = createOrchestrationRun(NOW);
    run = { ...run, status: 'COMPLETED' };
    const progress = deriveProductionProgress(run, []);
    expect(progress.steps.every((s) => s.stage === 'COMPLETED' || s.state === 'DONE')).toBe(true);
    expect(progress.steps.find((s) => s.stage === 'COMPLETED')?.state).toBe('CURRENT');
  });

  it('freezes at the real last-known stage and reports a real reason when BLOCKED', () => {
    let run = createOrchestrationRun(NOW);
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 1);
    run = transitionOrchestrationRun(run, 'PREFLIGHT', NOW + 2);
    run = transitionOrchestrationRun(run, 'BLOCKED', NOW + 3, 'Export queue stuck.');
    const progress = deriveProductionProgress(run, []);
    expect(progress.haltedStatus).toBe('BLOCKED');
    expect(progress.haltedReason).toBe('Export queue stuck.');
    const byStage = Object.fromEntries(progress.steps.map((s) => [s.stage, s.state]));
    expect(byStage.PREPARING).toBe('DONE');
    expect(byStage.PLANNING).toBe('CURRENT');
  });

  it('never fakes progress for a PAUSED run — freezes at the real prior stage honestly', () => {
    const run = { ...createOrchestrationRun(NOW), status: 'PAUSED' as const, history: [{ status: 'IDLE' as const, at: NOW }, { status: 'RUNNING' as const, at: NOW + 1 }, { status: 'PAUSED' as const, at: NOW + 2, note: 'Owner paused.' }] };
    const progress = deriveProductionProgress(run, []);
    expect(progress.haltedStatus).toBe('PAUSED');
    const byStage = Object.fromEntries(progress.steps.map((s) => [s.stage, s.state]));
    expect(byStage.RUNNING).toBe('CURRENT');
  });
});
