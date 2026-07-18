import { describe, it, expect } from 'vitest';
import { createRng } from '../engine/rng';
import { flowerAnatomyFor, rollOpenness } from './flowerAnatomy';
import { BOTANICAL_SPECIES, BOTANICAL_FAMILIES } from './botanicalFamilies';

describe('flowerAnatomyFor (Build 007, Section 1; Build 008B, Section 5: Natural Bloom Diversity)', () => {
  it('returns the default profile for an undefined family', () => {
    const profile = flowerAnatomyFor(undefined);
    expect(profile.sepalCount).toBeGreaterThan(0);
    expect(profile.filamentCount).toBeGreaterThan(0);
    expect(profile.opennessRange[0]).toBeLessThan(profile.opennessRange[1]);
  });

  it('sources opennessRange from the species\' real, single-source-of-truth bloomStageRange (rose)', () => {
    const profile = flowerAnatomyFor('rose');
    expect(profile.opennessRange).toEqual(BOTANICAL_SPECIES.rose.bloomStageRange);
  });

  it('sources opennessRange from the species\' real bloomStageRange for every non-degenerate species', () => {
    for (const family of BOTANICAL_FAMILIES) {
      const species = BOTANICAL_SPECIES[family];
      const profile = flowerAnatomyFor(family);
      if (species.bloomStageRange[0] < species.bloomStageRange[1]) {
        expect(profile.opennessRange).toEqual(species.bloomStageRange);
      }
    }
  });

  it('falls back to a real, non-degenerate default range for a species whose own bloomStageRange is zero-width (berryBranch has no petals to "open")', () => {
    expect(BOTANICAL_SPECIES.berryBranch.bloomStageRange[0]).toBe(BOTANICAL_SPECIES.berryBranch.bloomStageRange[1]);
    const profile = flowerAnatomyFor('berryBranch');
    expect(profile.opennessRange[0]).toBeLessThan(profile.opennessRange[1]);
  });

  it('every species resolves a real, non-degenerate opennessRange (never a fixed constant that would defeat bloom diversity)', () => {
    for (const family of BOTANICAL_FAMILIES) {
      const profile = flowerAnatomyFor(family);
      expect(profile.opennessRange[0]).toBeLessThan(profile.opennessRange[1]);
    }
  });

  it('rollOpenness produces varied values across many seeds for every species, never the exact same value', () => {
    for (const family of BOTANICAL_FAMILIES) {
      const profile = flowerAnatomyFor(family);
      const seen = new Set<number>();
      for (let i = 0; i < 20; i++) {
        seen.add(rollOpenness(createRng(`openness-${family}-${i}`), profile));
      }
      expect(seen.size).toBeGreaterThan(1);
    }
  });

  it('rollOpenness never rolls outside the profile\'s own declared range', () => {
    const profile = flowerAnatomyFor('tulip');
    for (let i = 0; i < 40; i++) {
      const value = rollOpenness(createRng(`openness-bounds-${i}`), profile);
      expect(value).toBeGreaterThanOrEqual(profile.opennessRange[0]);
      expect(value).toBeLessThanOrEqual(profile.opennessRange[1]);
    }
  });

  it('keeps real, distinct sepal/filament counts per species (unchanged Build 007 behavior)', () => {
    expect(flowerAnatomyFor('protea').sepalCount).not.toBe(flowerAnatomyFor('tulip').sepalCount);
    expect(flowerAnatomyFor('peony').filamentCount).toBeGreaterThan(flowerAnatomyFor('protea').filamentCount);
  });
});
