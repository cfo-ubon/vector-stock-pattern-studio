import { describe, it, expect } from 'vitest';
import { createRng } from '../engine/rng';
import { GROWTH_PRESETS } from './growth';
import { BOTANICAL_FAMILIES, BOTANICAL_SPECIES } from './botanicalFamilies';
import { botanicalGenerator, __testables } from './botanical';

describe('BOTANICAL_SPECIES (Build 005, Section 4)', () => {
  it('every named family has a real species profile', () => {
    for (const family of BOTANICAL_FAMILIES) {
      const profile = BOTANICAL_SPECIES[family];
      expect(profile).toBeDefined();
      expect(profile.label.length).toBeGreaterThan(0);
    }
  });

  it('every profile points at a real, existing growth preset', () => {
    for (const family of BOTANICAL_FAMILIES) {
      const profile = BOTANICAL_SPECIES[family];
      expect(GROWTH_PRESETS[profile.growthPreset]).toBeDefined();
    }
  });

  it('every profile has positive, sane scale multipliers', () => {
    for (const family of BOTANICAL_FAMILIES) {
      const profile = BOTANICAL_SPECIES[family];
      expect(profile.stemLengthScale).toBeGreaterThan(0);
      expect(profile.leafDensityScale).toBeGreaterThan(0);
    }
  });

  it('includes the 3 new species the Build 005 brief names that had no prior standalone family: ranunculus, protea, tropicalLeaf', () => {
    expect(BOTANICAL_FAMILIES).toContain('ranunculus');
    expect(BOTANICAL_FAMILIES).toContain('protea');
    expect(BOTANICAL_FAMILIES).toContain('tropicalLeaf');
  });

  it('rose and ranunculus now produce genuinely distinct geometry (previously the same shape under two names)', () => {
    const rosePool = __testables.poolForFamily('rose');
    const ranunculusPool = __testables.poolForFamily('ranunculus');
    // Every variant tagged specifically 'rose' must be absent from the
    // 'ranunculus'-restricted pool and vice versa -- confirms the retag.
    const roseOnly = __testables.TAGGED_VARIANTS.filter((t) => t.family === 'rose').map((t) => t.variant);
    const ranunculusOnly = __testables.TAGGED_VARIANTS.filter((t) => t.family === 'ranunculus').map((t) => t.variant);
    expect(roseOnly.length).toBeGreaterThan(0);
    expect(ranunculusOnly.length).toBeGreaterThan(0);
    for (const v of roseOnly) expect(ranunculusOnly).not.toContain(v);
    for (const v of ranunculusOnly) expect(roseOnly).not.toContain(v);
    expect(rosePool).not.toEqual(ranunculusPool);
  });

  it('protea and tropicalLeaf produce valid output when explicitly requested', () => {
    for (const family of ['protea', 'tropicalLeaf'] as const) {
      for (let i = 0; i < 10; i++) {
        const motif = botanicalGenerator.createMotif(createRng(`species-${family}-${i}`), ['#f4ede4', '#c9a86c', '#7c8a5f', '#a94438'], 70, 0, {
          family,
        });
        expect(motif.radius).toBeGreaterThan(0);
      }
    }
  });
});
