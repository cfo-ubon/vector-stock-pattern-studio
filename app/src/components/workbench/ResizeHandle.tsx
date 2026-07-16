import { useCallback, useEffect, useRef } from 'react';

// Design Workbench Section 1 ("Panels must be resizable") — a real
// pointer-drag resize handle, not a CSS-only illusion. `side` controls
// which direction dragging grows the panel from (the left sidebar grows
// when you drag right; the right sidebar grows when you drag left), so
// the same component works for both docks. Emits the raw next-width in
// pixels via `onResize`; the caller (DesignWorkbench.tsx) owns clamping
// and persistence (workbench/workspaceSettings.ts's `clampSidebarWidth`).

interface Props {
  side: 'left' | 'right';
  width: number;
  onResize: (nextWidth: number) => void;
  label: string;
}

export function ResizeHandle({ side, width, onResize, label }: Props) {
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragState.current) return;
      const delta = e.clientX - dragState.current.startX;
      const nextWidth = side === 'left' ? dragState.current.startWidth + delta : dragState.current.startWidth - delta;
      onResize(nextWidth);
    },
    [side, onResize],
  );

  const stopDragging = useCallback(() => {
    dragState.current = null;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', stopDragging);
  }, [handlePointerMove]);

  const startDragging = useCallback(
    (e: React.PointerEvent) => {
      dragState.current = { startX: e.clientX, startWidth: width };
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', stopDragging);
    },
    [width, handlePointerMove, stopDragging],
  );

  // Safety net: if the component unmounts mid-drag (e.g. the panel that
  // owns this handle gets hidden), don't leave dangling window listeners.
  useEffect(() => () => stopDragging(), [stopDragging]);

  const STEP = 16;
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') onResize(side === 'left' ? width - STEP : width + STEP);
    else if (e.key === 'ArrowRight') onResize(side === 'left' ? width + STEP : width - STEP);
  }

  return (
    <div
      className={`workbench-resize-handle workbench-resize-handle--${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={startDragging}
      onKeyDown={handleKeyDown}
    />
  );
}
