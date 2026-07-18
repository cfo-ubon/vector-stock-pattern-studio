import type { GenerateParams, TileData } from './types';
import { buildTile } from './tile';
import { computeMetrics, computeHeroVisibilityScore, type CompositionMetrics } from './scoring';
import { computePatternBeautyScore } from './patternBeautyScore';
import { deriveSeed } from './candidateEngine';

// Hero Detector — Build 003, Part 11. Before this build, every "generate a
// new composition" action built exactly one tile and showed it, whatever
// its Hero Visibility Score happened to be — a single unlucky seed (a hero
// anchor that landed in a crowded corner, low palette contrast against its
// own background, ...) shipped as-is. This module analyzes the real Hero
// Visibility Score (engine/scoring.ts's `computeHeroVisibilityScore` —
// detail + separation + hierarchy + palette contrast, weighted) right after
// generation and regenerates from a derived sub-seed when it falls below
// critic/visualAnalysis.ts's own `lowHeroVisibility` threshold (55) —
// reusing that already-calibrated number rather than inventing a second
// one. Bounded attempts (3) so a params combination that can never clear
// the bar (e.g. a hierarchy-exempt layout with no real hero role at all)
// doesn't loop for long; keeps the best-scoring attempt seen, so retrying
// can only help, never hurt, the result actually shown.
//
// Deliberately NOT wired into every `buildTile` call site: actions that
// must reproduce one *specific* composition (rescaling the current tile,
// applying an exact Design Specification, re-rendering a saved gallery
// item) would have their whole point defeated by silently swapping in a
// different seed. Only the two "build a genuinely new composition from
// scratch" actions — the main Generate button and Generate-9-Variations —
// call this.

const HERO_VISIBILITY_RETRY_THRESHOLD = 55;
const MAX_HERO_RETRY_ATTEMPTS = 3;

export interface HeroRetryResult {
  tileData: TileData;
  /** The winning attempt's own metrics — exposed so callers that need them
   * right after (scoring displays, the quality harness) don't pay for a
   * second `computeMetrics` pass over the same tile. */
  metrics: CompositionMetrics;
  attempts: number;
  heroVisibilityScore: number;
  /** True if at least one retry actually ran (the first attempt scored
   * below the threshold) — distinct from `attempts > 1` reading the same
   * way, kept as its own named field so callers don't have to infer intent
   * from a count. */
  regenerated: boolean;
}

/** Builds a tile, checks its real Hero Visibility Score, and regenerates
 * from a derived sub-seed (same deterministic `deriveSeed` scheme the
 * Candidate Engine uses) up to `maxAttempts` times until the score clears
 * `HERO_VISIBILITY_RETRY_THRESHOLD` — or, if none do, returns whichever
 * attempt scored highest. Fully deterministic for a given `params.seed`. */
export function buildTileWithHeroRetry(params: GenerateParams, maxAttempts: number = MAX_HERO_RETRY_ATTEMPTS): HeroRetryResult {
  let best: TileData | null = null;
  let bestMetrics: CompositionMetrics | null = null;
  let bestScore = -1;
  let attempts = 0;

  for (let i = 0; i < maxAttempts; i++) {
    attempts++;
    const seed = i === 0 ? params.seed : deriveSeed(params.seed, 'heroRetry', i);
    const tileData = buildTile({ ...params, seed });
    const metrics = computeMetrics(tileData);
    const score = computeHeroVisibilityScore(metrics);
    if (score > bestScore) {
      best = tileData;
      bestMetrics = metrics;
      bestScore = score;
    }
    if (score >= HERO_VISIBILITY_RETRY_THRESHOLD) break;
  }

  return { tileData: best!, metrics: bestMetrics!, attempts, heroVisibilityScore: bestScore, regenerated: attempts > 1 };
}

