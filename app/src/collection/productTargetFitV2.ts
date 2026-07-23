import type { ProductUseEvaluation } from './productTargets';

// Build 022, Phase 7 (Product-Target Fit Engine V2). BUILD_022_AUDIT.md
// Finding 4: `productTargetFit` (the metric every prior build's reporting
// harness has computed) averages `evaluateProductTargets`'s score across
// all 13 named products uniformly. Since a pattern is realistically only
// ever a strong fit for a handful of its 13 products, that average
// mathematically regresses toward the ~40-55 range regardless of how well
// the pattern suits its *actual* best product — this is a measurement
// design flaw, not a generation defect (see the audit's exact arithmetic).
//
// This is not a rewrite of `evaluateProductTargets` (whose per-product
// rules/reasons/`suitable` threshold are untouched and still real) — it's
// a different aggregation over the same real evaluations: report the mean
// of the pattern's own best-fit product(s) (its `suitable` set, or if none
// clear the bar, its single highest-scoring product) instead of a flat
// 13-way average. A pattern genuinely well-suited to 2-3 products should
// score by how well it fits *those*, not be dragged down by 10 products it
// was never meant for.

export interface BestFitProductTargetFit {
  /** Mean score of the pattern's best-fit product set. */
  score: number;
  /** Product ids that made up that best-fit set, in score order. */
  products: string[];
}

/** How many of the top-scoring products to average when none clear the
 * `suitable` bar — keeps the fallback from being dominated by a single
 * lucky top score while still not diluting across all 13. */
const FALLBACK_TOP_N = 3;

export function bestFitProductTargetFit(evaluations: ProductUseEvaluation[]): BestFitProductTargetFit {
  const sorted = [...evaluations].sort((a, b) => b.score - a.score);
  const suitable = sorted.filter((e) => e.suitable);
  const pool = suitable.length > 0 ? suitable : sorted.slice(0, Math.min(FALLBACK_TOP_N, sorted.length));
  const score = pool.length > 0 ? Math.round(pool.reduce((a, e) => a + e.score, 0) / pool.length) : 0;
  return { score, products: pool.map((e) => e.id) };
}
