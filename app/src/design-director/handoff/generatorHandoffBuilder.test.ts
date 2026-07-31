import { describe, it, expect } from 'vitest';
import { buildGeneratorHandoff } from './generatorHandoffBuilder';
import { createCreativeBrief } from '../domain/creativeBrief';
import { createCollectionPlan, type PatternTypeCounts } from '../domain/collectionPlan';
import { recommendColorwayPlans } from '../colorway/colorwayStrategist';

const counts: PatternTypeCounts = { hero: 2, secondary: 5, blender: 4, stripe: 2, border: 2, coordinate: 3, miniPattern: 1, texture: 1 };

describe('buildGeneratorHandoff', () => {
  it('derives a real category/composition/density/scale from the brief, with rationale for each', () => {
    const brief = createCreativeBrief({
      collectionName: 'Spring Botanical',
      theme: 'Botanical Floral',
      heroStyle: 'Watercolor Tulip',
      targetProducts: ['fabric'],
      expectedDifficulty: 'hard',
      colorDirection: ['#9CAF88', '#F0D080'],
      now: 1000,
    });
    const plan = createCollectionPlan({ briefId: brief.id, name: 'Spring Botanical', theme: 'Botanical Floral', totalSize: 20, patternTypeCounts: counts, targetProducts: ['fabric'], now: 1000 });
    const colorwayPlans = recommendColorwayPlans(brief).plans;
    const handoff = buildGeneratorHandoff(brief, plan, colorwayPlans);

    expect(handoff.categoryId).toBe('botanical');
    expect(handoff.composition).toBe('layered-cluster');
    expect(handoff.density).toBe(0.65);
    expect(handoff.scale).toBe('large');
    expect(handoff.complexity).toBe('intricate');
    expect(handoff.heroMotif).toBe('Watercolor Tulip');
    expect(handoff.palette.length).toBeGreaterThan(0);
    expect(Object.keys(handoff.mappingRationale)).toEqual(
      expect.arrayContaining(['categoryId', 'composition', 'density', 'complexity', 'scale', 'spacing', 'palette', 'colorwayPlan', 'heroMotif']),
    );
  });

  it('defaults to a medium scale when no target product implies a repeat scale', () => {
    const brief = createCreativeBrief({ collectionName: 'X', theme: 'Geometric', now: 1000 });
    const plan = createCollectionPlan({ briefId: brief.id, name: 'X', theme: 'Geometric', totalSize: 20, patternTypeCounts: counts, targetProducts: [], now: 1000 });
    const handoff = buildGeneratorHandoff(brief, plan, []);
    expect(handoff.scale).toBe('medium');
    expect(handoff.categoryId).toBe('geometric');
  });
});
