import { describe, it, expect } from 'vitest';
import {
  createFactoryTask,
  transitionFactoryTask,
  reblockFactoryTask,
  canTransitionFactoryTaskStatus,
  InvalidFactoryTaskTransitionError,
  isValidFactoryTask,
  generateFactoryTaskId,
  generateFactoryBatchId,
  isValidFactoryTaskId,
} from './factoryTask';

describe('createFactoryTask', () => {
  it('starts READY when it has no dependencies', () => {
    const task = createFactoryTask({ type: 'qa', reason: 'confirm QA', now: 1000 });
    expect(task.status).toBe('READY');
    expect(task.history).toEqual([{ status: 'READY', at: 1000 }]);
  });

  it('starts WAITING when it has dependencies', () => {
    const task = createFactoryTask({ type: 'qa', reason: 'confirm QA', dependsOnTaskIds: ['FTASK-1'], now: 1000 });
    expect(task.status).toBe('WAITING');
  });

  it('produces a valid, well-formed id', () => {
    const task = createFactoryTask({ type: 'generate', reason: 'batch', now: 1000 });
    expect(isValidFactoryTaskId(task.id)).toBe(true);
  });

  it('defaults estimatedWorkMinutes per task type when not given', () => {
    const qa = createFactoryTask({ type: 'qa', reason: 'x' });
    const generate = createFactoryTask({ type: 'generate', reason: 'x' });
    expect(qa.estimatedWorkMinutes).toBe(0.5);
    expect(generate.estimatedWorkMinutes).toBe(3);
  });
});

describe('factory task state machine', () => {
  it('allows READY -> RUNNING -> COMPLETED', () => {
    let task = createFactoryTask({ type: 'qa', reason: 'x', now: 1000 });
    task = transitionFactoryTask(task, 'RUNNING', 2000);
    expect(task.status).toBe('RUNNING');
    expect(task.startedAt).toBe(2000);
    task = transitionFactoryTask(task, 'COMPLETED', 3000);
    expect(task.status).toBe('COMPLETED');
    expect(task.completedAt).toBe(3000);
    expect(task.history.map((h) => h.status)).toEqual(['READY', 'RUNNING', 'COMPLETED']);
  });

  it('records a blockedReason and does not clobber it with an unrelated note when re-blocking', () => {
    let task = createFactoryTask({ type: 'qa', reason: 'x', now: 1000 });
    task = transitionFactoryTask(task, 'RUNNING', 2000);
    task = transitionFactoryTask(task, 'BLOCKED', 3000, 'No QualitySnapshot exists yet.');
    expect(task.status).toBe('BLOCKED');
    expect(task.blockedReason).toBe('No QualitySnapshot exists yet.');
  });

  it('rejects an invalid transition (COMPLETED is terminal)', () => {
    let task = createFactoryTask({ type: 'qa', reason: 'x', now: 1000 });
    task = transitionFactoryTask(task, 'RUNNING', 2000);
    task = transitionFactoryTask(task, 'COMPLETED', 3000);
    expect(() => transitionFactoryTask(task, 'RUNNING', 4000)).toThrow(InvalidFactoryTaskTransitionError);
  });

  it('canTransitionFactoryTaskStatus matches transitionFactoryTask', () => {
    expect(canTransitionFactoryTaskStatus('READY', 'RUNNING')).toBe(true);
    expect(canTransitionFactoryTaskStatus('COMPLETED', 'RUNNING')).toBe(false);
    expect(canTransitionFactoryTaskStatus('CANCELLED', 'READY')).toBe(false);
  });

  it('reblockFactoryTask updates the reason without adding a duplicate no-op entry', () => {
    let task = createFactoryTask({ type: 'seo', reason: 'x', dependsOnTaskIds: ['FTASK-1'], now: 1000 });
    task = transitionFactoryTask(task, 'BLOCKED', 2000, 'Missing dependency task(s): FTASK-1.');
    const sameReason = reblockFactoryTask(task, 'Missing dependency task(s): FTASK-1.', 2500);
    expect(sameReason).toBe(task);
    const updated = reblockFactoryTask(task, 'Missing dependency task(s): FTASK-2.', 3000);
    expect(updated.blockedReason).toBe('Missing dependency task(s): FTASK-2.');
    expect(updated.history).toHaveLength(3);
  });

  it('reblockFactoryTask throws if the task is not currently BLOCKED', () => {
    const task = createFactoryTask({ type: 'qa', reason: 'x', now: 1000 });
    expect(() => reblockFactoryTask(task, 'reason', 2000)).toThrow(InvalidFactoryTaskTransitionError);
  });
});

describe('isValidFactoryTask', () => {
  it('accepts a real task', () => {
    expect(isValidFactoryTask(createFactoryTask({ type: 'qa', reason: 'x' }))).toBe(true);
  });
  it('rejects malformed values', () => {
    expect(isValidFactoryTask(null)).toBe(false);
    expect(isValidFactoryTask({})).toBe(false);
    expect(isValidFactoryTask({ id: 'x', type: 'qa', status: 'NOT_REAL', dependsOnTaskIds: [], history: [], priority: 1 })).toBe(false);
  });
});

describe('id generators', () => {
  it('generateFactoryTaskId ids pass isValidFactoryTaskId', () => {
    expect(isValidFactoryTaskId(generateFactoryTaskId(1000))).toBe(true);
  });
  it('generateFactoryBatchId ids are distinct across calls', () => {
    const a = generateFactoryBatchId(1000);
    const b = generateFactoryBatchId(1000);
    expect(a).not.toBe(b);
  });
});
