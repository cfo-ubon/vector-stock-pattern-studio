import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { LUXURY_COMPOSITION_PROFILES, LUXURY_COMPOSITION_PROFILE_IDS, pickLuxuryCompositionProfile } from './luxuryCompositionProfiles';

describe('luxuryCompositionProfiles', () => {
  it('defines all 6 named profiles with sane, non-overlapping-nonsense ranges', () => {
    expect(LUXURY_COMPOSITION_PROFILE_IDS).toHaveLength(6);
    for (const id of LUXURY_COMPOSITION_PROFILE_IDS) {
      const p = LUXURY_COMPOSITION_PROFILES[id];
      expect(p.id).toBe(id);
      expect(p.secondaryAnchorCount[0]).toBeLessThanOrEqual(p.secondaryAnchorCount[1]);
      expect(p.minSecondaryDistanceMul).toBeLessThan(p.maxSecondaryDistanceMul);
      expect(p.heroScaleFloor).toBeGreaterThan(p.secondaryScaleCeiling);
      expect(p.allowedSatellites).toBeGreaterThanOrEqual(0);
      expect(p.heroCount === 1 || p.heroCount === 2).toBe(true);
    }
  });

  it('only dualMassConnected declares a second hero', () => {
    const dualMassCount = LUXURY_COMPOSITION_PROFILE_IDS.filter((id) => LUXURY_COMPOSITION_PROFILES[id].heroCount === 2);
    expect(dualMassCount).toEqual(['dualMassConnected']);
  });

  it('pickLuxuryCompositionProfile is deterministic for a given rng seed', () => {
    const a = pickLuxuryCompositionProfile(createRng('profile-pick-1'));
    const b = pickLuxuryCompositionProfile(createRng('profile-pick-1'));
    expect(a.id).toBe(b.id);
  });

  it('pickLuxuryCompositionProfile only returns profiles from the candidate pool', () => {
    const rng = createRng('profile-pick-narrow');
    const picked = pickLuxuryCompositionProfile(rng, ['crescentPremium', 'dualMassConnected']);
    expect(['crescentPremium', 'dualMassConnected']).toContain(picked.id);
  });
});
