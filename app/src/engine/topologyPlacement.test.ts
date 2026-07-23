import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { LUXURY_COMPOSITION_PROFILES } from './luxuryCompositionProfiles';
import { buildLuxuryUnit } from './topologyPlacement';

const tileSize = 1200;
const baseRadius = 100;

describe('buildLuxuryUnit', () => {
  it('every secondary anchor lands within the profile bounded reach of the primary', () => {
    const profile = LUXURY_COMPOSITION_PROFILES.dominantCentral;
    const rng = createRng('unit-bounded-reach');
    const primary = { x: 600, y: 600, sizeMul: 1 };
    const anchors = buildLuxuryUnit(primary, 0, profile, tileSize, baseRadius, rng);
    const unitRadius = baseRadius * primary.sizeMul;
    const maxDist = unitRadius * profile.maxSecondaryDistanceMul;
    for (const a of anchors.filter((x) => x.massRole === 'secondary')) {
      let dx = a.x - primary.x;
      let dy = a.y - primary.y;
      if (Math.abs(dx) > tileSize / 2) dx -= Math.sign(dx) * tileSize;
      if (Math.abs(dy) > tileSize / 2) dy -= Math.sign(dy) * tileSize;
      const dist = Math.hypot(dx, dy);
      expect(dist).toBeLessThanOrEqual(maxDist * 1.15);
    }
  });

  it('always produces exactly one primaryHero anchor', () => {
    const profile = LUXURY_COMPOSITION_PROFILES.crescentPremium;
    const rng = createRng('unit-one-primary');
    const anchors = buildLuxuryUnit({ x: 100, y: 100, sizeMul: 1 }, 2, profile, tileSize, baseRadius, rng);
    expect(anchors.filter((a) => a.massRole === 'primaryHero')).toHaveLength(1);
    expect(anchors.every((a) => a.unitIndex === 2)).toBe(true);
  });

  it('dualMassConnected produces exactly one secondaryHero; single-mass profiles produce none', () => {
    const rng1 = createRng('unit-dual-mass');
    const dual = buildLuxuryUnit({ x: 300, y: 300, sizeMul: 1 }, 0, LUXURY_COMPOSITION_PROFILES.dualMassConnected, tileSize, baseRadius, rng1);
    expect(dual.filter((a) => a.massRole === 'secondaryHero')).toHaveLength(1);

    const rng2 = createRng('unit-single-mass');
    const single = buildLuxuryUnit({ x: 300, y: 300, sizeMul: 1 }, 0, LUXURY_COMPOSITION_PROFILES.offsetEditorial, tileSize, baseRadius, rng2);
    expect(single.filter((a) => a.massRole === 'secondaryHero')).toHaveLength(0);
  });

  it('is deterministic for a given rng seed', () => {
    const profile = LUXURY_COMPOSITION_PROFILES.diagonalLuxury;
    const a = buildLuxuryUnit({ x: 400, y: 400, sizeMul: 1 }, 0, profile, tileSize, baseRadius, createRng('unit-determinism'));
    const b = buildLuxuryUnit({ x: 400, y: 400, sizeMul: 1 }, 0, profile, tileSize, baseRadius, createRng('unit-determinism'));
    expect(a).toEqual(b);
  });

  it('respects allowedSatellites count exactly', () => {
    const profile = LUXURY_COMPOSITION_PROFILES.asymmetricCascading;
    const rng = createRng('unit-satellite-count');
    const anchors = buildLuxuryUnit({ x: 500, y: 500, sizeMul: 1 }, 0, profile, tileSize, baseRadius, rng);
    expect(anchors.filter((a) => a.massRole === 'satellite')).toHaveLength(profile.allowedSatellites);
  });
});
