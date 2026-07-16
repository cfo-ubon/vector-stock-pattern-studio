import type { LayoutId } from './types';
import { REGULAR_LATTICE_LAYOUTS } from './hierarchy';

// Build 012, Section 2 (Layout-aware Evaluation). BUILD_012_AUDIT.md Finding
// 1 quantified that `engine/scoring.ts`'s 18 `SOFT_PENALTY_RULES` fire at
// wildly different rates depending on whether a tile's `layoutId` is one of
// `engine/hierarchy.ts`'s own `REGULAR_LATTICE_LAYOUTS` (grid/gridMinimal/
// halfDrop/brick/stripe — layouts whose entire visual identity IS a strict,
// evenly-spaced repeat) or an organic/cluster layout (scatter/toss/airy/
// bouquet/sCurve/radial/heroFlow/heroScatter/densePremium) — with zero
// layout context anywhere in the scoring pipeline to tell the two apart.
//
// This module reuses `REGULAR_LATTICE_LAYOUTS` directly (never redefines or
// duplicates it) and adds exactly one new concept: a 2-value evaluation
// class derived from that same set, for `engine/penaltyRulesV2.ts` to gate
// rule applicability on. BUILD_012_AUDIT.md Finding 7 documents why this is
// 2 classes rather than the brief's literal 8-name list (Organic/Grid/Half
// Drop/Brick/Stripe/Diamond/Mirror/Editorial) — 4 of those 8 are real,
// distinct `LayoutId`s already inside `REGULAR_LATTICE_LAYOUTS`, "Organic" is
// the natural name for the other 9 real `LayoutId`s, "Diamond" does not
// exist anywhere in this codebase (adding one would be a new rendering
// mechanism, forbidden by this build's brief), "Mirror" is an orthogonal
// `LayoutParams.mirror` boolean modifier any layout can carry (not a
// distinct layout), and "Editorial" is a Style DNA descriptor
// (`editorialBotanical`), not a layout.

export type LayoutEvaluationClass = 'lattice' | 'organic';

/** Human-readable explanation of what each evaluation class means and why —
 * surfaced by Section 7 (Explainability) so a penalty exemption always
 * traces back to a real, documented rationale. */
export const LAYOUT_EVALUATION_CLASS_LABELS: Record<LayoutEvaluationClass, string> = {
  lattice:
    'Regular Lattice (grid, gridMinimal, halfDrop, brick, stripe) — even spacing and axis-aligned placement are the deliberate design intent of this layout family, not a defect.',
  organic:
    'Organic/Cluster (scatter, toss, airy, bouquet, sCurve, radial, heroFlow, heroScatter, densePremium) — even spacing or axis alignment here is a real, unintended mechanical tell.',
};

/** The single source of truth `engine/penaltyRulesV2.ts` and
 * `engine/styleEvaluation.ts` both read — reuses `REGULAR_LATTICE_LAYOUTS`
 * (never redefines it), so this can never silently drift from the set
 * `engine/tile.ts`'s own Composition Intelligence V2 gating already
 * established as "this layout's regularity is deliberate" (Build 001). */
export function layoutEvaluationClass(layoutId: LayoutId): LayoutEvaluationClass {
  return REGULAR_LATTICE_LAYOUTS.has(layoutId) ? 'lattice' : 'organic';
}
