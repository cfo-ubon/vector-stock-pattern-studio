import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { buildDesignSpecification } from '../../trend/designIntelligence';
import type { KeywordBundle } from '../../trend/designSpecTypes';
import { PropertyInspector } from './PropertyInspector';
import { getPalette } from '../../services/colorRoleService';
import { HIERARCHY_PRESETS } from '../../engine/hierarchy';

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

describe('PropertyInspector', () => {
  it('changing the Palette select updates palette + colorRoles + background together', () => {
    const spec = makeSpec();
    const onUpdateSpec = vi.fn();
    render(<PropertyInspector spec={spec} onUpdateSpec={onUpdateSpec} />);

    fireEvent.change(screen.getByLabelText('Palette'), { target: { value: 'jewel-tones' } });

    expect(onUpdateSpec).toHaveBeenCalledOnce();
    const next = onUpdateSpec.mock.calls[0][0];
    const jewelTones = getPalette('jewel-tones')!;
    expect(next.palette).toEqual({ id: 'jewel-tones', colors: jewelTones.colors });
    expect(next.colorRoles.background).toBe(jewelTones.colors[0]);
    expect(next.background.color).toBe(jewelTones.colors[0]);
  });

  it('changing the Marketplace select cascades to exportHints.exportFormats', () => {
    const spec = makeSpec();
    const onUpdateSpec = vi.fn();
    render(<PropertyInspector spec={spec} onUpdateSpec={onUpdateSpec} />);

    fireEvent.change(screen.getByLabelText('Marketplace'), { target: { value: 'etsy' } });

    const next = onUpdateSpec.mock.calls[0][0];
    expect(next.marketplace.id).toBe('etsy');
    expect(next.exportHints.exportFormats).toEqual(['svg']); // etsy's marketplace profile requires svg
  });

  it('the Density slider updates spec.density', () => {
    const spec = makeSpec();
    const onUpdateSpec = vi.fn();
    render(<PropertyInspector spec={spec} onUpdateSpec={onUpdateSpec} />);

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '0.75' } });
    expect(onUpdateSpec.mock.calls[0][0].density).toBe(0.75);
  });

  it('adding a Secondary Motif appends a new categoryId with the "secondary" role', () => {
    const spec = { ...makeSpec(), secondaryMotifs: [] };
    const onUpdateSpec = vi.fn();
    render(<PropertyInspector spec={spec} onUpdateSpec={onUpdateSpec} />);

    const addCategorySelect = screen.getByLabelText('Add a secondary motifs category');
    const secondaryEditor = within(addCategorySelect.closest('.workbench-motif-editor') as HTMLElement);
    fireEvent.change(addCategorySelect, { target: { value: 'geometric' } });
    fireEvent.click(secondaryEditor.getByRole('button', { name: '+ Add' }));

    const next = onUpdateSpec.mock.calls[0][0];
    expect(next.secondaryMotifs).toEqual([{ categoryId: 'geometric', role: 'secondary' }]);
  });

  it('removing a Hero Motif chip drops it from heroMotifs (without touching a same-category filler chip)', () => {
    const spec = makeSpec();
    const categoryId = spec.heroMotifs[0].categoryId;
    const onUpdateSpec = vi.fn();
    render(<PropertyInspector spec={spec} onUpdateSpec={onUpdateSpec} />);

    const heroEditor = within(screen.getByText('Hero Motifs').closest('.workbench-motif-editor') as HTMLElement);
    fireEvent.click(heroEditor.getByRole('button', { name: `Remove ${categoryId}` }));
    expect(onUpdateSpec.mock.calls[0][0].heroMotifs).toEqual([]);
  });

  it('editing a Quality Target number input clamps to 0-100', () => {
    const spec = makeSpec();
    const onUpdateSpec = vi.fn();
    render(<PropertyInspector spec={spec} onUpdateSpec={onUpdateSpec} />);

    fireEvent.change(screen.getByLabelText('Overall score'), { target: { value: '150' } });
    expect(onUpdateSpec.mock.calls[0][0].qualityTargets.minOverallScore).toBe(100);
  });
});

describe('PropertyInspector: Hierarchy (Phase 6, Section 3)', () => {
  it('picking a Hierarchy preset updates spec.hierarchy to that preset\'s real value', () => {
    const spec = makeSpec();
    const onUpdateSpec = vi.fn();
    render(<PropertyInspector spec={spec} onUpdateSpec={onUpdateSpec} />);

    fireEvent.change(screen.getByLabelText('Hierarchy'), { target: { value: 'denseLayered' } });
    expect(onUpdateSpec.mock.calls[0][0].hierarchy).toEqual(HIERARCHY_PRESETS.denseLayered.value);
  });

  it('shows a "— custom —" option when the current hierarchy matches no preset', () => {
    const spec = { ...makeSpec(), hierarchy: { heroRatio: 0.11, secondaryRatio: 0.11, fillerRatio: 0.11, accentRatio: 0.11, heroScale: 1, secondaryScale: 1, fillerScale: 1, accentScale: 1 } };
    render(<PropertyInspector spec={spec} onUpdateSpec={vi.fn()} />);
    const select = screen.getByLabelText('Hierarchy') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(within(select).getByText('— custom —')).toBeInTheDocument();
  });
});

describe('PropertyInspector: Flow and Rhythm (Phase 6, Section 3)', () => {
  it('changing Flow updates spec.flow', () => {
    const spec = makeSpec();
    const onUpdateSpec = vi.fn();
    render(<PropertyInspector spec={spec} onUpdateSpec={onUpdateSpec} />);

    fireEvent.change(screen.getByLabelText('Flow'), { target: { value: 'dynamic' } });
    expect(onUpdateSpec.mock.calls[0][0].flow).toBe('dynamic');
  });

  it('changing Rhythm updates spec.rhythm', () => {
    const spec = makeSpec();
    const onUpdateSpec = vi.fn();
    render(<PropertyInspector spec={spec} onUpdateSpec={onUpdateSpec} />);

    fireEvent.change(screen.getByLabelText('Rhythm'), { target: { value: 'syncopated' } });
    expect(onUpdateSpec.mock.calls[0][0].rhythm).toBe('syncopated');
  });
});

describe('PropertyInspector: Cluster Archetypes info (Phase 6, Section 3)', () => {
  it('shows the real, read-only cluster archetype pool for a cluster-aware layout (scatter)', () => {
    const spec = { ...makeSpec(), repeatType: 'scatter' as const };
    render(<PropertyInspector spec={spec} onUpdateSpec={vi.fn()} />);
    expect(screen.getByText(/organicScatter, bouquet, asymmetric/)).toBeInTheDocument();
  });

  it('shows nothing for a layout with no Cluster Composition Engine archetypes (grid)', () => {
    const spec = { ...makeSpec(), repeatType: 'grid' as const };
    render(<PropertyInspector spec={spec} onUpdateSpec={vi.fn()} />);
    expect(screen.queryByText(/Cluster archetypes in play/)).not.toBeInTheDocument();
  });
});
