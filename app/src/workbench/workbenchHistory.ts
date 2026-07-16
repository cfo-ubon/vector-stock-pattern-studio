// Design Workbench Section 6 ("History") — a generic, DOM-free undo/redo +
// named-snapshot store. Generic over `T` so it isn't coupled to
// `DesignSpecification` specifically, even though that's its only caller
// today. Every function is pure (returns a new `HistoryState<T>`, never
// mutates its input) so it composes cleanly with a React `useState`/
// `useReducer` the same way every other reducer-shaped module in this app
// does (see project/projectManager.ts).

import { diffJson, type JsonDiffEntry } from './jsonDiff';

export interface HistorySnapshot<T> {
  id: string;
  label: string;
  createdAt: number;
  value: T;
}

export interface HistoryState<T> {
  past: T[];
  present: T | null;
  future: T[];
  snapshots: HistorySnapshot<T>[];
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createHistory<T>(initial: T | null = null): HistoryState<T> {
  return { past: [], present: initial, future: [], snapshots: [] };
}

/** Pushes a new present value, discarding the redo stack — the standard
 * "made a new edit after undoing" rule (matches every text editor's
 * undo/redo semantics). Snapshots are untouched: they're named bookmarks,
 * not part of the linear undo stack, so they survive edits made after
 * they were taken. A no-op push (identical to the current present) is
 * skipped so undo doesn't have to step through no-change entries. */
export function pushHistory<T>(state: HistoryState<T>, next: T): HistoryState<T> {
  if (state.present !== null && JSON.stringify(state.present) === JSON.stringify(next)) return state;
  return {
    ...state,
    past: state.present === null ? state.past : [...state.past, state.present],
    present: next,
    future: [],
  };
}

export function canUndo<T>(state: HistoryState<T>): boolean {
  return state.past.length > 0;
}

export function canRedo<T>(state: HistoryState<T>): boolean {
  return state.future.length > 0;
}

export function undoHistory<T>(state: HistoryState<T>): HistoryState<T> {
  if (!canUndo(state) || state.present === null) return state;
  const previous = state.past[state.past.length - 1];
  return {
    ...state,
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future],
  };
}

export function redoHistory<T>(state: HistoryState<T>): HistoryState<T> {
  if (!canRedo(state) || state.present === null) return state;
  const next = state.future[0];
  return {
    ...state,
    past: [...state.past, state.present],
    present: next,
    future: state.future.slice(1),
  };
}

/** Bookmarks the current present value under a label — does not itself
 * change `present`/`past`/`future`. */
export function takeSnapshot<T>(state: HistoryState<T>, label: string): HistoryState<T> {
  if (state.present === null) return state;
  const snapshot: HistorySnapshot<T> = { id: newId('snap'), label, createdAt: Date.now(), value: state.present };
  return { ...state, snapshots: [...state.snapshots, snapshot] };
}

export function removeSnapshot<T>(state: HistoryState<T>, snapshotId: string): HistoryState<T> {
  return { ...state, snapshots: state.snapshots.filter((s) => s.id !== snapshotId) };
}

/** Restores a snapshot's value as the new present — implemented as a
 * regular `pushHistory` so restoring is itself undoable, and doesn't
 * mutate/remove the snapshot (it can be restored again later). */
export function restoreSnapshot<T>(state: HistoryState<T>, snapshotId: string): HistoryState<T> {
  const snapshot = state.snapshots.find((s) => s.id === snapshotId);
  if (!snapshot) return state;
  return pushHistory(state, snapshot.value);
}

/** Diffs two snapshots' values (Section 6's "Compare versions"). Order is
 * `from` -> `to` (an `added` entry means `to` has a value `from` didn't). */
export function compareSnapshots<T>(from: HistorySnapshot<T>, to: HistorySnapshot<T>): JsonDiffEntry[] {
  return diffJson(from.value, to.value);
}
