import type { TileData } from '../engine/types';
import type { CompositionMetrics } from '../engine/scoring';
import type { DesignSpecification } from '../trend/designSpecTypes';
import type { DesignSpecQualityReport } from '../trend/designSpecQuality';
import { buildDesignCritique, type DesignCritique } from './designCritique';
import { detectVisualIssues, type VisualIssue } from './visualAnalysis';
import { detectProblems, type DesignProblem } from './problems';
import { layoutEvaluationClass } from '../engine/layoutEvaluation';
import { buildArtDirectionRecommendations, type ArtDirectionRecommendation } from './artDirection';
import { buildStyleCoachNotes, type StyleCoachNote, type StyleCoachCategory } from './styleCoach';
import { computePatternReadability, type PatternReadabilityResult } from '../engine/patternReadability';
import { evaluateCommercialValidation, type CommercialValidationResult } from './commercialValidation';

// Design Critic & Art Direction Engine (Phase 7) — Section 7 "Design
// Report". Combines Sections 1-5 (Critique, Visual Analysis, Problems,
// Recommendations, Style Coach) into the brief's own named structure:
// Problems, Recommendations, Expected Improvements, Priority. Pure
// aggregation — every field is produced by an already-real critic module
// above; this file adds no scoring or detection logic of its own, only
// the "Expected Improvements" mapping (which real critique dimension each
// recommendation targets) and the priority ordering.

export interface ExpectedImprovement {
  recommendationId: string;
  /** Which real Section 1 critique dimension this recommendation targets. */
  dimension: keyof Omit<DesignCritique, 'overall'>;
  currentScore: number;
  /** Qualitative, not a fabricated predicted number — this report doesn't
   * re-run generation to measure an actual improvement; Section 8's
   * Improvement Loop is what verifies a real before/after delta. */
  note: string;
}

/** Which critique dimension each Art Direction recommendation id targets
 * — used to build Expected Improvements. Keyed by the real recommendation
 * `id`s `critic/artDirection.ts` produces. */
const RECOMMENDATION_DIMENSION: Record<string, keyof Omit<DesignCritique, 'overall'>> = {
  increaseHeroDetail: 'hierarchy',
  increaseNegativeSpace: 'negativeSpace',
  reduceNegativeSpace: 'negativeSpace',
  improveRhythmSpacing: 'rhythm',
  improveRhythmGrid: 'rhythm',
  increaseClusterSize: 'clusterQuality',
  increaseMotifDetail: 'motifDiversity',
  rotateLeaves: 'motifDiversity',
  varyMotifScale: 'motifDiversity',
  increaseFlowBias: 'flow',
  // Build 001.1, Section 9/5: Hero Visibility Score has no dedicated
  // critique dimension of its own (it's a composite read from the same
  // `hierarchy`/`heroDetailRatio`/etc. metrics `hierarchy` already
  // represents at the critique level) — `hierarchy` is the nearest real
  // dimension for all three of these hero-focused recommendations.
  increaseHeroScale: 'hierarchy',
  reduceFillers: 'hierarchy',
  increaseHeroContrast: 'hierarchy',
};

function buildExpectedImprovements(recommendations: ArtDirectionRecommendation[], critique: DesignCritique): ExpectedImprovement[] {
  return recommendations.map((rec) => {
    const dimension = RECOMMENDATION_DIMENSION[rec.id] ?? 'composition';
    const currentScore = critique[dimension];
    return {
      recommendationId: rec.id,
      dimension,
      currentScore,
      note: rec.specPatch
        ? `Applying this patch and regenerating is expected to raise the ${dimension} score above its current ${Math.round(currentScore)}/100 — verify with the Improvement Loop, not assumed.`
        : `Advisory only (no automatic spec patch) — a designer applying this by hand should see the ${dimension} score move above its current ${Math.round(currentScore)}/100.`,
    };
  });
}

const PRIORITY_RANK: Record<ArtDirectionRecommendation['priority'], number> = { high: 0, medium: 1, low: 2 };

export interface DesignReport {
  critique: DesignCritique;
  visualIssues: VisualIssue[];
  problems: DesignProblem[];
  recommendations: ArtDirectionRecommendation[];
  expectedImprovements: ExpectedImprovement[];
  /** Recommendation ids, highest priority first — ties broken by the
   * matching problem's real point value where one exists. */
  priorityOrder: string[];
  styleCoachNotes: StyleCoachNote[];
  meetsCommercialBar: boolean;
  /** Build 001.1, Section 6: readability at a ~200px thumbnail, ~400px
   * preview, and ~800% zoom — see `engine/patternReadability.ts`. */
  readability: PatternReadabilityResult;
  /** Build 001.1, Section 7: Commercial Score, Premium/Luxury/Editorial
   * Feeling, Wallpaper/Fabric/Gift Wrap Score, Commercial Readiness — see
   * `critic/commercialValidation.ts`. */
  commercialValidation: CommercialValidationResult;
}

/** Builds the full Section 7 Design Report for one rendered tile. Never
 * generates artwork — every input (`tile`, `metrics`, `qualityReport`,
 * `meetsTargets`) is already-computed, real data this function only
 * reads and organizes. */
export function buildDesignReport(
  spec: DesignSpecification,
  tile: TileData,
  metrics: CompositionMetrics,
  qualityReport: DesignSpecQualityReport,
  meetsTargets: boolean,
  styleCoachCategory?: StyleCoachCategory,
): DesignReport {
  const critique = buildDesignCritique(qualityReport, metrics);
  const visualIssues = detectVisualIssues(tile, metrics);
  // Build 012 (Evaluation Intelligence Engine V3): `spec.repeatType` is this
  // Design Specification's own real `LayoutId` (see designSpecTypes.ts) —
  // passing its evaluation class through fixes a real live bug where
  // `critic/qualityGate.ts` blocked export/SEO/collection generation for
  // lattice-layout patterns (grid/gridMinimal/halfDrop/brick/stripe) purely
  // because their deliberate even-spacing/axis-alignment triggered
  // high-severity "problems" that were never real defects
  // (BUILD_012_AUDIT.md Finding 1).
  const problems = detectProblems(metrics, { layoutClass: layoutEvaluationClass(spec.repeatType) });
  const recommendations = buildArtDirectionRecommendations(spec, visualIssues);
  const expectedImprovements = buildExpectedImprovements(recommendations, critique);
  const problemPoints = new Map(problems.map((p) => [p.id, p.points]));
  const priorityOrder = [...recommendations]
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (problemPoints.get(b.id) ?? 0) - (problemPoints.get(a.id) ?? 0))
    .map((r) => r.id);
  const styleCoachNotes = buildStyleCoachNotes(spec, styleCoachCategory);
  const readability = computePatternReadability(tile, metrics);
  const commercialValidation = evaluateCommercialValidation(spec, metrics, qualityReport);

  return {
    critique,
    visualIssues,
    problems,
    recommendations,
    expectedImprovements,
    priorityOrder,
    styleCoachNotes,
    meetsCommercialBar: meetsTargets,
    readability,
    commercialValidation,
  };
}
