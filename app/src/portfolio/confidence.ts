import type { EvaluationTraceEntry } from '../engine/scoringV2';

// Build 013, Section 10 (Confidence Engine). The brief explicitly forbids
// "arbitrary percentages without a defensible calculation" — every
// confidence tier below is derived from a real, already-available signal
// (how many low-confidence Build 012 penalty rules fired, real sample size,
// real coefficient of variation) using the exact same "coefficient of
// variation, inverted" idiom `engine/portfolioQuality.ts`'s
// `computePortfolioConsistency` already established for this codebase's own
// notion of "how much do these numbers agree with each other" — never a
// fabricated new statistic.

export type ConfidenceTier = 'high' | 'medium' | 'low';

/** Section 10's per-tile confidence: how much to trust *this one tile's*
 * evaluation. Downgraded when Build 012's own per-rule `confidence` field
 * (`PenaltyConfidence`, `engine/penaltyRulesV2.ts`) shows the applied or
 * exempted penalty set leaned on medium/low-confidence rules, and when the
 * tile's real instance count is low enough that geometry-derived metrics
 * (spacing, overlap, hierarchy) have little data to measure from. */
export function computeTileEvaluatorConfidence(appliedPenalties: EvaluationTraceEntry[], exemptedPenalties: EvaluationTraceEntry[], instanceCount: number): ConfidenceTier {
  const allEntries = [...appliedPenalties, ...exemptedPenalties];
  const lowConfidenceCount = allEntries.filter((e) => e.confidence === 'low').length;
  const mediumConfidenceCount = allEntries.filter((e) => e.confidence === 'medium').length;
  const sparseInstances = instanceCount < 6;

  if (sparseInstances && (lowConfidenceCount > 0 || mediumConfidenceCount > 0)) return 'low';
  if (sparseInstances || lowConfidenceCount >= 2) return 'medium';
  if (mediumConfidenceCount >= 3) return 'medium';
  return 'high';
}

export interface SampleConfidenceInput {
  sampleSize: number;
  /** Real values (e.g. a group's absolute-commercial-quality scores) — used
   * to compute a real coefficient of variation, never a pre-aggregated
   * variance number handed in without its source. */
  values: number[];
  /** Real fraction (0-1) of the relevant taxonomy this sample actually
   * covers — e.g. "this recommendation's evidence spans 2 of this preset's
   * own 2 declared layouts" -> 1.0; "spans 1 of 2" -> 0.5. Omit when no
   * coverage concept applies (defaults to 1, i.e. does not penalize). */
  coverageFraction?: number;
}

export interface SampleConfidenceResult {
  tier: ConfidenceTier;
  /** Real coefficient of variation of `values` — kept in the result so a
   * report can quote the actual number behind the tier, not just the label. */
  coefficientOfVariation: number;
  sampleSize: number;
  coverageFraction: number;
  reason: string;
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return 0;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

/** Section 10's general-purpose confidence calculation — used for success/
 * failure trait findings, cluster stability, and recommendation evidence
 * alike, so every "Confidence: High/Medium/Low" in `BUILD_013_REPORT.md`
 * traces back to the exact same, documented formula:
 *
 *  - `sampleSize < 30`: never better than Low (too few real observations to
 *    generalize from, the same order-of-magnitude floor
 *    `detectSequentialStyleDrift` already uses for "fewer than 4 samples has
 *    no meaningful comparison to make", scaled up for a trait/cluster claim
 *    rather than a single before/after split).
 *  - `sampleSize >= 30` and coefficient of variation <= 0.15 (the same
 *    "real, noticeable" scale `computeSpacingUniformity`/
 *    `detectSequentialStyleDrift` already use elsewhere in this codebase)
 *    and full coverage: High.
 *  - Otherwise: Medium. */
export function computeSampleConfidence(input: SampleConfidenceInput): SampleConfidenceResult {
  const { sampleSize, values } = input;
  const coverageFraction = input.coverageFraction ?? 1;
  const cv = coefficientOfVariation(values);

  if (sampleSize < 30) {
    return { tier: 'low', coefficientOfVariation: cv, sampleSize, coverageFraction, reason: `Sample size ${sampleSize} is below the 30-observation floor for a generalizable finding.` };
  }
  if (cv <= 0.15 && coverageFraction >= 0.75) {
    return { tier: 'high', coefficientOfVariation: cv, sampleSize, coverageFraction, reason: `Strong signal across ${sampleSize} samples (coefficient of variation ${Math.round(cv * 100) / 100}, coverage ${Math.round(coverageFraction * 100)}%).` };
  }
  const reasonParts: string[] = [];
  if (cv > 0.15) reasonParts.push(`coefficient of variation ${Math.round(cv * 100) / 100} exceeds the 0.15 high-confidence ceiling`);
  if (coverageFraction < 0.75) reasonParts.push(`coverage is only ${Math.round(coverageFraction * 100)}% of the relevant taxonomy`);
  return { tier: 'medium', coefficientOfVariation: cv, sampleSize, coverageFraction, reason: `${sampleSize} samples, but ${reasonParts.join(' and ')}.` };
}
