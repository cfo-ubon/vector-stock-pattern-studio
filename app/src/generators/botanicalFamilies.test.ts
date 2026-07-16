import { describe, it, expect } from 'vitest';
import { createRng } from '../engine/rng';
import { GROWTH_PRESETS } from './growth';
import { BOTANICAL_FAMILIES, BOTANICAL_SPECIES, BOTANICAL_SILHOUETTES, pickCompanionFamily, speciesForProductTarget } from './botanicalFamilies';
import { PRODUCT_USE_IDS } from '../collection/productTargets';
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

describe('BOTANICAL_SPECIES commercial knowledge (Build 008B, Section 1: Commercial Botanical Species Library)', () => {
  it('every species has real, populated commercial fields (not the old simplified profile)', () => {
    for (const family of BOTANICAL_FAMILIES) {
      const species = BOTANICAL_SPECIES[family];
      expect(species.botanicalFamilyName.length).toBeGreaterThan(0);
      expect(species.premiumScore).toBeGreaterThanOrEqual(0);
      expect(species.premiumScore).toBeLessThanOrEqual(100);
      expect(species.eleganceScore).toBeGreaterThanOrEqual(0);
      expect(species.eleganceScore).toBeLessThanOrEqual(100);
      expect(species.commercialPopularity).toBeGreaterThanOrEqual(0);
      expect(species.commercialPopularity).toBeLessThanOrEqual(100);
      expect(species.petalCountRange[0]).toBeLessThanOrEqual(species.petalCountRange[1]);
      expect(species.bloomStageRange[0]).toBeLessThanOrEqual(species.bloomStageRange[1]);
      expect(Array.isArray(species.usageProfiles)).toBe(true);
      expect(species.usageProfiles.length).toBeGreaterThan(0);
      expect(Array.isArray(species.companions)).toBe(true);
    }
  });

  it('companionFamilies (backward-compat) stays exactly the companions matrix\'s family list, in order', () => {
    for (const family of BOTANICAL_FAMILIES) {
      const species = BOTANICAL_SPECIES[family];
      expect(species.companionFamilies).toEqual(species.companions.map((c) => c.family));
    }
  });

  it('every companion entry has a real strength in [0, 1] and a real role', () => {
    for (const family of BOTANICAL_FAMILIES) {
      for (const companion of BOTANICAL_SPECIES[family].companions) {
        expect(companion.strength).toBeGreaterThanOrEqual(0);
        expect(companion.strength).toBeLessThanOrEqual(1);
        expect(['foliage', 'filler', 'accentBerry']).toContain(companion.role);
      }
    }
  });
});

describe('pickCompanionFamily weighted-strength pick (Build 008B, Section 2: Companion Species Matrix)', () => {
  it('is deterministic for a given seed', () => {
    const a = pickCompanionFamily(createRng('weighted-1'), 'rose');
    const b = pickCompanionFamily(createRng('weighted-1'), 'rose');
    expect(a).toBe(b);
  });

  it('a companion with much higher strength is picked substantially more often than a much weaker one', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 400; i++) {
      const pick = pickCompanionFamily(createRng(`weighted-strength-${i}`), 'rose')!;
      counts[pick] = (counts[pick] ?? 0) + 1;
    }
    const strongest = [...BOTANICAL_SPECIES.rose.companions].sort((a, b) => b.strength - a.strength)[0];
    const weakest = [...BOTANICAL_SPECIES.rose.companions].sort((a, b) => a.strength - b.strength)[0];
    if (strongest.family !== weakest.family) {
      expect(counts[strongest.family] ?? 0).toBeGreaterThan(counts[weakest.family] ?? 0);
    }
  });

  it('never picks a family outside the real companions list', () => {
    for (let i = 0; i < 40; i++) {
      const pick = pickCompanionFamily(createRng(`weighted-bounds-${i}`), 'peony')!;
      expect(BOTANICAL_SPECIES.peony.companions.map((c) => c.family)).toContain(pick);
    }
  });
});

describe('speciesForProductTarget (Build 008B, Section 8: Product-aware Species Selection)', () => {
  it('every real ProductUseId resolves to at least one real, non-empty species pool', () => {
    for (const productTarget of PRODUCT_USE_IDS) {
      const pool = speciesForProductTarget(productTarget);
      expect(pool.length).toBeGreaterThan(0);
      for (const family of pool) expect(BOTANICAL_FAMILIES).toContain(family);
    }
  });

  it('wallpaper and homeDecor both resolve species that declare the real "wallpaper" usage profile', () => {
    for (const productTarget of ['wallpaper', 'homeDecor'] as const) {
      const pool = speciesForProductTarget(productTarget);
      for (const family of pool) expect(BOTANICAL_SPECIES[family].usageProfiles).toContain('wallpaper');
    }
  });

  it('fabric and textile resolve species matching their own distinct usage profiles', () => {
    for (const family of speciesForProductTarget('fabric')) expect(BOTANICAL_SPECIES[family].usageProfiles).toContain('fabric');
    for (const family of speciesForProductTarget('textile')) expect(BOTANICAL_SPECIES[family].usageProfiles).toContain('textile');
  });

  it('is ordered by commercial fitness, matching speciesForUsageProfile\'s own convention', () => {
    const pool = speciesForProductTarget('wallpaper');
    for (let i = 1; i < pool.length; i++) {
      const prevScore = BOTANICAL_SPECIES[pool[i - 1]].premiumScore + BOTANICAL_SPECIES[pool[i - 1]].eleganceScore + BOTANICAL_SPECIES[pool[i - 1]].commercialPopularity;
      const currScore = BOTANICAL_SPECIES[pool[i]].premiumScore + BOTANICAL_SPECIES[pool[i]].eleganceScore + BOTANICAL_SPECIES[pool[i]].commercialPopularity;
      expect(prevScore).toBeGreaterThanOrEqual(currScore);
    }
  });
});
