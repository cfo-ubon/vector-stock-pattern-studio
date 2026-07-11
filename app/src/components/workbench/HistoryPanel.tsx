import { useState } from 'react';
import type { HistorySnapshot, HistoryState } from '../../workbench/workbenchHistory';
import { compareSnapshots } from '../../workbench/workbenchHistory';

// Design Workbench Section 6 ("History") — Undo/Redo/Snapshot/Compare/
// Restore, all backed by `workbench/workbenchHistory.ts`'s pure reducer
// (this component only renders it and forwards clicks). Generic over `T`
// like `workbenchHistory.ts` itself — nothing here reads a
// DesignSpecification-specific field, only `.label`/`.createdAt`/`.value`/
// `.id`, so there's no reason to hard-couple this component to that one
// caller's value type.

interface Props<T> {
  history: HistoryState<T>;
  onUndo: () => void;
  onRedo: () => void;
  onSnapshot: (label: string) => void;
  onRestore: (snapshotId: string) => void;
  onRemoveSnapshot: (snapshotId: string) => void;
}

export function HistoryPanel<T>({ history, onUndo, onRedo, onSnapshot, onRestore, onRemoveSnapshot }: Props<T>) {
  const [label, setLabel] = useState('');
  const [compareA, setCompareA] = useState<string>('');
  const [compareB, setCompareB] = useState<string>('');

  const snapshotA = history.snapshots.find((s) => s.id === compareA);
  const snapshotB = history.snapshots.find((s) => s.id === compareB);
  const diff = snapshotA && snapshotB ? compareSnapshots(snapshotA, snapshotB) : null;

  return (
    <div className="workbench-history-panel">
      <div className="workbench-history-toolbar">
        <button type="button" className="btn" onClick={onUndo} disabled={history.past.length === 0}>
          ↶ Undo
        </button>
        <button type="button" className="btn" onClick={onRedo} disabled={history.future.length === 0}>
          ↷ Redo
        </button>
        <span className="metadata-hint">
          {history.past.length} back · {history.future.length} forward
        </span>
      </div>

      <div className="workbench-snapshot-form">
        <input type="text" placeholder="Snapshot label…" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Snapshot label" />
        <button
          type="button"
          className="btn btn--primary"
          disabled={!label.trim()}
          onClick={() => {
            onSnapshot(label.trim());
            setLabel('');
          }}
        >
          📌 Take Snapshot
        </button>
      </div>

      <ul className="workbench-snapshot-list">
        {history.snapshots.length === 0 && <li className="metadata-hint">No snapshots yet.</li>}
        {history.snapshots.map((snapshot: HistorySnapshot<T>) => (
          <li key={snapshot.id} className="workbench-snapshot-item">
            <span>
              <strong>{snapshot.label}</strong> <span className="metadata-hint">{new Date(snapshot.createdAt).toLocaleString()}</span>
            </span>
            <span className="workbench-snapshot-actions">
              <button type="button" className="btn" onClick={() => onRestore(snapshot.id)}>
                ⏮ Restore
              </button>
              <button type="button" className="btn" onClick={() => onRemoveSnapshot(snapshot.id)}>
                🗑
              </button>
            </span>
          </li>
        ))}
      </ul>

      {history.snapshots.length >= 2 && (
        <div className="workbench-compare">
          <h4>Compare versions</h4>
          <div className="workbench-compare-selectors">
            <select value={compareA} onChange={(e) => setCompareA(e.target.value)} aria-label="Compare: from">
              <option value="">— from —</option>
              {history.snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <span>→</span>
            <select value={compareB} onChange={(e) => setCompareB(e.target.value)} aria-label="Compare: to">
              <option value="">— to —</option>
              {history.snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {diff && (
            <ul className="workbench-diff-list">
              {diff.length === 0 && <li className="metadata-hint">No differences.</li>}
              {diff.map((entry, i) => (
                <li key={i} className={`workbench-diff-entry workbench-diff-entry--${entry.kind}`}>
                  <code>{entry.path}</code>
                  {entry.kind === 'changed' && (
                    <>
                      {' '}
                      <span className="workbench-diff-before">{JSON.stringify(entry.before)}</span> → <span className="workbench-diff-after">{JSON.stringify(entry.after)}</span>
                    </>
                  )}
                  {entry.kind === 'added' && <> added {JSON.stringify(entry.after)}</>}
                  {entry.kind === 'removed' && <> removed {JSON.stringify(entry.before)}</>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
