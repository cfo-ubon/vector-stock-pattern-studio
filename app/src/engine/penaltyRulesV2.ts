import type { CompositionMetrics } from './scoring';
import { SOFT_PENALTY_RULES } from './scoring';
import type { LayoutEvaluationClass } from './layoutEvaluation';
import { isRepeatProduct, type ProductUseId } from '../collection/productTargets';

/** Build 013, Section 2 (Frozen Evaluation Baseline): this module (Penalty
 * System V2) had never carried an explicit version number before — Build
 * 013's baseline manifest needs one real, machine-readable value to pin
 * "which scoring behavior produced this portfolio" against, alongside the
 * already-real `STYLE_SCHEMA_VERSION`/`SPECIES_SCHEMA_VERSION`. `2` reflects
 * this module's own name (Build 012 shipped it as "Penalty System V2" —
 * see this file's own header comment); bump it only if `PENALTY_RULES_V2`'s
 * applicability rules or rule set genuinely change again. */
export const PENALTY_SYSTEM_VERSION = 2;

// Build 012, Section 5 (Penalty System V2). BUILD_012_AUDIT.md's empirical
// bias measurement (Finding 1: 300-tile sample split by layout class) found
// 8 of the original 18 `SOFT_PENALTY_RULES` (engine/scoring.ts) fire at a
// severely different rate on lattice-layout tiles than organic-layout tiles,
// with zero layout/style/product context anywhere to gate on. This module
// replaces the flat rule list with one that declares, for every rule, the
// real evidence behind its applicability — never a silent, unexplained
// on/off switch.
//
// Every rule's `check` function is untouched (still exactly
// `SOFT_PENALTY_RULES`'s own real, geometry-derived condition) — this module
// adds applicability metadata on top, it does not re-derive or re-tune any
// threshold. `applicableLayouts`/`applicableProducts` are the two axes the
// audit's evidence actually supports gating on:
//
//  - `applicableLayouts`: 8 rules are `['organic']`-only (biased against
//    lattice layouts specifically, per the audit's bias table); the other 10
//    stay `'all'` (no measured bias — `quadrantImbalance`/`heroClustering`/
//    `lowPaletteContrast`/`cornerDeadZone`/`repetitiveMotifShapes`/
//    `zeroMotifOverlap`/`tooManyIsolatedObjects`/`lowClusterCohesion`/
//    `adjacentRepetition`/`monotonousScale` all measured <=1pp difference
//    between lattice and organic tiles in the audit's 300-tile sample).
//  - `applicableProducts`: only `cornerDeadZone` is repeat-only — its own
//    metric (`cornerContinuity`) is explicitly about what happens "when a
//    tile repeats" (scoring.ts's own doc comment); a poster/canvas (no
//    tiling concept at all, BUILD_012_AUDIT.md Finding 6) never repeats, so
//    this rule has nothing to check for that product. No other rule's real
//    condition is repeat-specific.
//  - `applicableStyles` stays `'all'` for every rule: the audit's own
//    control experiment (`organicAbstract` shares `minimalBotanical`'s exact
//    `minimalRepeat` hierarchy preset but triggers zero penalties) proves
//    style/hierarchy-preset is NOT the causal factor for any of these 8
//    rules — gating them by style on top of layout would be an unsupported,
//    unmeasured guess, exactly what the brief's "No fake improvements...
//    every change must be explainable and measurable" rule forbids. The
//    field is kept on the type (not deleted) so a genuinely style-evidenced
//    future rule has somewhere to declare it, but no rule ported here uses
//    it.

export type PenaltyConfidence = 'high' | 'medium' | 'low';

export interface PenaltyRuleV2 {
  id: string;
  label: string;
  points: number;
  /** Why this rule exists and, when its applicability is restricted, the
   * real evidence for the restriction — always traceable to
   * BUILD_012_AUDIT.md's measured data, never asserted without a number. */
  reason: string;
  applicableLayouts: 'all' | LayoutEvaluationClass[];
  applicableStyles: 'all';
  applicableProducts: 'all' | 'repeat-only';
  /** `high` = >=50 percentage-point lattice-vs-organic gap in the audit's
   * bias table; `medium` = 10-49pp; `low`/`n/a` (the 10 universal rules) =
   * <=1pp, i.e. no measured bias at all — kept universal specifically
   * *because* the evidence shows no restriction is warranted. */
  confidence: PenaltyConfidence;
  check: (m: CompositionMetrics) => boolean;
}

