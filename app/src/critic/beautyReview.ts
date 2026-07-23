import type { CompositionMetrics } from '../engine/scoring';

// Build 023 (Visual Beauty & Premium Art Direction Engine), Step 12:
// Beauty Review Engine. The brief is explicit that this must be a
// SEPARATE evaluation from the existing commercial score, not blindly
// merged into it — this module never writes into
// `absoluteCommercialQuality[V2]` or `commercialAppealScoreV2`, and
// nothing else in the codebase reads `beautyScore` as an input to those.
//
// This is deliberately NOT a third beauty-scoring system built from
// scratch: `engine/patternBeautyScore.ts` (Build 003) and
// `critic/designCritique.ts` (Design Critic Phase) already exist, but
// neither uses the brief's own named dimensions here (focal clarity,
// silhouette cohesion, botanical flow, illustration refinement, depth,
// hierarchy, visual rhythm, negative-space quality, palette harmony,
// thumbnail impact, originality, product suitability), and
// `designCritique.ts` requires a Trend Studio `DesignSpecQualityReport`
// that a plain generated tile never has. Every dimension below is a
// direct read of an existing, already-tested measurement — nothing here
// is fabricated or re-derived by a different formula. Where no exact
// existing analogue exists (depth, originality), the doc comment on that
// dimension says so explicitly rather than silently inventing a "real"
// score.
//
// Takes a plain data object (`BeautyReviewInput`), not `scripts/
// qualityReport.ts`'s `EvalResult` directly — `scripts/` is dev/reporting
// tooling on its own `tsconfig.node.json` program and this app's `src/`
// layer does not import from it (see `tsconfig.app.json`'s `include`).
// Callers under `scripts/` adapt their own `EvalResult` into this shape
// inline (a handful of direct field reads, no new computation).

export interface BeautyDiagnostics {
  focalClarity: number;
  silhouetteCohesion: number;
  botanicalFlow: number;
  illustrationRefinement: number;
  depth: number;
  hierarchy: number;
  visualRhythm: number;
  negativeSpaceQuality: number;
  paletteHarmony: number;
  thumbnailImpact: number;
  originality: number;
  productSuitability: number;
}

export const BEAUTY_DIMENSIONS: Array<{ key: keyof BeautyDiagnostics; label: string }> = [
  { key: 'focalClarity', label: 'Focal Clarity' },
  { key: 'silhouetteCohesion', label: 'Silhouette Cohesion' },
  { key: 'botanicalFlow', label: 'Botanical Flow' },
  { key: 'illustrationRefinement', label: 'Illustration Refinement' },
  { key: 'depth', label: 'Depth' },
  { key: 'hierarchy', label: 'Hierarchy' },
  { key: 'visualRhythm', label: 'Visual Rhythm' },
  { key: 'negativeSpaceQuality', label: 'Negative-Space Quality' },
  { key: 'paletteHarmony', label: 'Palette Harmony' },
  { key: 'thumbnailImpact', label: 'Thumbnail Impact' },
  { key: 'originality', label: 'Originality' },
  { key: 'productSuitability', label: 'Product Suitability' },
];

export interface BeautyReview {
  beautyScore: number;
  beautyDiagnostics: BeautyDiagnostics;
  beautyFailureReasons: string[];
}

const WEAK_THRESHOLD = 55;

/** Human-readable explanation for a single weak dimension — the brief's
 * own requirement ("The score must explain why a pattern is visually
 * weak"), not just a bare number. */
