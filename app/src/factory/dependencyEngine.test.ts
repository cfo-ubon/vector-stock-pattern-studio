import { describe, it, expect } from 'vitest';
import { resolveTaskDependencies, explainBlockedTasks } from './dependencyEngine';
import { createFactoryTask, transitionFactoryTask } from './domain/factoryTask';

describe('resolveTaskDependencies', () => {
  it('promotes a WAITING task with no dependencies to READY', () => {
    const task = { ...createFactoryTask({ type: 'qa', reason: 'x', dependsOnTaskIds: ['GONE'], now: 1000 }), dependsOnTaskIds: [] };
    // Force a WAITING task with an empty dependsOnTaskIds to exercise that branch directly.
    const forced = { ...task, status: 'WAITING' as const };
    const { tasks, changedTaskIds } = resolveTaskDependencies([forced], 2000);
    expect(tasks[0].status).toBe('READY');
    expect(changedTaskIds).toEqual([forced.id]);
  });

  it('blocks a task whose dependency id does not exist in the queue, naming the missing id', () => {
    const task = createFactoryTask({ type: 'qa', reason: 'x', dependsOnTaskIds: ['FTASK-MISSING'], now: 1000 });
    const { tasks } = resolveTaskDependencies([task], 2000);
    expect(tasks[0].status).toBe('BLOCKED');
    expect(tasks[0].blockedReason).toContain('FTASK-MISSING');
  });

  it('keeps a task WAITING while its dependency is still in progress', () => {
    const generate = createFactoryTask({ type: 'generate', reason: 'batch', now: 1000 });
    const qa = createFactoryTask({ type: 'qa', reason: 'x', dependsOnTaskIds: [generate.id], now: 1000 });
    const { tasks } = resolveTaskDependencies([generate, qa], 2000);
    const resolvedQa = tasks.find((t) => t.id === qa.id)!;
    expect(resolvedQa.status).toBe('WAITING');
  });

  it('promotes a task to READY once every dependency is COMPLETED', () => {
    let generate = createFactoryTask({ type: 'generate', reason: 'batch', now: 1000 });
    generate = transitionFactoryTask(generate, 'RUNNING', 1500);
    generate = transitionFactoryTask(generate, 'COMPLETED', 2000);
    const qa = createFactoryTask({ type: 'qa', reason: 'x', dependsOnTaskIds: [generate.id], now: 1000 });
    const { tasks, changedTaskIds } = resolveTaskDependencies([generate, qa], 2500);
    const resolvedQa = tasks.find((t) => t.id === qa.id)!;
    expect(resolvedQa.status).toBe('READY');
    expect(changedTaskIds).toContain(qa.id);
  });

  it('blocks a task whose dependency was CANCELLED, naming that dependency', () => {
    let generate = createFactoryTask({ type: 'generate', reason: 'batch', now: 1000 });
    generate = transitionFactoryTask(generate, 'CANCELLED', 1500);
    const qa = createFactoryTask({ type: 'qa', reason: 'x', dependsOnTaskIds: [generate.id], now: 1000 });
    const { tasks } = resolveTaskDependencies([generate, qa], 2000);
    const resolvedQa = tasks.find((t) => t.id === qa.id)!;
    expect(resolvedQa.status).toBe('BLOCKED');
    expect(resolvedQa.blockedReason).toContain(generate.id);
    expect(resolvedQa.blockedReason).toContain('cancelled');
  });

  it('moves a BLOCKED task back to WAITING once its missing dependency exists but is not finished', () => {
    const qa = createFactoryTask({ type: 'qa', reason: 'x', dependsOnTaskIds: ['FTASK-LATER'], now: 1000 });
    const blocked = transitionFactoryTask(qa, 'BLOCKED', 1500, 'Missing dependency task(s): FTASK-LATER.');
    const later = { ...createFactoryTask({ type: 'generate', reason: 'batch', now: 1000 }), id: 'FTASK-LATER' };
    const { tasks } = resolveTaskDependencies([blocked, later], 2000);
    const resolved = tasks.find((t) => t.id === qa.id)!;
    expect(resolved.status).toBe('WAITING');
  });

  it('never touches a RUNNING or terminal task', () => {
    let running = createFactoryTask({ type: 'qa', reason: 'x', now: 1000 });
    running = transitionFactoryTask(running, 'RUNNING', 1500);
    const { tasks, changedTaskIds } = resolveTaskDependencies([running], 2000);
    expect(tasks[0]).toBe(running);
    expect(changedTaskIds).toEqual([]);
  });
});

describe('explainBlockedTasks', () => {
  it('returns only BLOCKED tasks with their reason', () => {
    const ready = createFactoryTask({ type: 'qa', reason: 'x', now: 1000 });
    const blocked = transitionFactoryTask(createFactoryTask({ type: 'seo', reason: 'y', now: 1000 }), 'RUNNING', 1200);
    const reallyBlocked = transitionFactoryTask(blocked, 'BLOCKED', 1500, 'No SEO metadata sidecar found.');
    const result = explainBlockedTasks([ready, reallyBlocked]);
    expect(result).toEqual([{ taskId: reallyBlocked.id, type: 'seo', reason: 'No SEO metadata sidecar found.' }]);
  });
});
