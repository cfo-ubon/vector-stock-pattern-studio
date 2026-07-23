import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { LUXURY_COMPOSITION_PROFILES } from './luxuryCompositionProfiles';
import { buildLuxuryUnit } from './topologyPlacement';
import { applyHeroDominance } from './heroDominanceEngine';

describe('applyHeroDominance', () => {
  it('the primary hero always renders strictly larger than every secondary/satellite in its own unit', () => {
    const profile = LUXURY_COMPOSITION_PROFILES.dominantCentral;
    const rng = createRng('dominance-hero-bigger');
    const raw = buildLuxuryUnit({ x: 200, y: 200, sizeMul: 1 }, 0, profile, 1200, 100, rng);
    const { anchors } = applyHeroDominance(raw, profile, createRng('dominance-hero-bigger-2'));
    const hero = anchors.find((a) => a.massRole === 'primaryHero')!;
    for (const other of anchors.filter((a) => a.massRole !== 'primaryHero')) {
      expect(hero.sizeMul).toBeGreaterThan(other.sizeMul);
    }
  });

  it('a unit with a smaller zone-anchor size rhythm step still produces a proportionally smaller hero (never an identical absolute size)', () => {
    const profile = LUXURY_COMPOSITION_PROFILES.offsetEditorial;
    const bigUnit = buildLuxuryUnit({ x: 0, y: 0, sizeMul: 1.35 }, 0, profile, 1200, 100, createRng('scale-rhythm-big'));
    const smallUnit = buildLuxuryUnit({ x: 0, y: 0, sizeMul: 0.62 }, 1, profile, 1200, 100, createRng('scale-rhythm-small'));
    const { anchors } = applyHeroDominance([...bigUnit, ...smallUnit], profile, createRng('scale-rhythm-hero'));
    const bigHero = anchors.find((a) => a.unitIndex === 0 && a.massRole === 'primaryHero')!;
    const smallHero = anchors.find((a) => a.unitIndex === 1 && a.massRole === 'primaryHero')!;
    expect(bigHero.sizeMul).toBeGreaterThan(smallHero.sizeMul);
  });

  it('diagnostics report zero focal competition when every non-hero anchor is well below the hero scale', () => {
    const profile = LUXURY_COMPOSITION_PROFILES.dominantCentral;
    const raw = buildLuxuryUnit({ x: 0, y: 0, sizeMul: 1 }, 0, profile, 1200, 100, createRng('diagnostics-check'));
    const { diagnostics } = applyHeroDominance(raw, profile, createRng('diagnostics-check-2'));
    expect(diagnostics.focalCompetitionScore).toBe(0);
    expect(diagnostics.dominantMassRatio).toBeGreaterThan(0);
    expect(diagnostics.thumbnailFocalClarity).toBeGreaterThanOrEqual(0);
    expect(diagnostics.thumbnailFocalClarity).toBeLessThanOrEqual(100);
  });

  it('is deterministic for a given rng seed', () => {
    const profile = LUXURY_COMPOSITION_PROFILES.crescentPremium;
    const raw = buildLuxuryUnit({ x: 10, y: 10, sizeMul: 1 }, 0, profile, 1200, 100, createRng('dominance-determinism'));
    const a = applyHeroDominance(raw, profile, createRng('dominance-determinism-apply'));
    const b = applyHeroDominance(raw, profile, createRng('dominance-determinism-apply'));
    expect(a.anchors).toEqual(b.anchors);
  });
});
