import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from '../trend/designIntelligence';
import type { KeywordBundle } from '../trend/designSpecTypes';
import { HIERARCHY_PRESETS } from '../engine/hierarchy';
import { buildArtDirectionRecommendations } from './artDirection';
import type { VisualIssue } from './visualAnalysis';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical', secondaryKeywords: ['Wallpaper'], marketplace: 'adobestock',
    season: 'spring', audience: 'editorial', commercialCategory: 'wallpaper', patternType: 'botanical',
    paletteDirection: 'muted green', difficulty: 'moderate', collectionSize: 8, ...overrides,
  };
}

function makeSpec() {
  return buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
}

function issue(id: VisualIssue['id'], detected = true): VisualIssue {
  return { id, label: id, detected, evidence: 'test evidence' };
}

describe('buildArtDirectionRecommendations', () => {
  it('produces no recommendations when no visual issue is detected', () => {
    expect(buildArtDirectionRecommendations(makeSpec(), [issue('weakHero', false)])).toEqual([]);
  });

  it('one recommendation per detected issue only', () => {
    const recs = buildArtDirectionRecommendations(makeSpec(), [issue('weakHero'), issue('deadSpace', false), issue('weakFlow')]);
    expect(recs.map((r) => r.id).sort()).toEqual(['increaseFlowBias', 'increaseHeroDetail'].sort());
  });

  it('weakHero patches hierarchy to the real highest-heroScale preset', () => {
    const spec = { ...makeSpec(), hierarchy: HIERARCHY_PRESETS.minimalRepeat.value };
    const [rec] = buildArtDirectionRecommendations(spec, [issue('weakHero')]);
    expect(rec.specPatch?.hierarchy).toEqual(HIERARCHY_PRESETS.heroFocus.value);
  });

  it('weakHero has no patch when already on the highest-heroScale preset', () => {
    const spec = { ...makeSpec(), hierarchy: HIERARCHY_PRESETS.heroFocus.value };
    const [rec] = buildArtDirectionRecommendations(spec, [issue('weakHero')]);
    expect(rec.specPatch).toBeUndefined();
  });

  it('fragmentedSilhouette (Build 001, Section 9) produces an honest advisory-only recommendation (no fabricated spec field)', () => {
    const [rec] = buildArtDirectionRecommendations(makeSpec(), [issue('fragmentedSilhouette')]);
    expect(rec.id).toBe('increaseConnectivity');
    expect(rec.specPatch).toBeUndefined();
  });

  it('crowdedAreas increases negativeSpace and decreases density, both clamped to [0,1]', () => {
    const spec = { ...makeSpec(), negativeSpace: 0.95, density: 0.02 };
    const [rec] = buildArtDirectionRecommendations(spec, [issue('crowdedAreas')]);
    expect(rec.specPatch?.negativeSpace).toBeLessThanOrEqual(1);
    expect(rec.specPatch?.density).toBeGreaterThanOrEqual(0);
  });

  it('deadSpace decreases negativeSpace and increases density', () => {
    const spec = { ...makeSpec(), negativeSpace: 0.4, density: 0.4 };
    const [rec] = buildArtDirectionRecommendations(spec, [issue('deadSpace')]);
    expect(rec.specPatch?.negativeSpace).toBeLessThan(0.4);
    expect(rec.specPatch?.density).toBeGreaterThan(0.4);
  });

  it('mechanicalSpacing on a strict grid layout swaps to scatter, not just rhythm', () => {
    const spec = { ...makeSpec(), repeatType: 'grid' as const, rhythm: 'regular' as const };
    const [rec] = buildArtDirectionRecommendations(spec, [issue('mechanicalSpacing')]);
    expect(rec.specPatch?.repeatType).toBe('scatter');
    expect(rec.label).toBe('Change Repeat Layout');
  });

  it('mechanicalSpacing on a non-grid layout only patches rhythm', () => {
    const spec = { ...makeSpec(), repeatType: 'scatter' as const, rhythm: 'regular' as const };
    const [rec] = buildArtDirectionRecommendations(spec, [issue('mechanicalSpacing')]);
    expect(rec.specPatch?.repeatType).toBeUndefined();
    expect(rec.specPatch?.rhythm).toBe('organic');
    expect(rec.label).toBe('Improve Rhythm');
  });

  it('weakClusters, lowDetail, and repeatedScale are honestly advisory-only (no specPatch)', () => {
    for (const id of ['weakClusters', 'lowDetail', 'repeatedScale'] as const) {
      const [rec] = buildArtDirectionRecommendations(makeSpec(), [issue(id)]);
      expect(rec.specPatch).toBeUndefined();
    }
  });

  it('repeatedRotation patches flow to dynamic when not already dynamic', () => {
    const spec = { ...makeSpec(), flow: 'calm' as const };
    const [rec] = buildArtDirectionRecommendations(spec, [issue('repeatedRotation')]);
    expect(rec.specPatch?.flow).toBe('dynamic');
  });

  it('weakFlow escalates calm -> directional -> dynamic', () => {
    const calmSpec = { ...makeSpec(), flow: 'calm' as const };
    expect(buildArtDirectionRecommendations(calmSpec, [issue('weakFlow')])[0].specPatch?.flow).toBe('directional');

    const directionalSpec = { ...makeSpec(), flow: 'directional' as const };
    expect(buildArtDirectionRecommendations(directionalSpec, [issue('weakFlow')])[0].specPatch?.flow).toBe('dynamic');

    const dynamicSpec = { ...makeSpec(), flow: 'dynamic' as const };
    expect(buildArtDirectionRecommendations(dynamicSpec, [issue('weakFlow')])[0].specPatch).toBeUndefined();
  });

  it('every recommendation has a non-empty rationale and a valid priority', () => {
    const allIssues = (['weakHero', 'crowdedAreas', 'deadSpace', 'mechanicalSpacing', 'gridAppearance', 'weakClusters', 'lowDetail', 'repeatedRotation', 'repeatedScale', 'weakFlow', 'weakHierarchy', 'tooManyFillers', 'lowHeroVisibility'] as const).map((id) => issue(id));
    for (const rec of buildArtDirectionRecommendations(makeSpec(), allIssues)) {
      expect(rec.rationale.length).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(rec.priority);
    }
  });

  it('weakHierarchy (Build 001.1, Section 9) patches hierarchy to the real highest-heroScale preset', () => {
    const spec = { ...makeSpec(), hierarchy: HIERARCHY_PRESETS.minimalRepeat.value };
    const [rec] = buildArtDirectionRecommendations(spec, [issue('weakHierarchy')]);
    expect(rec.id).toBe('increaseHeroScale');
    expect(rec.specPatch?.hierarchy).toEqual(HIERARCHY_PRESETS.heroFocus.value);
  });

  it('tooManyFillers (Build 001.1, Section 9) reduces fillerRatio and redistributes into hero/secondary', () => {
    const spec = { ...makeSpec(), hierarchy: { ...HIERARCHY_PRESETS.minimalRepeat.value, fillerRatio: 0.5, heroRatio: 0.1, secondaryRatio: 0.3 } };
    const [rec] = buildArtDirectionRecommendations(spec, [issue('tooManyFillers')]);
    expect(rec.id).toBe('reduceFillers');
    expect(rec.specPatch?.hierarchy?.fillerRatio).toBeLessThan(0.5);
    expect(rec.specPatch?.hierarchy?.heroRatio).toBeGreaterThan(0.1);
  });

  it('lowHeroVisibility (Build 001.1, Section 5) is an honest advisory-only recommendation', () => {
    const [rec] = buildArtDirectionRecommendations(makeSpec(), [issue('lowHeroVisibility')]);
    expect(rec.id).toBe('increaseHeroContrast');
    expect(rec.specPatch).toBeUndefined();
  });
});
