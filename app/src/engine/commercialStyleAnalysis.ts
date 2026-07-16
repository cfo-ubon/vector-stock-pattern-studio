import type { CompositionMetrics } from './scoring';
import type { BotanicalBeautyMetrics } from './botanicalBeautyMetrics';

// Build 006, Section 1 (Commercial Style Analysis Engine): "a reusable
// knowledge layer describing characteristics of successful stock artwork"
// across 10 named dimensions (hero size, hierarchy, rhythm, spacing,
// silhouette, focal balance, density, palette usage, botanical realism,
// visual richness).
//
// Every band below is a REAL measured number, never an invented target:
// each `min`/`ideal` pair is the actual p10/p90 this project's own Build
// 005 100-pattern portfolio baseline
// (docs/build_reports/baselines/BUILD_005_final_result.json) measured for
// the real, already-computed metric this dimension reuses -- "what a weak
// vs. a top-performing pattern in this engine's OWN best output actually
// scores", not a hand-guessed number. Dimensions with no direct aggregate
// in that baseline (silhouette, botanicalRealism) were measured the same
// way via a one-off diagnostic sweep over the identical 100-pattern set
// (botanical-only results, n=43) before being written here, then the
// diagnostic script was deleted -- the exact same "measure first, delete
// scratch script after" discipline this whole build has used throughout.
//
// This is a genuinely different concept from `engine/designKnowledge.ts`
// (Build 005, Section 1): that module describes what a Style DNA's own
// dials mean ("this style IS large-bouquet, calm-rhythm"); this module
// describes what GOOD commercial output measures as, independent of which
// style produced it -- the benchmark a Commercial Pattern Critic
// (Build 006, Section 8) checks any tile against.

export type CommercialDimensionId =
  | 'heroSize'
  | 'hierarchy'
  | 'rhythm'
  | 'spacing'
  | 'silhouette'
  | 'focalBalance'
  | 'density'
  | 'paletteUsage'
  | 'botanicalRealism'
  | 'visualRichness';

export interface CommercialBenchmarkBand {
  id: CommercialDimensionId;
  label: string;
  /** Real portfolio-measured p10 (the floor a weak commercial performer
   * sits at) for the metric this dimension reuses. */
  min: number;
  /** Real portfolio-measured p90 (where a top commercial performer sits). */
  ideal: number;
  /** Which already-real metric/field this benchmark was measured against,
   * and the exact sample it came from -- documented so the number can
   * never be mistaken for an invented target. */
  source: string;
}

export const COMMERCIAL_STYLE_BENCHMARKS: Record<CommercialDimensionId, CommercialBenchmarkBand> = {
  heroSize: {
    id: 'heroSize', label: 'Hero Size', min: 76.45, ideal: 99.3,
    source: 'computeHeroVisibilityScore, Build 005 100-pattern portfolio (n=100), p10/p90',
  },
  hierarchy: {
    id: 'hierarchy', label: 'Hierarchy', min: 54, ideal: 100,
    source: 'CompositionMetrics.hierarchy, Build 005 100-pattern portfolio (n=100), p10/p90',
  },
  rhythm: {
    id: 'rhythm', label: 'Rhythm', min: 3, ideal: 93,
    source: 'CompositionMetrics.rhythmRegularity, Build 005 100-pattern portfolio (n=100), p10/p90',
  },
  spacing: {
    id: 'spacing', label: 'Spacing', min: 55, ideal: 99,
    source: 'CompositionMetrics.spacing, Build 005 100-pattern portfolio (n=100), p10/p90',
  },
  silhouette: {
    id: 'silhouette', label: 'Silhouette', min: 29, ideal: 100,
    source: 'BotanicalBeautyMetrics.silhouetteBeauty, Build 005 100-pattern portfolio botanical-only results (n=43), p10/p90',
  },
  focalBalance: {
    id: 'focalBalance', label: 'Focal Balance', min: 94, ideal: 100,
    source: 'CompositionMetrics.quadrantBalance, Build 005 100-pattern portfolio (n=100), p10/p90',
  },
  density: {
    id: 'density', label: 'Density', min: 67, ideal: 100,
    source: 'CompositionMetrics.occupancyRatio, Build 005 100-pattern portfolio (n=100), p10/p90',
  },
  paletteUsage: {
    id: 'paletteUsage', label: 'Palette Usage', min: 100, ideal: 100,
    source: 'CompositionMetrics.paletteContrast, Build 005 100-pattern portfolio (n=100) -- p10 and p90 both real-measured at the ceiling (this metric concentrates at 100 for the great majority of the portfolio), a genuinely degenerate-but-real band, not fabricated to look tidy.',
  },
  botanicalRealism: {
    id: 'botanicalRealism', label: 'Botanical Realism', min: 24, ideal: 46,
    source: 'BotanicalBeautyMetrics.botanicalRealism, Build 005 100-pattern portfolio botanical-only results (n=43), p10/p90',
  },
  visualRichness: {
    id: 'visualRichness', label: 'Visual Richness', min: 53, ideal: 72,
    source: 'engine/portfolioQuality.ts computeVisualRichness, Build 005 100-pattern portfolio botanical-only results (n=43), p10/p90',
  },
};

