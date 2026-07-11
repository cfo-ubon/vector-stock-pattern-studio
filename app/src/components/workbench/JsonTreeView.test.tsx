import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { JsonTreeView } from './JsonTreeView';

// Wraps JsonTreeView with the expandedPaths/onToggle state it expects a
// parent (DesignSpecPanel) to own, so these tests exercise the same
// controlled-toggle contract the real panel uses.
function ControlledTree({ value, search = '' }: { value: unknown; search?: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['$']));
  function onToggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }
  return <JsonTreeView label="Root" value={value} search={search} expandedPaths={expanded} onToggle={onToggle} />;
}

describe('JsonTreeView', () => {
  it('renders a leaf value under an expanded root', () => {
    render(<ControlledTree value={{ a: 1 }} />);
    expect(screen.getByText('a:')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('starts with only the root expanded, then expands/collapses a nested branch on toggle click', () => {
    render(<ControlledTree value={{ nested: { x: 1 } }} />);
    expect(screen.queryByText('x:')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand nested' }));
    expect(screen.getByText('x:')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse nested' }));
    expect(screen.queryByText('x:')).not.toBeInTheDocument();
  });

  it('auto-reveals a collapsed branch containing a search match, with the match highlighted', () => {
    const { rerender } = render(<ControlledTree value={{ nested: { findme: 'value' } }} />);
    expect(screen.queryByText('findme:')).not.toBeInTheDocument();

    rerender(<ControlledTree value={{ nested: { findme: 'value' } }} search="findme" />);
    expect(screen.getByTestId('tree-leaf-$.nested.findme')).toBeInTheDocument();
    expect(screen.getByText('findme', { selector: 'mark' })).toBeInTheDocument();
  });

  it('the context menu button copies the node path to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ControlledTree value={{ a: 1 }} />);

    fireEvent.click(screen.getByLabelText('Actions for $.a'));
    fireEvent.click(screen.getByText('Copy path'));
    expect(writeText).toHaveBeenCalledWith('$.a');
  });
});