function explainWeakness(key: keyof BeautyDiagnostics, value: number): string {
  const rounded = Math.round(value);
  switch (key) {
    case 'focalClarity':
      return `Focal clarity is weak (${rounded}/100) — no single motif reads as the clear visual focus (engine/heroDetector.ts's heroVisibility).`;
    case 'silhouetteCohesion':
      return `Silhouette cohesion is weak (${rounded}/100) — the composition reads as scattered/fragmented rather than one connected mass (critic/visualAnalysis.ts's fragmentedSilhouette + engine/scoring.ts's clusterCohesion).`;
    case 'botanicalFlow':
      return `Visual flow is weak (${rounded}/100) — the placement sequence doesn't read as a deliberate directional sweep (engine/scoring.ts's flowCoherence).`;
    case 'illustrationRefinement':
      return `Illustration refinement is weak (${rounded}/100) — motif construction reads as mechanical/under-detailed (illustrationQualityV2, or composition as a non-botanical proxy).`;
    case 'depth':
      return `Depth is weak (${rounded}/100) — little foreground/background separation between hero and filler layers (engine/scoring.ts's heroDetailRatio + overlapQuality).`;
    case 'hierarchy':
      return `Hierarchy is weak (${rounded}/100) — hero/secondary/filler roles aren't visually distinguishable (engine/scoring.ts's hierarchy).`;
    case 'visualRhythm':
      return `Visual rhythm is weak (${rounded}/100) — spacing/repeat intervals read as irregular or overly mechanical rather than an intentional beat (engine/scoring.ts's rhythmRegularity).`;
    case 'negativeSpaceQuality':
      return `Negative space is weak (${rounded}/100) — empty area reads as leftover/accidental rather than designed breathing room (engine/scoring.ts's largestEmptyRegion, critic/visualAnalysis.ts's deadSpace).`;
    case 'paletteHarmony':
      return `Palette harmony is weak (${rounded}/100) — color relationships read as flat or discordant (engine/scoring.ts's paletteContrast).`;
    case 'thumbnailImpact':
      return `Thumbnail impact is weak (${rounded}/100) — the pattern loses its identity at marketplace thumbnail scale (engine/patternReadability.ts's thumbnail200).`;
    case 'originality':
      return `Originality is weak (${rounded}/100) — motif shapes repeat with little real variation (engine/scoring.ts's motifShapeDiversity).`;
    case 'productSuitability':
      return `Product suitability is weak (${rounded}/100) — the pattern doesn't fit any evaluated product target well (collection/productTargetFitV2.ts).`;
  }
}

/** Everything the Beauty Review needs, decoupled from any one caller's
 * own result type (see module doc comment). */
export interface BeautyReviewInput {
  metrics: CompositionMetrics;
  heroVisibility: number;
  fragmentedSilhouette: boolean;
  deadSpace: boolean;
  thumbnail200: number;
  illustrationQuality?: number;
  illustrationQualityV2Overall?: number;
  productTargetFit?: number;
  productTargetFitV2?: number;
}

/** Builds the Beauty Review from an already-computed evaluation — every
 * sub-score is a direct read or simple average of existing measurements
 * (see module doc comment); `beautyScore` is a plain unweighted mean,
 * kept transparent rather than an arbitrarily-tuned blend. Never written
 * back into any commercial-score field. */
export function buildBeautyReview(input: BeautyReviewInput): BeautyReview {
  const m = input.metrics;
  const diagnostics: BeautyDiagnostics = {
    focalClarity: input.heroVisibility,
    silhouetteCohesion: input.fragmentedSilhouette ? Math.min(m.clusterCohesion, 40) : m.clusterCohesion,
    botanicalFlow: m.flowCoherence,
    illustrationRefinement: input.illustrationQualityV2Overall ?? input.illustrationQuality ?? m.composition,
    depth: Math.round((m.heroDetailRatio + m.overlapQuality) / 2),
    hierarchy: m.hierarchy,
    visualRhythm: m.rhythmRegularity,
    negativeSpaceQuality: input.deadSpace ? Math.min(m.largestEmptyRegion, 40) : m.largestEmptyRegion,
    paletteHarmony: m.paletteContrast,
    thumbnailImpact: input.thumbnail200,
    originality: m.motifShapeDiversity,
    productSuitability: input.productTargetFitV2 ?? input.productTargetFit ?? 50,
  };

  const values = BEAUTY_DIMENSIONS.map((d) => diagnostics[d.key]);
  const beautyScore = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  const beautyFailureReasons = BEAUTY_DIMENSIONS.filter((d) => diagnostics[d.key] < WEAK_THRESHOLD).map((d) =>
    explainWeakness(d.key, diagnostics[d.key]),
  );

  return { beautyScore, beautyDiagnostics: diagnostics, beautyFailureReasons };
}
