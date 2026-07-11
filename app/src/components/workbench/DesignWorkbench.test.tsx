import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DesignWorkbench } from './DesignWorkbench';
import { createProject } from '../../project/projectManager';

// Integration tests (Section 13) — a real DesignWorkbench mounted with
// only its external callbacks mocked; every internal computation (Design
// Intelligence Engine, Validation Engine, services) is the real thing.
// Covers the "create -> review -> edit -> validate -> preview -> save ->
// export" flow the brief's Success Criteria names.

const noop = vi.fn();

function renderWorkbench(props: Partial<React.ComponentProps<typeof DesignWorkbench>> = {}) {
  return render(
    <DesignWorkbench
      onApplyToEditor={noop}
      onDownloadPackage={noop}
      onGenerateCollection={noop}
      collectionStatus="idle"
      onClose={noop}
      activeProject={null}
      onSaveProject={noop}
      {...props}
    />,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('DesignWorkbench: empty state and generation', () => {
  it('shows an empty-state hint before any spec is generated', () => {
    renderWorkbench();
    expect(screen.getByText(/Fill in the Trend Studio form/)).toBeInTheDocument();
  });

  it('clicking Generate Design Specification produces a spec and shows the Design Spec Panel', () => {
    renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: '🧠 Generate Design Specification' }));
    expect(screen.getByText('DesignSpecification', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(/Fill in the Trend Studio form/)).not.toBeInTheDocument();
  });
});

describe('DesignWorkbench: review, edit, validate (integration)', () => {
  it('an edit made in Property Inspector is immediately reflected in the Validation Panel', () => {
    const { container } = renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: '🧠 Generate Design Specification' }));

    fireEvent.click(screen.getByRole('tab', { name: '⚙️ Properties' }));
    // "Composition" is only a Property Inspector field (no Trend Studio Form field shares
    // its label), but scope to the right sidebar anyway for consistency/robustness.
    const rightSidebar = within(container.querySelector('.workbench-sidebar-right') as HTMLElement);
    // "minimal"'s Pattern Grammar densityRange is [0.25, 0.45] — the engine's freshly-generated
    // spec starts at a density outside that range for most composition styles, so switching
    // Composition to "minimal" reliably produces a real, freshly-introduced relationship error.
    fireEvent.change(rightSidebar.getByLabelText('Composition'), { target: { value: 'minimal' } });

    fireEvent.click(screen.getByRole('tab', { name: '✅ Validation' }));
    expect(screen.getByText(/densityRange/)).toBeInTheDocument();
  });

  it('an edit made via the Code View round-trips through the tree view', () => {
    const { container } = renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: '🧠 Generate Design Specification' }));

    fireEvent.click(screen.getByRole('tab', { name: '📝 Code' }));
    const textarea = container.querySelector('.trend-studio-json-editor') as HTMLTextAreaElement;
    const spec = JSON.parse(textarea.value);
    spec.project.name = 'Renamed From Code View';
    fireEvent.change(textarea, { target: { value: JSON.stringify(spec, null, 2) } });
    fireEvent.click(screen.getByRole('button', { name: '✅ Apply Edits' }));

    fireEvent.click(screen.getByRole('tab', { name: '🔍 Inspector' }));
    expect(screen.getByText('Renamed From Code View')).toBeInTheDocument();
  });

  it('applying invalid JSON in Code View shows an error and does not update the spec', () => {
    const { container } = renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: '🧠 Generate Design Specification' }));
    fireEvent.click(screen.getByRole('tab', { name: '📝 Code' }));

    const textarea = container.querySelector('.trend-studio-json-editor') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{ not valid json' } });
    fireEvent.click(screen.getByRole('button', { name: '✅ Apply Edits' }));

    expect(screen.getByText(/❌/)).toBeInTheDocument();
  });
});

describe('DesignWorkbench: undo/redo', () => {
  it('undoing after a Property Inspector edit restores the previous value', () => {
    renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: '🧠 Generate Design Specification' }));

    fireEvent.click(screen.getByRole('tab', { name: '⚙️ Properties' }));
    const densitySlider = screen.getByRole('slider');
    const originalDensity = (densitySlider as HTMLInputElement).value;
    fireEvent.change(densitySlider, { target: { value: '0.9' } });
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('0.9');

    fireEvent.click(screen.getByRole('tab', { name: '🕘 History' }));
    fireEvent.click(screen.getByRole('button', { name: '↶ Undo' }));

    fireEvent.click(screen.getByRole('tab', { name: '⚙️ Properties' }));
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe(originalDensity);
  });
});

describe('DesignWorkbench: project integration', () => {
  it('saving to an active project calls onSaveProject with a new Design Spec entry', () => {
    const project = createProject('Test Project');
    const onSaveProject = vi.fn();
    renderWorkbench({ activeProject: project, onSaveProject });

    fireEvent.click(screen.getByRole('button', { name: '🧠 Generate Design Specification' }));
    fireEvent.click(screen.getByRole('tab', { name: '💾 Project' }));
    fireEvent.change(screen.getByPlaceholderText('New Design Spec name…'), { target: { value: 'My Draft' } });
    fireEvent.click(screen.getByRole('button', { name: '💾 Save as New' }));

    expect(onSaveProject).toHaveBeenCalledOnce();
    const updated = onSaveProject.mock.calls[0][0];
    expect(updated.designSpecs).toHaveLength(1);
    expect(updated.designSpecs[0].name).toBe('My Draft');
  });
});

describe('DesignWorkbench: theme toggle', () => {
  it('toggles data-theme and persists the choice to localStorage', () => {
    const { container } = renderWorkbench();
    const root = container.querySelector('.design-workbench') as HTMLElement;
    const before = root.getAttribute('data-theme');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
    const after = root.getAttribute('data-theme');
    expect(after).not.toBe(before);
    expect(localStorage.getItem('vsp-workbench-theme')).toBe(after);
  });
});

describe('DesignWorkbench: favorites', () => {
  it('starring a Style DNA in the Favorites tab persists it', () => {
    renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: '🧠 Generate Design Specification' }));
    fireEvent.click(screen.getByRole('tab', { name: '⭐ Favorites' }));

    const styleDnaSection = within(screen.getByText('Style DNA', { selector: 'summary' }).closest('details') as HTMLElement);
    fireEvent.click(styleDnaSection.getAllByRole('button', { name: /^Favorite/ })[0]);

    const stored = JSON.parse(localStorage.getItem('vsp-workbench-favorites-v1')!);
    expect(stored.styleDnaIds.length).toBe(1);
  });
});