const APPLICABILITY: Record<string, { applicableLayouts: 'all' | LayoutEvaluationClass[]; applicableProducts: 'all' | 'repeat-only'; confidence: PenaltyConfidence; reason: string }> = {
  gridAppearance: {
    applicableLayouts: ['organic'],
    applicableProducts: 'all',
    confidence: 'high',
    reason: 'Measured 100% fire rate on lattice-layout tiles vs 0% on organic-layout tiles (n=81 lattice / 219 organic) — axis-aligned nearest-neighbor direction is the deliberate structure of a grid/gridMinimal/halfDrop/brick/stripe layout, not a defect.',
  },
  equalSpacingDetected: {
    applicableLayouts: ['organic'],
    applicableProducts: 'all',
    confidence: 'high',
    reason: 'Measured 70% fire rate on lattice-layout tiles vs 1% on organic-layout tiles — uniform nearest-neighbor spacing is the deliberate structure of a strict lattice repeat, not a defect.',
  },
  repeatedMotifOrientation: {
    applicableLayouts: ['organic'],
    applicableProducts: 'all',
    confidence: 'high',
    reason: 'Measured 25% fire rate on lattice-layout tiles vs 0% on organic-layout tiles — lattice layouts are generated with minimal rotation jitter by design.',
  },
  mechanicalComposition: {
    applicableLayouts: ['organic'],
    applicableProducts: 'all',
    confidence: 'high',
    reason: 'Logical compound of gridAppearance + spacingUniformity + rotationDiversity, all 3 already high-confidence lattice-biased signals above — exempting this compound rule for lattice layouts follows directly from exempting its 3 components.',
  },
  edgeImbalance: {
    applicableLayouts: ['organic'],
    applicableProducts: 'all',
    confidence: 'medium',
    reason: 'Measured 16% fire rate on lattice-layout tiles vs 0% on organic-layout tiles — a strict lattice\'s border-cell alignment against the coarse measurement grid produces this reading even at healthy density.',
  },
  largeEmptyHole: {
    applicableLayouts: ['organic'],
    applicableProducts: 'all',
    confidence: 'medium',
    reason: 'Measured 23% fire rate on lattice-layout tiles vs 2% on organic-layout tiles (up to 53% on specific low-density lattice presets) — a strict lattice\'s periodic empty cells can chain into one contiguous flood-filled region that organic jitter naturally breaks up, at equal underlying density.',
  },
  weakHierarchy: {
    applicableLayouts: ['organic'],
    applicableProducts: 'all',
    confidence: 'medium',
    reason: 'Measured 10% fire rate on lattice-layout tiles vs 3% on organic-layout tiles; the audit\'s control experiment (organicAbstract, same minimalRepeat hierarchy preset, organic layout) triggers this rule 0% of the time, ruling out hierarchy-preset intent as the cause and confirming the bias is specifically about lattice-layout placement mechanics.',
  },
  heroInsufficientDetail: {
    applicableLayouts: ['organic'],
    applicableProducts: 'all',
    confidence: 'medium',
    reason: 'Measured 11% fire rate on lattice-layout tiles vs 2% on organic-layout tiles; same organicAbstract control experiment as weakHierarchy rules out hierarchy-preset intent as the cause.',
  },
  cornerDeadZone: {
    applicableLayouts: 'all',
    applicableProducts: 'repeat-only',
    confidence: 'low',
    reason: 'No measured layout bias (0% both classes in the audit sample) — restricted by product instead: this rule measures corner-junction density "when a tile repeats" (cornerContinuity\'s own doc comment); a poster/canvas is a single fixed image with no tiling concept, so this check has nothing to measure for that product.',
  },
};

/** Every original `SOFT_PENALTY_RULES` entry, ported with real applicability
 * metadata (see `APPLICABILITY` above) — the 10 rules with no entry in that
 * table default to fully universal (`'all'`/`'all'`, `confidence: 'low'`
 * meaning "no bias evidence to restrict on", never silently dropped). */
export const PENALTY_RULES_V2: PenaltyRuleV2[] = SOFT_PENALTY_RULES.map((rule) => {
  const applicability = APPLICABILITY[rule.id];
  return {
    id: rule.id,
    label: rule.label,
    points: rule.points,
    check: rule.check,
    reason: applicability?.reason ?? `${rule.label} — no lattice-vs-organic or repeat-vs-single-image bias measured for this rule; applies universally.`,
    applicableLayouts: applicability?.applicableLayouts ?? 'all',
    applicableStyles: 'all',
    applicableProducts: applicability?.applicableProducts ?? 'all',
    confidence: applicability?.confidence ?? 'low',
  };
});

export interface PenaltyEvaluationContext {
  layoutClass: LayoutEvaluationClass;
  productId?: ProductUseId;
}

/** Whether `rule` actually applies under `ctx` — the single gate function
 * every V2 scoring path shares, so "was this rule exempted, and why" is
 * always computed the same way. */
export function isPenaltyApplicable(rule: PenaltyRuleV2, ctx: PenaltyEvaluationContext): boolean {
  if (rule.applicableLayouts !== 'all' && !rule.applicableLayouts.includes(ctx.layoutClass)) return false;
  if (rule.applicableProducts === 'repeat-only' && ctx.productId !== undefined && !isRepeatProduct(ctx.productId)) return false;
  return true;
}
