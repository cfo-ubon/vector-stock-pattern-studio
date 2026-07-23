import type { HierarchyParams } from './hierarchy';

// Build 022, Phase 3 (Style-Aware Composition Repair). BUILD_022_AUDIT.md's
// diagnostic matrix identified two real, evidence-backed weak presets whose
// remaining weakness (after Finding 1's scoring-correctness fix) traces to
// their *hierarchy* — the hero/secondary/filler/accent role split each
// preset resolves through `HIERARCHY_PRESETS` (engine/hierarchy.ts):
//
//   - `minimalBotanical` uses the shared `minimalRepeat` preset
//     (heroRatio 0.02, secondaryRatio 0.7) — almost no motif ever gets
//     "hero" treatment, which directly contradicts its own declared
//     identity ("A single restrained botanical silhouette repeated on a
//     strict minimal grid" — knowledge/registry/data/styles/minimalBotanical.json).
//     With no real hero, none of this style's motifs receive the extra
//     illustration-detail investment this codebase's own Hero Detail Ratio
//     work (Build 019/020) already established concentrates on hero-role
//     motifs — a real, measured contributor to its illustrationQualityV2
//     score being the single weakest of all 15 presets (33.53, see the
//     diagnostic matrix).
//   - `luxuryFloral` uses the shared `heroFocus` preset (heroRatio 0.3) —
//     nearly a third of every placement becomes an equally-large hero
//     bouquet, which is exactly what the brief's own diagnosis warns
//     against ("avoid many equal-sized flowers... clearer primary floral
//     focal point").
//
// `heroFocus`/`minimalRepeat` are both shared by other presets
// (darkBotanical/modernTropical use heroFocus; organicAbstract uses
// minimalRepeat — see BUILD_022_AUDIT.md Section 7) that this audit found
// no evidence of being broken, so editing the shared preset table directly
// would risk exactly the "global hack" the brief explicitly forbids. This
// module instead declares a small, additive, per-style override merged in
// only for the two presets this audit found real evidence for — every
// other preset's resolved hierarchy stays byte-identical (see
// `styleDna.test.ts`'s regression test).

/** Only the ratio/scale fields a weak-preset adapter is allowed to touch —
 * never density/negativeSpace/layout/palette, which stay under the
 * style's own existing declared values (this module's whole point is
 * fixing hero/secondary/filler/accent balance, not reinventing the
 * style). Declared as a Partial so an adapter only states what it
 * actually changes; anything omitted keeps the preset's own resolved
 * value. */
export type HierarchyOverride = Partial<Pick<HierarchyParams, 'heroRatio' | 'secondaryRatio' | 'fillerRatio' | 'accentRatio' | 'heroScale'>>;

export const WEAK_PRESET_HIERARCHY_OVERRIDES: Partial<Record<string, HierarchyOverride>> = {
  // Give the "single restrained silhouette" a real hero: was heroRatio
  // 0.02/heroScale 1.2 (inherited from minimalRepeat) — barely
  // distinguishable from "secondary." Raising heroRatio to 0.1 and
  // heroScale to 1.5 (still restrained relative to e.g. luxuryFloral's
  // 2.4-2.6) lets exactly one motif per cluster read as the deliberate
  // focal silhouette the style's own description promises, while
  // secondaryRatio drops to keep the rest of the tile just as spare.
  minimalBotanical: { heroRatio: 0.1, secondaryRatio: 0.55, heroScale: 1.5 },
  // Reduce how many placements compete as an equally-large hero (was
  // heroRatio 0.3, inherited from heroFocus) so one bouquet reads as the
  // clear primary focal point instead of several equal-weight blooms;
  // the freed ratio moves to secondary (supporting blooms/foliage, not
  // filler) to keep the "hand-tied bouquet arrangement" density the
  // style's own description promises. heroScale nudged up slightly
  // (2.4 -> 2.6) so the now-fewer heroes read even more dominant.
  luxuryFloral: { heroRatio: 0.18, secondaryRatio: 0.47, heroScale: 2.6 },
};

/** Merges a weak-preset override (if this style id has one) over an
 * already-resolved `HierarchyParams` — every field not present in the
 * override passes through unchanged. Returns the identical object
 * reference for any style with no registered override (the common case),
 * so callers doing a strict-equality regression check for "did this
 * change anything" get an honest answer. */
export function applyCompositionEnvelope(styleId: string, hierarchy: HierarchyParams): HierarchyParams {
  const override = WEAK_PRESET_HIERARCHY_OVERRIDES[styleId];
  if (!override) return hierarchy;
  return { ...hierarchy, ...override };
}
