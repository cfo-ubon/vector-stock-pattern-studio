import { describe, it, expect, beforeEach } from 'vitest';
import { createAutonomousDesignRun, transitionAutonomousDesignRun } from '../domain/autonomousDesignRun';
import {
  loadAutonomousDesignRuns,
  getAutonomousDesignRun,
  putAutonomousDesignRun,
  deleteAutonomousDesignRun,
  clearAutonomousDesignRuns,
  loadResumableAutonomousDesignRuns,
} from './autonomousDesignRunStore';

beforeEach(async () => {
  await clearAutonomousDesignRuns();
});

describe('autonomousDesignRunStore', () => {
  it('persists and retrieves a run', async () => {
    const run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 10, now: 1000 });
    await putAutonomousDesignRun(run);
    expect(await getAutonomousDesignRun(run.id)).toEqual(run);
  });

  it('deletes a run', async () => {
    const run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 10, now: 1000 });
    await putAutonomousDesignRun(run);
    await deleteAutonomousDesignRun(run.id);
    expect(await getAutonomousDesignRun(run.id)).toBeUndefined();
  });

  it('loads all runs, newest first', async () => {
    const a = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 5, now: 1 });
    const b = createAutonomousDesignRun({ mode: 'GUIDED_AUTOPILOT', requestedCount: 5, now: 2 });
    await putAutonomousDesignRun(a);
    await putAutonomousDesignRun(b);
    const all = await loadAutonomousDesignRuns();
    expect(all.map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it('loadResumableAutonomousDesignRuns returns only GENERATING/PAUSED runs', async () => {
    let generating = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 5, now: 1 });
    generating = transitionAutonomousDesignRun(generating, 'PLAN_READY', 2);
    generating = transitionAutonomousDesignRun(generating, 'GENERATING', 3);

    let completed = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 5, now: 1 });
    completed = transitionAutonomousDesignRun(completed, 'PLAN_READY', 2);
    completed = transitionAutonomousDesignRun(completed, 'GENERATING', 3);
    completed = transitionAutonomousDesignRun(completed, 'COMPLETED', 4);

    const draft = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 5, now: 1 });

    await putAutonomousDesignRun(generating);
    await putAutonomousDesignRun(completed);
    await putAutonomousDesignRun(draft);

    const resumable = await loadResumableAutonomousDesignRuns();
    expect(resumable.map((r) => r.id).sort()).toEqual([generating.id].sort());
  });
});
