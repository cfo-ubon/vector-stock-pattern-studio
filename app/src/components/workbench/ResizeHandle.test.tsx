import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResizeHandle } from './ResizeHandle';

describe('ResizeHandle: keyboard', () => {
  it('ArrowRight grows a left-side handle by the 16px step', () => {
    const onResize = vi.fn();
    render(<ResizeHandle side="left" width={300} onResize={onResize} label="Resize left sidebar" />);
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });
    expect(onResize).toHaveBeenCalledWith(316);
  });

  it('ArrowLeft shrinks a left-side handle by the 16px step', () => {
    const onResize = vi.fn();
    render(<ResizeHandle side="left" width={300} onResize={onResize} label="Resize left sidebar" />);
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft' });
    expect(onResize).toHaveBeenCalledWith(284);
  });

  it('a right-side handle grows on ArrowLeft and shrinks on ArrowRight (mirrored direction)', () => {
    const onResize = vi.fn();
    render(<ResizeHandle side="right" width={360} onResize={onResize} label="Resize right sidebar" />);
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft' });
    expect(onResize).toHaveBeenLastCalledWith(376);
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });
    expect(onResize).toHaveBeenLastCalledWith(344);
  });

  it('exposes the given label and current width for accessibility', () => {
    render(<ResizeHandle side="left" width={300} onResize={vi.fn()} label="Resize left sidebar" />);
    const handle = screen.getByRole('separator', { name: 'Resize left sidebar' });
    expect(handle).toHaveAttribute('aria-valuenow', '300');
  });
});

describe('ResizeHandle: pointer drag', () => {
  it('dragging right grows a left-side handle by the pointer delta', () => {
    const onResize = vi.fn();
    render(<ResizeHandle side="left" width={300} onResize={onResize} label="Resize left sidebar" />);
    const handle = screen.getByRole('separator');

    fireEvent.pointerDown(handle, { clientX: 100 });
    fireEvent(window, new PointerEvent('pointermove', { clientX: 140 }));
    expect(onResize).toHaveBeenLastCalledWith(340);

    fireEvent(window, new PointerEvent('pointerup'));
    fireEvent(window, new PointerEvent('pointermove', { clientX: 999 }));
    expect(onResize).not.toHaveBeenLastCalledWith(1239);
  });
});
