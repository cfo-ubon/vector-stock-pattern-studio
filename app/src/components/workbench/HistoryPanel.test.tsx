import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createHistory, pushHistory, takeSnapshot } from '../../workbench/workbenchHistory';
import { HistoryPanel } from './HistoryPanel';

describe('HistoryPanel', () => {
  it('disables Undo/Redo when there is nothing to undo/redo', () => {
    const history = pushHistory(createHistory<number>(), 1);
    render(<HistoryPanel history={history} onUndo={vi.fn()} onRedo={vi.fn()} onSnapshot={vi.fn()} onRestore={vi.fn()} onRemoveSnapshot={vi.fn()} />);
    expect(screen.getByRole('button', { name: '↶ Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '↷ Redo' })).toBeDisabled();
  });

  it('enables Undo after two pushes and calls onUndo when clicked', () => {
    let history = pushHistory(createHistory<number>(), 1);
    history = pushHistory(history, 2);
    const onUndo = vi.fn();
    render(<HistoryPanel history={history} onUndo={onUndo} onRedo={vi.fn()} onSnapshot={vi.fn()} onRestore={vi.fn()} onRemoveSnapshot={vi.fn()} />);
    const undoButton = screen.getByRole('button', { name: '↶ Undo' });
    expect(undoButton).not.toBeDisabled();
    fireEvent.click(undoButton);
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('the snapshot form only enables "Take Snapshot" once a label is typed, and calls onSnapshot with it', () => {
    const history = pushHistory(createHistory<number>(), 1);
    const onSnapshot = vi.fn();
    render(<HistoryPanel history={history} onUndo={vi.fn()} onRedo={vi.fn()} onSnapshot={onSnapshot} onRestore={vi.fn()} onRemoveSnapshot={vi.fn()} />);
    const button = screen.getByRole('button', { name: '📌 Take Snapshot' });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Snapshot label'), { target: { value: 'v1' } });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onSnapshot).toHaveBeenCalledWith('v1');
  });

  it('lists every snapshot and calls onRestore/onRemoveSnapshot with the right id', () => {
    let history = pushHistory(createHistory<number>(), 1);
    history = takeSnapshot(history, 'first');
    const onRestore = vi.fn();
    const onRemoveSnapshot = vi.fn();
    render(<HistoryPanel history={history} onUndo={vi.fn()} onRedo={vi.fn()} onSnapshot={vi.fn()} onRestore={onRestore} onRemoveSnapshot={onRemoveSnapshot} />);

    expect(screen.getByText('first')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '⏮ Restore' }));
    expect(onRestore).toHaveBeenCalledWith(history.snapshots[0].id);

    fireEvent.click(screen.getByRole('button', { name: '🗑' }));
    expect(onRemoveSnapshot).toHaveBeenCalledWith(history.snapshots[0].id);
  });

  it('shows a Compare panel once there are 2+ snapshots and renders the diff between the selected pair', () => {
    let history = pushHistory(createHistory<{ a: number }>(), { a: 1 });
    history = takeSnapshot(history, 'v1');
    history = pushHistory(history, { a: 2 });
    history = takeSnapshot(history, 'v2');
    render(<HistoryPanel history={history} onUndo={vi.fn()} onRedo={vi.fn()} onSnapshot={vi.fn()} onRestore={vi.fn()} onRemoveSnapshot={vi.fn()} />);

    expect(screen.getByText('Compare versions')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Compare: from'), { target: { value: history.snapshots[0].id } });
    fireEvent.change(screen.getByLabelText('Compare: to'), { target: { value: history.snapshots[1].id } });
    expect(screen.getByText('$.a')).toBeInTheDocument();
  });
});
