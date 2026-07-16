import { describe, it, expect } from 'vitest';
import { createRng } from '../engine/rng';
import { GROWTH_PRESETS } from './growth';
import { BOTANICAL_FAMILIES, BOTANICAL_SPECIES, BOTANICAL_SILHOUETTES, pickCompanionFamily } from './botanicalFamilies';
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

describe('BOTANICAL_SPECIES companion pairing (Build 006, Section 3: Natural Botanical Relationships)', () => {
  it('includes the new babysBreath species the brief names (Gypsophila filler)', () => {
    expect(BOTANICAL_FAMILIES).toContain('babysBreath');
    expect(BOTANICAL_SPECIES.babysBreath.bouquetRole).toBe('filler');
  });

  it('every species has a real, valid companionFamilies list (only real families, never itself)', () => {
    for (const family of BOTANICAL_FAMILIES) {
      const companions = BOTANICAL_SPECIES[family].companionFamilies;
      expect(Array.isArray(companions)).toBe(true);
      for (const c of companions) {
        expect(BOTANICAL_FAMILIES).toContain(c);
        expect(c).not.toBe(family);
      }
    }
  });

  it('every "statement"/"supporting" species has at least one real companion (the brief\'s own pairing requirement)', () => {
    for (const family of BOTANICAL_FAMILIES) {
      const species = BOTANICAL_SPECIES[family];
      if (species.bouquetRole === 'statement' || species.bouquetRole === 'supporting') {
        expect(species.companionFamilies.length).toBeGreaterThan(0);
      }
    }
  });

  it('foliageOnly/filler species intentionally have no companion list (they ARE the companions)', () => {
    for (const family of BOTANICAL_FAMILIES) {
      const species = BOTANICAL_SPECIES[family];
      if (species.bouquetRole === 'foliageOnly') {
        expect(species.companionFamilies).toEqual([]);
      }
    }
  });

  it('rose pairs with real florist companions (eucalyptus/baby\'s-breath/berries, matching the brief\'s own example)', () => {
    expect(BOTANICAL_SPECIES.rose.companionFamilies).toEqual(expect.arrayContaining(['eucalyptus', 'babysBreath', 'berryBranch']));
  });

  it('pickCompanionFamily is deterministic and always returns a real family', () => {
    const a = pickCompanionFamily(createRng('companion-1'), 'rose');
    const b = pickCompanionFamily(createRng('companion-1'), 'rose');
    expect(a).toBe(b);
    expect(BOTANICAL_FAMILIES).toContain(a);
  });

  it('pickCompanionFamily returns undefined for undefined input, and the species itself when it has no companions', () => {
    expect(pickCompanionFamily(createRng('companion-2'), undefined)).toBeUndefined();
    expect(pickCompanionFamily(createRng('companion-3'), 'eucalyptus')).toBe('eucalyptus');
  });

  it('pickCompanionFamily picks a real, varied set of companions across many seeds (never always the same one)', () => {
    const picks = new Set<string>();
    for (let i = 0; i < 60; i++) picks.add(pickCompanionFamily(createRng(`companion-vary-${i}`), 'rose')!);
    expect(picks.size).toBeGreaterThan(1);
    for (const p of picks) expect(BOTANICAL_SPECIES.rose.companionFamilies).toContain(p);
  });

  it('BOTANICAL_SILHOUETTES lists every distinct silhouette actually used across the taxonomy', () => {
    const used = new Set(BOTANICAL_FAMILIES.map((f) => BOTANICAL_SPECIES[f].silhouette));
    for (const s of used) expect(BOTANICAL_SILHOUETTES).toContain(s);
    expect(BOTANICAL_SILHOUETTES.length).toBeGreaterThanOrEqual(used.size);
  });
});
