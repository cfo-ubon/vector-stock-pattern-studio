// Build 026, Phase 4 — shared READY/REVIEW/REJECT classifier. Build
// 023/024/025's own portfolio-validation scripts
// (`scripts/build0{23,24,25}Portfolio100.ts`, `scripts/build025HumanReview.ts`)
// each define an identical inline `classify()` function — copy-pasted
// per-script, never a shared module, so nothing about it is persisted once
// a script run exits (BUILD_026_AUDIT.md Section 4, item 2). This module
// is that shared function, extracted VERBATIM (same thresholds, same
// branch order, same three outputs) from `build025Portfolio100.ts` — the
// exact classification a Build-025-generated portfolio's READY=77/
// REVIEW=17/REJECT=6 split already used. It does not change, weaken, or
// reinterpret a single threshold; it only gives the existing logic a
// permanent home so `qualitySnapshotStore.ts` can persist a
// `PortfolioAsset`'s classification instead of losing it the moment a
// generation script exits. The Build 025 scripts themselves are left
// untouched (their own inline copies keep working exactly as before) —
// nothing in `scripts/` or `engine/`/`critic/` is modified by this build.

export type QualityDecision = 'READY' | 'REVIEW' | 'REJECT';

export interface QualityClassificationInput {
  /** `absoluteCommercialQualityV2` from `scripts/qualityReport.ts`'s
   * `EvalResult` — the same field every Build 023/024/025 portfolio
   * script classifies against. */
  commercialV2: number;
  /** `issues.fragmentedSilhouette` from the same `EvalResult`. */
  fragmented: boolean;
  /** `issues.deadSpace` from the same `EvalResult`. */
  deadSpace: boolean;
  /** `patternBeautyScore`/`beautyScore` from the same `EvalResult`. */
  beautyScore: number;
}

/** Identical thresholds/branch order to `build025Portfolio100.ts`'s
 * `classify()` — verified line-for-line against that script before this
 * module was written. Any future change to these thresholds must happen
 * in a dedicated build with its own audit and evidence, exactly like
 * Build 025's own fragmentation work — never as an incidental part of
 * adding persistence. */
export function classifyQuality(input: QualityClassificationInput): QualityDecision {
  const { commercialV2, fragmented, deadSpace, beautyScore } = input;
  if (commercialV2 < 40 || (fragmented && deadSpace)) return 'REJECT';
  if (commercialV2 < 70 || fragmented || deadSpace || beautyScore < 55) return 'REVIEW';
  return 'READY';
}
