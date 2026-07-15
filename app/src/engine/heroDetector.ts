import type { GenerateParams, TileData } from './types';
import { buildTile } from './tile';
import { computeMetrics, computeHeroVisibilityScore, type CompositionMetrics } from './scoring';
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
