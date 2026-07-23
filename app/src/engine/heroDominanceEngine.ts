import type { Rng } from './types';
import { rngRange, rngInt } from './rng';
import type { LuxuryCompositionProfile } from './luxuryCompositionProfiles';
import type { LuxuryAnchor } from './topologyPlacement';

// A small fixed cycle of scale fractions (of `secondaryScaleCeiling`) —
// see `topologyPlacement.ts`'s `DIST_RHYTHM_FRACTIONS` doc comment for why
// a continuous `rngRange` per anchor collapses `rhythmRegularity` (the
// critic's real recurring-interval metric) toward zero. Anchor SIZE is a
// nearest-neighbor-spacing input in exactly the same way anchor DISTANCE
// is, so it needs the same fix.
const SCALE_RHYTHM_FRACTIONS = [1.0, 0.68, 0.85, 0.55];

// Build 025, Phase 3 (Hero Dominance Engine). BUILD_025_AUDIT.md's failure
// matrix named "equal-weight focal centers" and "weak hero dominance" as
// real, recurring Luxury Floral failure modes distinct from raw
// disconnection: even a topologically-connected arrangement reads as
// scattered rather than composed if every anchor competes at the same
// visual weight. This module is the one place that decides a tile's
// dominant mass's own scale (never left to the same per-anchor rhythm
// cycle every other cluster-based layout uses) and every other anchor's
// ceiling, so that decision is visible and testable.

export interface HeroDominanceDiagnostics {
  /** Fraction of total anchor "footprint area" (sizeMul^2, summed) claimed
   * by the hero anchor(s) alone. */
  dominantMassRatio: number;
  /** Hero sizeMul divided by the largest non-hero sizeMul -- how much
   * bigger the dominant mass reads next to its nearest competitor. */
  heroScaleSeparation: number;
  /** Count of non-hero anchors within 85% of the hero's own scale --
   * anchors that would visually compete for "which one is the focal
   * point". Zero is ideal. */
  focalCompetitionScore: number;
  /** Largest non-hero sizeMul divided by hero sizeMul -- >0.85 flags a
   * secondary mass at real risk of reading as co-dominant. */
  secondaryMassDominanceRisk: number;
  /** 0-100 heuristic: high dominant mass ratio and zero focal competition
   * both raise this; every additional competing anchor lowers it. */
  thumbnailFocalClarity: number;
}

export interface HeroDominanceResult {
  anchors: LuxuryAnchor[];
  diagnostics: HeroDominanceDiagnostics;
}

/** Assigns every anchor's `sizeMul` from its `massRole` and the profile's
 * own scale floor/ceiling (Phase 2), then computes the 5 diagnostics above
 * from the assignment actually made -- never invented separately from what
 * the tile will really render. `secondaryHero` (dualMassConnected only)
 * gets a real, deliberate scale just below the primary's own floor, so the
 * two connected masses read as "dominant + strong second", never
 * "identical twins". */
export function applyHeroDominance(anchors: LuxuryAnchor[], profile: LuxuryCompositionProfile, rng: Rng): HeroDominanceResult {
  const startOffset = rngInt(rng, 0, SCALE_RHYTHM_FRACTIONS.length - 1);
  let secondaryIndex = 0;
  const sized = anchors.map((a): LuxuryAnchor => {
    // `a.sizeMul` (pre-dominance) carries the unit's OWN relative scale --
    // multiplying by it (never overwriting) preserves the large/medium/
    // small size rhythm across the tile's several bouquet units instead of
    // forcing every unit's hero to one identical absolute size (measured
    // to collapse `scaleDiversity`/`hierarchy` when this multiplied by 1
    // uniformly in an earlier version).
    const unitScale = a.sizeMul;
    switch (a.massRole) {
      case 'primaryHero':
        return { ...a, sizeMul: profile.heroScaleFloor * unitScale };
      case 'secondaryHero':
        return { ...a, sizeMul: profile.heroScaleFloor * 0.82 * unitScale };
      case 'secondary': {
        const frac = SCALE_RHYTHM_FRACTIONS[(secondaryIndex + startOffset) % SCALE_RHYTHM_FRACTIONS.length];
        secondaryIndex++;
        const size = profile.secondaryScaleCeiling * frac * (1 + rngRange(rng, -0.05, 0.05));
        return { ...a, sizeMul: Math.min(profile.secondaryScaleCeiling, size) * unitScale };
      }
      case 'satellite':
      default:
        return { ...a, sizeMul: rngRange(rng, 0.28, 0.48) * unitScale };
    }
  });

  // A tile can contain several bouquet units, each with its own hero at a
  // slightly different absolute scale (the unit's own size-rhythm step) --
  // the mean across every unit's primary hero is the representative "hero
  // scale" these diagnostics compare non-hero anchors against, rather than
  // the flat, unscaled `heroScaleFloor` constant (which would misreport a
  // small unit's hero as "losing" to a large unit's ordinary secondary).
  const heroSizes = sized.filter((a) => a.massRole === 'primaryHero').map((a) => a.sizeMul);
  const heroSize = heroSizes.length ? heroSizes.reduce((s, v) => s + v, 0) / heroSizes.length : profile.heroScaleFloor;
  const nonHero = sized.filter((a) => a.massRole !== 'primaryHero');
  const nonHeroSizes = nonHero.map((a) => a.sizeMul);
  const maxOther = nonHeroSizes.length ? Math.max(...nonHeroSizes) : 0;
  const heroScaleSeparation = maxOther > 0 ? heroSize / maxOther : Infinity;
  const focalCompetitionScore = nonHero.filter((a) => a.sizeMul >= heroSize * 0.85).length;
  const secondaryMassDominanceRisk = heroSize > 0 ? maxOther / heroSize : 0;

  const heroAreaSum = sized.filter((a) => a.massRole === 'primaryHero').reduce((s, a) => s + a.sizeMul ** 2, 0);
  const totalArea = sized.reduce((s, a) => s + a.sizeMul ** 2, 0);
  const dominantMassRatio = totalArea > 0 ? heroAreaSum / totalArea : 1;

  const thumbnailFocalClarity = Math.max(0, Math.min(100, dominantMassRatio * 140 - focalCompetitionScore * 15));

  return {
    anchors: sized,
    diagnostics: { dominantMassRatio, heroScaleSeparation, focalCompetitionScore, secondaryMassDominanceRisk, thumbnailFocalClarity },
  };
}