// Build 007, Section 7 (Commercial Composition Review): the brief asks for
// an "Art Director pass" that weighs bouquet balance, silhouette clarity,
// negative space, rhythm, repetition, and commercial appeal -- not just
// Hero Visibility. `engine/patternBeautyScore.ts`'s own `overall` (Build
// 003, Part 12) already IS exactly that composite (clusterQuality =
// bouquet balance, negativeSpace, rhythm, repeatQuality = repetition,
// commercialLook = commercial appeal), so this reuses it directly rather
// than inventing a parallel scoring system. `COMMERCIAL_COMPOSITION_RETRY
// _THRESHOLD` is the real measured 10th-percentile `patternBeautyScore`
// across Build 006's own frozen 100-pattern portfolio baseline
// (docs/build_reports/baselines/BUILD_006_final_result.json) -- not an
// invented number, the same "measure, don't guess" convention
// `lowHeroVisibility`'s own threshold and every Commercial Style Analysis
// benchmark band already follow.
//
// A separate function (not a rewrite of `buildTileWithHeroRetry` above):
// that function's own existing tests pin its exact behavior to Hero
// Visibility alone (early-stop precisely at the 55 threshold, "never
// returns a lower Hero Visibility Score" as its own ranking criterion) --
// changing its selection criteria in place would silently break those
// already-passing regression tests. This generalizes the mechanism
// instead of redefining it.
const COMMERCIAL_COMPOSITION_RETRY_THRESHOLD = 77;

export interface CommercialRetryResult {
  tileData: TileData;
  metrics: CompositionMetrics;
  attempts: number;
  heroVisibilityScore: number;
  patternBeautyScore: number;
  regenerated: boolean;
}

/** Builds a tile and regenerates (same derived-sub-seed scheme as
 * `buildTileWithHeroRetry`) up to `maxAttempts` times until BOTH the Hero
 * Visibility Score and the broader Pattern Beauty Score clear their own
 * real thresholds -- or, if none do, returns whichever attempt scored
 * highest on Pattern Beauty Score (the umbrella commercial-composition
 * read). Retrying can only match or improve the result actually shown,
 * never make it worse, the same guarantee `buildTileWithHeroRetry` gives. */
export function buildTileWithCommercialRetry(params: GenerateParams, maxAttempts: number = MAX_HERO_RETRY_ATTEMPTS): CommercialRetryResult {
  let best: TileData | null = null;
  let bestMetrics: CompositionMetrics | null = null;
  let bestHeroScore = -1;
  let bestBeautyScore = -1;
  let attempts = 0;

  for (let i = 0; i < maxAttempts; i++) {
    attempts++;
    const seed = i === 0 ? params.seed : deriveSeed(params.seed, 'commercialRetry', i);
    const tileData = buildTile({ ...params, seed });
    const metrics = computeMetrics(tileData);
    const heroScore = computeHeroVisibilityScore(metrics);
    const beautyScore = computePatternBeautyScore(metrics).overall;
    if (beautyScore > bestBeautyScore) {
      best = tileData;
      bestMetrics = metrics;
      bestHeroScore = heroScore;
      bestBeautyScore = beautyScore;
    }
    if (heroScore >= HERO_VISIBILITY_RETRY_THRESHOLD && beautyScore >= COMMERCIAL_COMPOSITION_RETRY_THRESHOLD) break;
  }

  return {
    tileData: best!,
    metrics: bestMetrics!,
    attempts,
    heroVisibilityScore: bestHeroScore,
    patternBeautyScore: bestBeautyScore,
    regenerated: attempts > 1,
  };
}

// Build 018 ("Revenue First"): extracted from App.tsx's own local
// `buildTileForGenerate` (Build 007, Section 7) so the new batch-to-
// portfolio production service (`batch/batchProductionService.ts`) and
// every UI call site route through the exact same quality-retry decision
// instead of a second, independently-maintained copy of it — "do not
// introduce duplicate business logic" applies to this 2-line routing rule
// just as much as to a real scoring engine.
export function buildTileForGenerate(params: GenerateParams): HeroRetryResult | CommercialRetryResult {
  const isBotanical = params.categoryId === 'botanical' || (params.mixCategoryIds?.includes('botanical') ?? false);
  return isBotanical ? buildTileWithCommercialRetry(params) : buildTileWithHeroRetry(params);
}
