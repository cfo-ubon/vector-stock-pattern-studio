import type { PortfolioPatternRecord } from './types';
import type { TraitFinding } from './successFailure';
import type { ConfidenceTier } from './confidence';

// Build 013, Sections 11-12 (Self-Improvement Recommendation Engine +
// Single Build 014 Recommendation). The brief is explicit that this engine
// "must NOT alter production code automatically" — everything here is data:
// a per-pattern list of human-readable tags (what would make *this* tile
// better, traceable to its own real `failureModes`) and one portfolio-level
// recommendation object, chosen by ranking Section 7's own failure findings
// rather than introducing a second, parallel notion of "what's wrong."

const FAILURE_MODE_ACTION: Partial<Record<string, string>> = {
  weakHierarchy: 'Strengthen hero-to-support size/detail contrast',
  heroInsufficientDetail: 'Increase hero motif detail density',
  gridAppearance: 'Increase positional jitter / reduce lattice regularity',
  equalSpacingDetected: 'Vary inter-motif spacing',
  zeroMotifOverlap: 'Allow controlled motif overlap for depth',
  largeEmptyHole: 'Fill large negative-space gaps',
  repetitiveMotifShapes: 'Increase motif shape diversity',
  tooManyIsolatedObjects: 'Improve cluster cohesion between motifs',
  lowClusterCohesion: 'Tighten cluster grouping',
  lowPaletteContrast: 'Increase palette contrast',
  weakProductFit: 'Re-target toward a better-fitting product category',
  lowStyleFitQuality: 'Align composition more closely with declared Style DNA',
  weakThumbnailImpact: 'Improve legibility at 200px thumbnail scale',
  repeatedScale: 'Add scale variation across motif instances',
  fragmentedSilhouette: 'Consolidate silhouette into fewer, clearer shapes',
};

/** Section 11's per-tile output: a short, actionable tag per real
 * failure mode already recorded on this pattern — never a new detector,
 * just a human-readable translation of `failureModes`. */
export function computeRecommendationTags(pattern: PortfolioPatternRecord): string[] {
  return pattern.failureModes.map((mode) => FAILURE_MODE_ACTION[mode] ?? `Address ${mode}`);
}

export interface Build014Recommendation {
  failureMode: string;
  action: string;
  affectedPatternCount: number;
  affectedShare: number;
  lift: number;
  confidence: ConfidenceTier;
  evidence: string;
  rationale: string;
}

/** Section 12: exactly one recommendation, chosen from Section 7's own
 * `failureMode`-trait findings (the only trait category that names a real,
 * fixable mechanism — `styleDnaId`/`layoutId` findings describe *where*
 * problems cluster, not *what* to change). Ranked by `lift`, restricted to
 * `medium`/`high` confidence findings (a `low`-confidence finding is real
 * data but not solid enough ground for a single recommendation), tie-broken
 * by the larger affected count so the recommendation addresses the biggest
 * real opportunity, not just the rarest one. Returns `undefined` if no
 * failure-mode finding clears the confidence bar — an honest "no single
 * dominant issue found" result is preferable to forcing a recommendation. */
export function buildBuild014Recommendation(failureFindings: TraitFinding[], totalPatternCount: number): Build014Recommendation | undefined {
  const candidates = failureFindings.filter((f) => f.traitName === 'failureMode' && (f.confidence === 'high' || f.confidence === 'medium'));
  if (candidates.length === 0) return undefined;

  const best = [...candidates].sort((a, b) => (b.lift - a.lift) || (b.occurrences - a.occurrences))[0];
  const action = FAILURE_MODE_ACTION[best.value] ?? `Address ${best.value}`;

  return {
    failureMode: best.value,
    action,
    affectedPatternCount: best.occurrences,
    affectedShare: Math.round((best.occurrences / totalPatternCount) * 1000) / 10,
    lift: best.lift,
    confidence: best.confidence,
    evidence: `${best.value} appears in ${Math.round(best.subgroupFraction * 100)}% of the bottom decile vs ${Math.round(best.populationFraction * 100)}% portfolio-wide (${best.occurrences} of ${best.subgroupSize} bottom-decile patterns), lift ${best.lift}x.`,
    rationale: `${best.reason} This is the highest-lift, ${best.confidence}-confidence failure mechanism found across the 5,000-pattern portfolio — Build 014 should target "${action}" specifically for the affected layout/style combinations rather than a broad re-tune.`,
  };
}