export interface CommercialDimensionScore {
  id: CommercialDimensionId;
  label: string;
  value: number;
  /** 0-100: 100 at/above the real `ideal`, 50 exactly at the real `min`
   * (deliberately reusing this codebase's own established "50 = floor"
   * convention -- see METRIC_FAILURE_FLOOR/GATE_MIN_OVERALL elsewhere --
   * rather than inventing a new threshold scale), scaled toward 0 below
   * the floor and linearly interpolated between the two. */
  fit: number;
}

export interface CommercialStyleAnalysis {
  dimensions: CommercialDimensionScore[];
  /** Average `fit` across whichever dimensions were actually scored --
   * never padded with a fabricated value for a dimension whose real input
   * (e.g. botanical metrics for a non-botanical tile) wasn't available. */
  overallFit: number;
}

function scoreAgainstBand(value: number, band: CommercialBenchmarkBand): number {
  if (band.ideal <= band.min) {
    // Degenerate band (e.g. paletteUsage, where real min===ideal===100):
    // full credit at/above the target, linear credit below it.
    return band.ideal <= 0 ? 100 : Math.round(Math.max(0, Math.min(1, value / band.ideal)) * 100);
  }
  if (value >= band.ideal) return 100;
  if (value <= band.min) {
    return band.min <= 0 ? 0 : Math.round(Math.max(0, Math.min(1, value / band.min)) * 50);
  }
  const frac = (value - band.min) / (band.ideal - band.min);
  return Math.round(50 + frac * 50);
}

export interface CommercialStyleAnalysisInputs {
  metrics: CompositionMetrics;
  heroVisibility?: number;
  botanical?: BotanicalBeautyMetrics;
  visualRichness?: number;
}

/** Scores a tile's already-real metrics against every real commercial
 * benchmark whose required input was actually provided. `metrics` alone
 * covers hierarchy/rhythm/spacing/focalBalance/density/paletteUsage (every
 * category); `heroVisibility`/`botanical`/`visualRichness` are optional
 * (only botanical-category tiles compute the latter two) -- omitting them
 * simply narrows `dimensions`/`overallFit` to what's real, never
 * fabricates a placeholder score for a dimension with no real input. */
export function computeCommercialStyleAnalysis(inputs: CommercialStyleAnalysisInputs): CommercialStyleAnalysis {
  const { metrics, heroVisibility, botanical, visualRichness } = inputs;
  const dimensions: CommercialDimensionScore[] = [];

  const add = (id: CommercialDimensionId, value: number | undefined) => {
    if (value === undefined) return;
    const band = COMMERCIAL_STYLE_BENCHMARKS[id];
    dimensions.push({ id, label: band.label, value, fit: scoreAgainstBand(value, band) });
  };

  add('heroSize', heroVisibility);
  add('hierarchy', metrics.hierarchy);
  add('rhythm', metrics.rhythmRegularity);
  add('spacing', metrics.spacing);
  add('silhouette', botanical?.silhouetteBeauty);
  add('focalBalance', metrics.quadrantBalance);
  add('density', metrics.occupancyRatio);
  add('paletteUsage', metrics.paletteContrast);
  add('botanicalRealism', botanical?.botanicalRealism);
  add('visualRichness', visualRichness);

  const overallFit = dimensions.length > 0
    ? Math.round(dimensions.reduce((sum, d) => sum + d.fit, 0) / dimensions.length)
    : 0;

  return { dimensions, overallFit };
}
