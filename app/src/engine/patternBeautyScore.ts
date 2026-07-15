import type { CompositionMetrics } from './scoring';
import { computeOverallScore } from './scoring';

// Pattern Beauty Score — Build 003, Part 12. The brief names 11 dimensions
// (Composition, Hierarchy, Flow, Rhythm, Spacing, Cluster Quality, Negative
// Space, Commercial Look, Repeat Quality, Designer Feel, Overall) — a
// different named list from critic/designCritique.ts's own 11-dimension
// critique (which needs a `DesignSpecQualityReport` from the Trend
// Intelligence Studio pipeline and isn't available for a plain generated
// tile). This composite is built directly from `CompositionMetrics` instead
// — the same real, already-computed per-tile measurements every score in
// this engine traces back to — so it applies to *any* tile, not just ones
// built through the Design Spec flow.
//
// Two dimensions have no existing direct source and are genuinely new here:
//  - Commercial Look: the same "Absolute Commercial Quality" number the
//    whole build's own quality harness (scripts/qualityReport.ts) already
//    tracks (`computeOverallScore(metrics, 'stockClean')`), under this
//    composite's own name.
//  - Designer Feel: this build's own core theme (Part 14 — "must look
//    designed by a professional illustrator, not generated") made into a
//    real number: the average of the metrics that specifically measure
//    "avoids the mechanical/generated tells" — `rotationDiversity`,
//    `scaleDiversity`, `gridAppearanceScore` (high = doesn't read as an
//    axis-aligned grid), and `spacingUniformity` (high = spacing isn't
//    suspiciously uniform). All four are already real per-tile
//    measurements in `engine/scoring.ts`; this is the first place they're
//    combined into one named "does this look hand-designed" reading.
//
// Every other dimension is a direct read (Composition, Hierarchy, Flow via
// `flowCoherence`, Rhythm via `rhythmRegularity`, Spacing, Cluster Quality
// via `clusterCohesion`, Negative Space via `largestEmptyRegion`) or the
// exact same formula `trend/designSpecQuality.ts` already uses for Repeat
// Quality (average of `seamlessIntegrity` and `cornerContinuity`) — no
// number here is fabricated or re-derived differently from an existing,
// tested formula.

export interface PatternBeautyScore {
  composition: number;
  hierarchy: number;
  flow: number;
  rhythm: number;
  spacing: number;
  clusterQuality: number;
  negativeSpace: number;
  commercialLook: number;
  repeatQuality: number;
  designerFeel: number;
  overall: number;
}

/** Every named dimension paired with its display label, in the brief's own
 * Part 12 order — the single source of truth other modules/UI iterate over
 * instead of hand-listing keys (same pattern as `designCritique.ts`'s own
 * `DESIGN_CRITIQUE_DIMENSIONS`). */
export const PATTERN_BEAUTY_DIMENSIONS: Array<{ key: keyof Omit<PatternBeautyScore, 'overall'>; label: string }> = [
  { key: 'composition', label: 'Composition' },
  { key: 'hierarchy', label: 'Hierarchy' },
  { key: 'flow', label: 'Flow' },
  { key: 'rhythm', label: 'Rhythm' },
  { key: 'spacing', label: 'Spacing' },
  { key: 'clusterQuality', label: 'Cluster Quality' },
  { key: 'negativeSpace', label: 'Negative Space' },
  { key: 'commercialLook', label: 'Commercial Look' },
  { key: 'repeatQuality', label: 'Repeat Quality' },
  { key: 'designerFeel', label: 'Designer Feel' },
];

/** Builds the Pattern Beauty Score from a tile's real `CompositionMetrics`
 * — every sub-dimension traces back to an existing, tested measurement (see
 * module doc comment); `overall` is a plain unweighted average of the other
 * 10, kept simple and transparent rather than an arbitrarily-tuned blend. */
export function computePatternBeautyScore(metrics: CompositionMetrics): PatternBeautyScore {
  const composition = metrics.composition;
  const hierarchy = metrics.hierarchy;
  const flow = metrics.flowCoherence;
  const rhythm = metrics.rhythmRegularity;
  const spacing = metrics.spacing;
  const clusterQuality = metrics.clusterCohesion;
  const negativeSpace = metrics.largestEmptyRegion;
  const commercialLook = computeOverallScore(metrics, 'stockClean').score;
  const repeatQuality = Math.round((metrics.seamlessIntegrity + metrics.cornerContinuity) / 2);
  const designerFeel = Math.round(
    (metrics.rotationDiversity + metrics.scaleDiversity + metrics.gridAppearanceScore + metrics.spacingUniformity) / 4,
  );

  const subScores = [composition, hierarchy, flow, rhythm, spacing, clusterQuality, negativeSpace, commercialLook, repeatQuality, designerFeel];
  const overall = Math.round(subScores.reduce((a, b) => a + b, 0) / subScores.length);

  return {
    composition,
    hierarchy,
    flow,
    rhythm,
    spacing,
    clusterQuality,
    negativeSpace,
    commercialLook,
    repeatQuality,
    designerFeel,
    overall,
  };
}
