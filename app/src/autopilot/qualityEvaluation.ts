import type { GenerateParams, TileData } from '../engine/types';
import { buildTileForGenerate } from '../engine/heroDetector';
import { computeMetrics, computeHeroVisibilityScore } from '../engine/scoring';
import { detectVisualIssues } from '../critic/visualAnalysis';
import { computePatternReadability } from '../engine/patternReadability';
import { evaluateCommercialPatternCritique } from '../critic/commercialPatternCritic';
import { computeCommercialAppealScoreV2 } from '../critic/commercialAppealScore';
import { buildBeautyReview, type BeautyReview } from '../critic/beautyReview';
import { classifyQuality, type QualityDecision } from '../catalog/quality/qualityClassification';
import { evaluateProductTargets } from '../collection/productTargets';
import { randomSeed } from '../engine/rng';

// Build 029, Module 7 — Autonomous Quality Review. Every measurement here
// is a direct call into an already-verified engine/critic module (see
// imports) — this file computes nothing new, it only bridges their real
// outputs into one evaluation result and the READY/REVIEW/REJECT
// classification `catalog/quality/qualityClassification.ts` (Build 026)
// already defines. "Bounded deterministic repair" reuses
// `buildTileForGenerate`'s own verified quality-retry gate
// (`engine/heroDetector.ts`) — regenerating with a new seed IS the
// existing, already-tested repair mechanism; this module adds no new
// geometry/repair logic of its own, per the spec's explicit "use existing
// verified repair engines" rule.

export const MAX_REPAIR_ATTEMPTS = 3;

export interface PatternEvaluation {
  decision: QualityDecision;
  beautyReview: BeautyReview;
  commercialScore: number;
  thumbnailScore: number;
  fragmented: boolean;
  deadSpace: boolean;
  heroVisibility: number;
}

/** Evaluates one already-generated tile — direct reads of already-real
 * measurements, never a new score formula. */
export function evaluateGeneratedPattern(tile: TileData): PatternEvaluation {
  const params = tile.params;
  const metrics = computeMetrics(tile);
  const heroVisibility = computeHeroVisibilityScore(metrics);
  const issues = detectVisualIssues(tile, metrics);
  const fragmented = issues.find((i) => i.id === 'fragmentedSilhouette')?.detected ?? false;
  const deadSpace = issues.find((i) => i.id === 'deadSpace')?.detected ?? false;
  const readability = computePatternReadability(tile, metrics);

  const productEvaluations = evaluateProductTargets({
    categoryId: params.categoryId,
    tileSize: params.tileSize,
    density: params.density,
    keywordText: `${params.categoryId} ${params.productTarget ?? ''}`,
    heroVisibility,
  });
  const productTargetFit = productEvaluations.length > 0 ? Math.max(...productEvaluations.map((e) => e.score)) : undefined;

  const critique = evaluateCommercialPatternCritique({
    metrics,
    categoryId: params.categoryId,
    tileSize: params.tileSize,
    density: params.density,
    keywordText: params.categoryId,
    heroVisibility,
  });
  const commercialAppeal = computeCommercialAppealScoreV2({ critique, heroVisibility });

  const beautyReview = buildBeautyReview({
    metrics,
    heroVisibility,
    fragmentedSilhouette: fragmented,
    deadSpace,
    thumbnail200: readability.thumbnail200,
    productTargetFit,
  });

  const decision = classifyQuality({
    commercialV2: commercialAppeal.overall,
    fragmented,
    deadSpace,
    beautyScore: beautyReview.beautyScore,
  });

  return {
    decision,
    beautyReview,
    commercialScore: commercialAppeal.overall,
    thumbnailScore: readability.thumbnail200,
    fragmented,
    deadSpace,
    heroVisibility,
  };
}

export interface RepairResult {
  tileData: TileData;
  evaluation: PatternEvaluation;
  attempts: number;
  repaired: boolean;
}

/** Bounded deterministic repair: if the first generation isn't READY, tries
 * up to `MAX_REPAIR_ATTEMPTS` TOTAL attempts (including the first),
 * regenerating with a new deterministic seed each time via
 * `buildTileForGenerate` — the app's own existing, verified quality-retry
 * generator. Always keeps the best-scoring attempt seen (by commercial
 * score, tie-broken by beauty score), never discards a READY/REVIEW result
 * in favor of a later REJECT. Never weakens a threshold and never
 * fabricates a passing score — an item that never reaches READY within the
 * bound stays honestly classified as REVIEW/REJECT. */
export function generateWithBoundedRepair(baseParams: GenerateParams, seedForAttempt: (attempt: number) => string = () => randomSeed()): RepairResult {
  let best: { tileData: TileData; evaluation: PatternEvaluation } | null = null;
  let attempts = 0;

  for (let attempt = 0; attempt < MAX_REPAIR_ATTEMPTS; attempt++) {
    attempts++;
    const seed = attempt === 0 ? baseParams.seed : seedForAttempt(attempt);
    const params: GenerateParams = { ...baseParams, seed };
    const { tileData } = buildTileForGenerate(params);
    const evaluation = evaluateGeneratedPattern(tileData);

    if (!best || isBetter(evaluation, best.evaluation)) {
      best = { tileData, evaluation };
    }
    if (evaluation.decision === 'READY') break;
  }

  return { tileData: best!.tileData, evaluation: best!.evaluation, attempts, repaired: attempts > 1 };
}

function decisionRank(decision: QualityDecision): number {
  if (decision === 'READY') return 2;
  if (decision === 'REVIEW') return 1;
  return 0;
}

function isBetter(candidate: PatternEvaluation, current: PatternEvaluation): boolean {
  const rankDiff = decisionRank(candidate.decision) - decisionRank(current.decision);
  if (rankDiff !== 0) return rankDiff > 0;
  if (candidate.commercialScore !== current.commercialScore) return candidate.commercialScore > current.commercialScore;
  return candidate.beautyReview.beautyScore > current.beautyReview.beautyScore;
}
