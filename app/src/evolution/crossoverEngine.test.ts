import { describe, it, expect } from 'vitest';
import { createRng } from '../engine/rng';
import { buildDesignSpecification } from '../trend/designIntelligence';
import type { KeywordBundle } from '../trend/designSpecTypes';
import { crossoverSpecs } from './crossoverEngine';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical', secondaryKeywords: ['Wallpaper'], marketplace: 'adobestock', season: 'spring',
    audience: 'editorial', commercialCategory: 'wallpaper', patternType: 'botanical', paletteDirection: 'muted green',
    difficulty: 'moderate', collectionSize: 8, ...overrides,
  };
}

function makeSpec(overrides: Parameters<typeof buildDesignSpecification>[0]['keywordBundle'] extends never ? never : Partial<KeywordBundle> = {}) {
  return buildDesignSpecification({ keywordBundle: makeBundle(overrides), trendPackId: '2026-Q1', createdAt: 1000 });
}

function grid() {
  return { ...makeSpec(), repeatType: 'grid' as const, rhythm: 'regular' as const, flow: 'calm' as const, composition: 'dense' as const };
}
function scatter() {
  return { ...makeSpec(), repeatType: 'scatter' as const, rhythm: 'organic' as const, flow: 'dynamic' as const, composition: 'airy' as const };
}

describe('crossoverSpecs', () => {
  it('every field in the child comes wholly from one parent, never blended', () => {
    const a = grid();
    const b = scatter();
    const { spec: child, record } = crossoverSpecs(a, b, createRng('crossover-1'));
    for (const trait of record.traitsFromA) {
      expect(record.traitsFromB).not.toContain(trait);
    }
    expect(record.traitsFromA.length + record.traitsFromB.length).toBe(4);
    // composition trait group must be entirely from whichever parent won it
    const compositionFromA = record.traitsFromA.includes('composition');
    if (compositionFromA) {
      expect(child.composition).toBe(a.composition);
      expect(child.repeatType).toBe(a.repeatType);
      expect(child.rhythm).toBe(a.rhythm);
      expect(child.flow).toBe(a.flow);
    } else {
      expect(child.composition).toBe(b.composition);
      expect(child.repeatType).toBe(b.repeatType);
      expect(child.rhythm).toBe(b.rhythm);
      expect(child.flow).toBe(b.flow);
    }
  });

  it('palette trait keeps palette.id and colorRoles from the same parent together', () => {
    const a = { ...grid(), palette: { id: 'palette-a', colors: ['#111111', '#222222'] }, colorRoles: { background: '#111111', primary: '#222222', secondary: '#111111', accent: '#222222' } };
    const b = { ...scatter(), palette: { id: 'palette-b', colors: ['#aaaaaa', '#bbbbbb'] }, colorRoles: { background: '#aaaaaa', primary: '#bbbbbb', secondary: '#aaaaaa', accent: '#bbbbbb' } };
    for (let i = 0; i < 10; i++) {
      const { spec: child, record } = crossoverSpecs(a, b, createRng(`palette-consistency-${i}`));
      if (record.traitsFromA.includes('palette')) {
        expect(child.palette.id).toBe('palette-a');
        expect(child.colorRoles).toEqual(a.colorRoles);
      } else {
        expect(child.palette.id).toBe('palette-b');
        expect(child.colorRoles).toEqual(b.colorRoles);
      }
    }
  });

  it('always preserves parent A styleDnaId (the primary parent)', () => {
    const a = { ...grid(), styleDnaId: 'styleA' };
    const b = { ...scatter(), styleDnaId: 'styleB' };
    for (let i = 0; i < 10; i++) {
      const { spec: child } = crossoverSpecs(a, b, createRng(`styledna-${i}`));
      expect(child.styleDnaId).toBe('styleA');
    }
  });

  it('cluster trait (hierarchy/density/negativeSpace) travels together from one parent', () => {
    const a = { ...grid(), density: 0.2, negativeSpace: 0.7 };
    const b = { ...scatter(), density: 0.8, negativeSpace: 0.1 };
    for (let i = 0; i < 10; i++) {
      const { spec: child, record } = crossoverSpecs(a, b, createRng(`cluster-${i}`));
      if (record.traitsFromA.includes('cluster')) {
        expect(child.density).toBe(a.density);
        expect(child.negativeSpace).toBe(a.negativeSpace);
        expect(child.hierarchy).toEqual(a.hierarchy);
      } else {
        expect(child.density).toBe(b.density);
        expect(child.negativeSpace).toBe(b.negativeSpace);
        expect(child.hierarchy).toEqual(b.hierarchy);
      }
    }
  });

  it('motif trait (hero/secondary/filler motifs) travels together from one parent', () => {
    const a = { ...grid(), heroMotifs: [{ categoryId: 'peony', role: 'hero' as const }] };
    const b = { ...scatter(), heroMotifs: [{ categoryId: 'monstera', role: 'hero' as const }] };
    for (let i = 0; i < 10; i++) {
      const { spec: child, record } = crossoverSpecs(a, b, createRng(`motif-${i}`));
      if (record.traitsFromA.includes('motif')) {
        expect(child.heroMotifs).toEqual(a.heroMotifs);
      } else {
        expect(child.heroMotifs).toEqual(b.heroMotifs);
      }
    }
  });

  it('the diff always traces back to real field changes via diffJson', () => {
    const a = grid();
    const b = scatter();
    // 4 independent coin flips occasionally land entirely on parent A
    // (a no-op child); this test only needs one seed where at least one
    // trait actually flipped to parent B, not every possible seed.
    let sawRealDiff = false;
    for (let i = 0; i < 20 && !sawRealDiff; i++) {
      const { diff, record } = crossoverSpecs(a, b, createRng(`diff-check-${i}`));
      if (record.traitsFromB.length > 0) {
        expect(diff.length).toBeGreaterThan(0);
        expect(diff.every((d) => typeof d.path === 'string' && d.path.startsWith('$.'))).toBe(true);
        sawRealDiff = true;
      }
    }
    expect(sawRealDiff).toBe(true);
  });

  it('produces the identical child for the identical seed (reproducible)', () => {
    const a = grid();
    const b = scatter();
    const resultOne = crossoverSpecs(a, b, createRng('reproducible-1'));
    const resultTwo = crossoverSpecs(a, b, createRng('reproducible-1'));
    expect(resultOne.spec).toEqual(resultTwo.spec);
    expect(resultOne.record).toEqual(resultTwo.record);
  });
});
