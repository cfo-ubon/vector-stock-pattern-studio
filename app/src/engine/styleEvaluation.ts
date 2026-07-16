import type { StyleDna } from './styleDna';
import { HIERARCHY_PRESETS } from './hierarchy';
import { layoutEvaluationClass } from './layoutEvaluation';

// Build 012, Section 3 (Style-aware Evaluation). BUILD_012_AUDIT.md's own
// control experiment (Finding 1) proved the 3 catastrophically-scoring
// presets' failure is caused by their layout pool, not by their hierarchy
// preset's intentionally suppressed hero prominence (`organicAbstract`
// shares `minimalBotanical`'s exact `minimalRepeat` hierarchy preset but
// scores 88 mean because its own declared layouts are organic) — so this
// module's real, honest job is narrower than "exempt penalties per style":
// every one of the 15 Style DNA presets gets a real, derived profile
// (satisfying the brief's literal ask), built entirely from fields the
// preset already declares (`layouts`, `density`, `negativeSpace`,
// `hierarchyPreset`'s own real `heroScale`/`secondaryScale`) — never a
// hand-tuned per-preset number, so this generalizes to any future or custom
// Style DNA the same way. `critic/commercialJudgeV2.ts` (Section 6) is
// where this profile earns its keep: a genuinely new "does this tile's
// measured density match what its own style actually declared" dimension,
// replacing the universal ideal band `engine/scoring.ts`'s
// `computeComposition` uses (Finding 3) for exactly the cases that band
// gets wrong (e.g. `minimalBotanical` declares `negativeSpace: 0.45` —
// deliberately sparse by design, not an accident).

export type StyleRegularityClass = 'strict-lattice' | 'mixed' | 'organic';
export type StyleDensityIntent = 'sparse' | 'moderate' | 'dense';
export type StyleHeroProminenceIntent = 'suppressed' | 'normal' | 'emphasized';

export interface StyleEvaluationProfile {
  styleId: string;
  label: string;
  /** Real fraction (0-1) of this style's own declared `layouts` that fall in
   * `REGULAR_LATTICE_LAYOUTS`, via the same `layoutEvaluationClass` every
   * per-tile evaluation call already uses — never a separately-maintained
   * number. */
  latticeFraction: number;
  /** 1 -> 'strict-lattice' (e.g. minimalBotanical, boutiquePackaging,
   * premiumTextile — both declared layouts are lattice); 0 -> 'organic';
   * anything between -> 'mixed' (e.g. luxuryWallpaper, vintageHerbarium). */
  regularityClass: StyleRegularityClass;
  /** Derived directly from the style's own declared `negativeSpace` (0-1) —
   * real bands calibrated from the actual distribution across all 15
   * built-in presets (natural gap: sparse presets declare >=0.35, dense
   * presets declare <=0.15, moderate fills the gap between). */
  densityIntent: StyleDensityIntent;
  /** Real heroScale/secondaryScale ratio read from this style's own
   * `HIERARCHY_PRESETS[hierarchyPreset]` — not a separately-declared style
   * field, so it can never drift from what `applyHierarchy` actually does
   * for this style. Bands calibrated from the real ratio distribution
   * across all 7 hierarchy presets (natural gaps at ~1.35 and ~2.0). */
  heroScaleRatio: number;
  heroProminenceIntent: StyleHeroProminenceIntent;
}

function densityIntentFor(negativeSpace: number): StyleDensityIntent {
  if (negativeSpace >= 0.35) return 'sparse';
  if (negativeSpace >= 0.15) return 'moderate';
  return 'dense';
}

function heroProminenceIntentFor(heroScaleRatio: number): StyleHeroProminenceIntent {
  if (heroScaleRatio <= 1.35) return 'suppressed';
  if (heroScaleRatio <= 2.0) return 'normal';
  return 'emphasized';
}

/** Builds one Style DNA preset's real evaluation profile — pure derivation
 * from already-declared fields, generic over any `StyleDna` (built-in or
 * custom), never a per-preset-id lookup table. */
export function computeStyleEvaluationProfile(dna: StyleDna): StyleEvaluationProfile {
  const classes = dna.layouts.map(layoutEvaluationClass);
  const latticeCount = classes.filter((c) => c === 'lattice').length;
  const latticeFraction = classes.length > 0 ? latticeCount / classes.length : 0;
  const regularityClass: StyleRegularityClass = latticeFraction === 1 ? 'strict-lattice' : latticeFraction === 0 ? 'organic' : 'mixed';

  const densityIntent = densityIntentFor(dna.negativeSpace);

  const hierarchy = HIERARCHY_PRESETS[dna.hierarchyPreset]?.value;
  const heroScaleRatio = hierarchy && hierarchy.secondaryScale > 0 ? Math.round((hierarchy.heroScale / hierarchy.secondaryScale) * 100) / 100 : 1;
  const heroProminenceIntent = heroProminenceIntentFor(heroScaleRatio);

  return { styleId: dna.id, label: dna.label, latticeFraction, regularityClass, densityIntent, heroScaleRatio, heroProminenceIntent };
}

/** Real "does this tile's measured occupancy match what its own style
 * declared" fit score (0-100) — replaces `computeComposition`'s universal
 * 0.3-0.8 "ideal" fullness band (BUILD_012_AUDIT.md Finding 3) with a band
 * centered on the style's own declared `density` (converted to the same
 * 0-100 scale `CompositionMetrics.occupancyRatio` already uses), for
 * exactly the styles a universal band gets wrong. Additive-only: this does
 * NOT mutate `CompositionMetrics.composition` (still used by many other
 * callers/tests with its existing universal-band meaning) — it's a new,
 * separate dimension `critic/commercialJudgeV2.ts` (Section 6) reads. */
export function computeStyleAwareDensityFit(occupancyRatio: number, profile: StyleEvaluationProfile, declaredDensity: number): number {
  const idealCenter = declaredDensity * 100;
  const distance = Math.abs(occupancyRatio - idealCenter);
  // A style with a real "sparse" intent (high declared negativeSpace) is
  // deliberately tolerant of occupancy sitting well below its density
  // figure (empty space IS the design); a "dense" style is stricter about
  // occupancy tracking its own target closely.
  const tolerance = profile.densityIntent === 'sparse' ? 45 : profile.densityIntent === 'moderate' ? 32 : 22;
  return Math.max(0, Math.min(100, Math.round(100 - (distance / tolerance) * 100)));
}
