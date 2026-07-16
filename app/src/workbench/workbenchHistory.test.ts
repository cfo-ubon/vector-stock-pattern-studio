import { describe, it, expect } from 'vitest';
import {
  createHistory,
  pushHistory,
  undoHistory,
  redoHistory,
  canUndo,
  canRedo,
  takeSnapshot,
  removeSnapshot,
  restoreSnapshot,
  compareSnapshots,
} from './workbenchHistory';

describe('workbenchHistory: push/undo/redo', () => {
  it('starts empty with no present value', () => {
    const state = createHistory<number>();
    expect(state.present).toBeNull();
    expect(canUndo(state)).toBe(false);
    expect(canRedo(state)).toBe(false);
  });

  it('pushHistory sets present and enables undo', () => {
    let state = createHistory<number>();
    state = pushHistory(state, 1);
    expect(state.present).toBe(1);
    expect(canUndo(state)).toBe(false); // first push has nothing to undo to
    state = pushHistory(state, 2);
    expect(state.present).toBe(2);
    expect(canUndo(state)).toBe(true);
  });

  it('undo/redo moves through the stack correctly', () => {
    let state = createHistory<number>();
    state = pushHistory(state, 1);
    state = pushHistory(state, 2);
    state = pushHistory(state, 3);

    state = undoHistory(state);
    expect(state.present).toBe(2);
    state = undoHistory(state);
    expect(state.present).toBe(1);
    expect(canUndo(state)).toBe(false);

    state = redoHistory(state);
    expect(state.present).toBe(2);
    state = redoHistory(state);
    expect(state.present).toBe(3);
    expect(canRedo(state)).toBe(false);
  });

  it('undo/redo are no-ops at the boundaries', () => {
    let state = createHistory<number>();
    state = pushHistory(state, 1);
    const undone = undoHistory(state);
    expect(undone).toBe(state); // no-op returns same reference

    state = pushHistory(state, 2);
    state = undoHistory(state);
    const redone = redoHistory(state);
    state = redoHistory(state); // redo to the end
    const redoneAgain = redoHistory(state);
    expect(redoneAgain).toBe(state);
    void redone;
  });

  it('pushing a new value after undo discards the redo stack', () => {
    let state = createHistory<number>();
    state = pushHistory(state, 1);
    state = pushHistory(state, 2);
    state = undoHistory(state);
    expect(canRedo(state)).toBe(true);
    state = pushHistory(state, 99);
    expect(canRedo(state)).toBe(false);
    expect(state.present).toBe(99);
  });

  it('pushing an identical value is a no-op (skips redundant history entries)', () => {
    let state = createHistory<{ a: number }>();
    state = pushHistory(state, { a: 1 });
    const before = state;
    state = pushHistory(state, { a: 1 });
    expect(state).toBe(before);
  });
});

describe('workbenchHistory: snapshots', () => {
  it('takeSnapshot bookmarks the current present without changing it', () => {
    let state = createHistory<number>();
    state = pushHistory(state, 1);
    state = takeSnapshot(state, 'v1');
    expect(state.present).toBe(1);
    expect(state.snapshots).toHaveLength(1);
    expect(state.snapshots[0].label).toBe('v1');
    expect(state.snapshots[0].value).toBe(1);
  });

  it('removeSnapshot removes only the targeted snapshot', () => {
    let state = createHistory<number>();
    state = pushHistory(state, 1);
    state = takeSnapshot(state, 'v1');
    state = takeSnapshot(state, 'v2');
    const idToRemove = state.snapshots[0].id;
    state = removeSnapshot(state, idToRemove);
    expect(state.snapshots).toHaveLength(1);
    expect(state.snapshots[0].label).toBe('v2');
  });

  it('restoreSnapshot pushes the snapshot value as a new (undoable) present', () => {
    let state = createHistory<number>();
    state = pushHistory(state, 1);
    state = takeSnapshot(state, 'v1');
    state = pushHistory(state, 2);
    state = pushHistory(state, 3);

    const snapshotId = state.snapshots[0].id;
    state = restoreSnapshot(state, snapshotId);
    expect(state.present).toBe(1);
    expect(canUndo(state)).toBe(true);

    // restoring is itself undoable, back to 3
    state = undoHistory(state);
    expect(state.present).toBe(3);
  });

  it('restoreSnapshot with an unknown id is a no-op', () => {
    let state = createHistory<number>();
    state = pushHistory(state, 1);
    const before = state;
    state = restoreSnapshot(state, 'not-real');
    expect(state).toBe(before);
  });

  it('compareSnapshots diffs two snapshots\' values', () => {
    let state = createHistory<{ a: number; b: number }>();
    state = pushHistory(state, { a: 1, b: 1 });
    state = takeSnapshot(state, 'v1');
    state = pushHistory(state, { a: 1, b: 2 });
    state = takeSnapshot(state, 'v2');

    const diff = compareSnapshots(state.snapshots[0], state.snapshots[1]);
    expect(diff).toEqual([{ path: '$.b', kind: 'changed', before: 1, after: 2 }]);
  });
});
