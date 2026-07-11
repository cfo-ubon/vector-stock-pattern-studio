import { generateBest, deriveSeed, type CandidatePoolResult, type GenerationMode } from '../engine/candidateEngine';
import type { QualityPresetId, CompositionMetrics } from '../engine/scoring';
import { buildGenerateParamsFromDesignSpec } from './designSpecToParams';
import type { CompositionStyle, DesignSpecification } from './designSpecTypes';

// Design Quality auto-improve loop (Section 12) — "Run automatic quality
// analysis... If quality is below threshold: Improve automatically,
// Re-evaluate, Repeat." Reuses the *existing* engine/candidateEngine.ts
// (`generateBest`, the same pool-generate-then-pick-the-highest-scoring-
// candidate pipeline the main editor's "Generate Best" quality mode
// already uses) and engine/scoring.ts's real `CompositionMetrics` — no
// second scoring implementation. "Improve automatically" here means what
// this app's existing Candidate Engine already means: generate a fresh
// deterministic candidate pool from a new derived seed and keep the
// better of the two attempts, up to a bounded number of rounds (never an
// unbounded loop).

const COMPOSITION_TO_QUALITY_PRESET: Record<CompositionStyle, QualityPresetId> = {
  airy: 'stockClean',
  balanced: 'stockClean',
  dense: 'denseLuxury',
  editorial: 'editorialBotanical',
  maximalist: 'denseLuxury',
  minimal: 'stockClean',
};

export function qualityPresetForDesignSpec(spec: DesignSpecification): QualityPresetId {
  return COMPOSITION_TO_QUALITY_PRESET[spec.composition];
}

/** Section 12's 10 named metrics, resolved against the real
 * `CompositionMetrics` wherever an exact match exists (Composition,
 * Hierarchy, "Repeat Quality" = seamlessIntegrity, "SVG Health" =
 * svgHealth, "Balance" = quadrantBalance, "Negative Space" =
 * largestEmptyRegion — a real measured proxy, not the spec's own *input*
 * negativeSpace number) and a clearly-labeled averaged proxy for the 3
 * that have no single existing metric (Flow, Rhythm, Motif Diversity) plus
 * Commercial Readiness. Every value is 0-100, same scale as the underlying
 * `CompositionMetrics`. */
export interface DesignSpecQualityReport {
  overall: number;
  composition: number;
  hierarchy: number;
  flow: number;
  rhythm: number;
  balance: number;
  negativeSpace: number;
  repeatQuality: number;
  svgHealth: number;
  motifDiversity: number;
  commercialReadiness: number;
}

function buildQualityReport(overall: number, m: CompositionMetrics): DesignSpecQualityReport {
  return {
    overall,
    composition: m.composition,
    hierarchy: m.hierarchy,
    // Flow/Rhythm have no single existing metric — averaged from the
    // closest real proxies (documented, not presented as an exact match).
    flow: Math.round((m.heroSeparation + m.edgeDensity) / 2),
    rhythm: Math.round((m.spacing + (100 - m.densityVariance)) / 2),
    balance: Math.round((m.quadrantBalance + m.horizontalBalance + m.verticalBalance) / 3),
    negativeSpace: m.largestEmptyRegion,
    repeatQuality: m.seamlessIntegrity,
    svgHealth: m.svgHealth,
    motifDiversity: Math.round((m.scaleDiversity + m.rotationDiversity) / 2),
    commercialReadiness: Math.round((m.colorBalance + m.paletteContrast + m.svgHealth) / 3),
  };
}

export interface DesignSpecQualityCheck {
  report: DesignSpecQualityReport;
  meetsTargets: boolean;
  shortfalls: string[];
}

/** Checks a quality report against the Design Specification's own
 * `qualityTargets` (the 4 fields Phase 1 deliberately named to line up
 * with real metrics for exactly this wiring — see designSpecTypes.ts's
 * `DesignQualityTargets` doc comment). */
export function checkDesignSpecQuality(report: DesignSpecQualityReport, spec: DesignSpecification): DesignSpecQualityCheck {
  const shortfalls: string[] = [];
  const { qualityTargets } = spec;
  if (report.overall < qualityTargets.minOverallScore) {
    shortfalls.push(`Overall Score ${report.overall} < ${qualityTargets.minOverallScore}`);
  }
  if (report.repeatQuality < qualityTargets.minSeamlessIntegrity) {
    shortfalls.push(`Seamless Integrity ${report.repeatQuality} < ${qualityTargets.minSeamlessIntegrity}`);
  }
  if (report.motifDiversity < qualityTargets.minMotifDiversity) {
    shortfalls.push(`Motif Diversity ${report.motifDiversity} < ${qualityTargets.minMotifDiversity}`);
  }
  if (report.commercialReadiness < qualityTargets.minCommercialReadiness) {
    shortfalls.push(`Commercial Readiness ${report.commercialReadiness} < ${qualityTargets.minCommercialReadiness}`);
  }
  return { report, meetsTargets: shortfalls.length === 0, shortfalls };
}

export interface DesignSpecQualityLoopResult {
  pool: CandidatePoolResult;
  check: DesignSpecQualityCheck;
  /** How many candidate-pool rounds actually ran (1 = met targets on the
   * first pool, or every round was attempted and none met the targets — in
   * that case the round with the highest overall score is returned). */
  roundsUsed: number;
  maxRounds: number;
}

const DEFAULT_MAX_ROUNDS = 3;

/** The Section 12 loop itself: generate a candidate pool (via the
 * existing, unmodified `generateBest`), evaluate it against the spec's own
 * `qualityTargets`; if it doesn't meet them, generate one more pool from a
 * fresh deterministic derived seed and keep whichever round scored higher
 * — up to `maxRounds` (bounded, never infinite). Deterministic: the same
 * spec + seed + maxRounds always produces the same result and the same
 * number of rounds. */
export function runDesignSpecQualityLoop(
  spec: DesignSpecification,
  seed: string,
  mode: GenerationMode = 'fast',
  maxRounds: number = DEFAULT_MAX_ROUNDS,
): DesignSpecQualityLoopResult {
  const qualityPreset = qualityPresetForDesignSpec(spec);
  let bestPool: CandidatePoolResult | null = null;
  let bestCheck: DesignSpecQualityCheck | null = null;

  for (let round = 0; round < maxRounds; round++) {
    const roundSeed = round === 0 ? seed : deriveSeed(seed, 'quality-loop', round);
    const baseParams = buildGenerateParamsFromDesignSpec(spec, roundSeed);
    const pool = generateBest(baseParams, mode, qualityPreset);
    const report = buildQualityReport(pool.winner.score, pool.winner.metrics);
    const check = checkDesignSpecQuality(report, spec);

    if (!bestCheck || pool.winner.score > bestPool!.winner.score) {
      bestPool = pool;
      bestCheck = check;
    }
    if (check.meetsTargets) {
      return { pool, check, roundsUsed: round + 1, maxRounds };
    }
  }

  return { pool: bestPool!, check: bestCheck!, roundsUsed: maxRounds, maxRounds };
}
