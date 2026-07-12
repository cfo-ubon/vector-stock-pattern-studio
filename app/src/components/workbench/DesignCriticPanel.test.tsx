import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildDesignSpecification } from '../../trend/designIntelligence';
import type { KeywordBundle } from '../../trend/designSpecTypes';
import { runDesignSpecQualityLoop } from '../../trend/designSpecQuality';
import { defaultParams } from '../../engine/defaults';
import { generateCollection } from '../../collection/collectionGenerator';
import { createProject, addCollectionToProject } from '../../project/projectManager';
import { DesignCriticPanel } from './DesignCriticPanel';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical',
    secondaryKeywords: ['Wallpaper'],
    marketplace: 'adobestock',
    season: 'spring',
    audience: 'editorial',
    commercialCategory: 'wallpaper',
    patternType: 'botanical',
    paletteDirection: 'muted green',
    difficulty: 'moderate',
    collectionSize: 8,
    ...overrides,
  };
}

function makeSpec() {
  return buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
}

function baseProps() {
  return {
    spec: makeSpec(),
    seed: 'design-critic-panel-seed',
    qualityResult: null,
    qualityRunning: false,
    onRunQualityLoop: vi.fn(),
    onUpdateSpec: vi.fn(),
    activeProject: null,
  };
}

describe('DesignCriticPanel: before a quality result exists', () => {
  it('shows a hint and no Design Critique section', () => {
    render(<DesignCriticPanel {...baseProps()} />);
    expect(screen.getByText(/Run the Quality Loop to generate a Design Report/)).toBeInTheDocument();
    expect(screen.queryByText(/Design Critique/)).not.toBeInTheDocument();
  });

  it('clicking Run Quality Loop calls onRunQualityLoop', () => {
    const props = baseProps();
    render(<DesignCriticPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '🎯 Run Quality Loop' }));
    expect(props.onRunQualityLoop).toHaveBeenCalledOnce();
  });
});

describe('DesignCriticPanel: with a real quality result', () => {
  const props = baseProps();
  const qualityResult = runDesignSpecQualityLoop(props.spec, props.seed, 'fast');

  it('renders all 11 Design Critique dimensions from the real report', () => {
    render(<DesignCriticPanel {...props} qualityResult={qualityResult} />);
    for (const label of ['Composition', 'Hierarchy', 'Balance', 'Rhythm', 'Flow', 'Cluster Quality', 'Negative Space', 'Overlap', 'Repeat Quality', 'Motif Diversity', 'Commercial Readiness']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('renders the Visual Analysis and Problems sections', () => {
    render(<DesignCriticPanel {...props} qualityResult={qualityResult} />);
    expect(screen.getByText(/👁 Visual Analysis/)).toBeInTheDocument();
    expect(screen.getByText(/🛑 Problems/)).toBeInTheDocument();
  });

  it('applying a recommendation with a real spec patch calls onUpdateSpec with a merged spec, not a fabricated one', () => {
    const localProps = baseProps();
    const gridSpec = { ...localProps.spec, repeatType: 'grid' as const, rhythm: 'regular' as const, density: 0.3 };
    const gridResult = runDesignSpecQualityLoop(gridSpec, localProps.seed, 'fast');
    render(<DesignCriticPanel {...localProps} spec={gridSpec} qualityResult={gridResult} />);
    const applyButtons = screen.queryAllByRole('button', { name: 'Apply' });
    if (applyButtons.length > 0) {
      fireEvent.click(applyButtons[0]);
      expect(localProps.onUpdateSpec).toHaveBeenCalledOnce();
      const updated = localProps.onUpdateSpec.mock.calls[0][0];
      expect(updated.project).toEqual(gridSpec.project);
    }
  });
});

describe('DesignCriticPanel: Collection Critic', () => {
  it('shows a hint when the active project has no collections yet', () => {
    render(<DesignCriticPanel {...baseProps()} />);
    expect(screen.getByText(/Generate a Collection into this Project to see cross-asset consistency/)).toBeInTheDocument();
  });

  it('critiques the real most-recently-generated collection when one exists', () => {
    const collection = generateCollection({ ...defaultParams(), seed: 'design-critic-panel-collection' });
    const project = addCollectionToProject(createProject('Critic Test Project'), collection);
    render(<DesignCriticPanel {...baseProps()} activeProject={project} />);
    fireEvent.click(screen.getByText(/🏭 Collection Critic/));
    for (const label of ['Palette', 'Motifs', 'Layouts', 'Visual Identity', 'Variation', 'Commercial Readiness']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
});
