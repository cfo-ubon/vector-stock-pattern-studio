import type { PortfolioPatternRecord } from './types';

// Build 013, Section 5 (Ranking and Percentiles). Every rank/percentile
// below is computed purely from fields `PortfolioPatternRecord` already
// carries (Section 3/4) — no new score is invented to rank by; the one new
// number this module adds, `compositeRankScore`, is an unweighted average of
// five already-real 0-100 scores that were each independently computed by
// Build 011/012's own evaluators (`absoluteCommercialQualityV2`,
// `commercialAppealV2Overall`, `luxuryCompositionOverall`,
// `surfacePatternSuitability`, `productTargetScore`). An unweighted average
// is used deliberately — inventing per-signal weights with no evidence
// behind them would be exactly the kind of "arbitrary number" the brief
// forbids; an equal-weight blend is the only composite that requires no
// additional, unjustifiable assumption.

/** Higher composite = commercially stronger. Every input is already a
 * 0-100 scale score computed elsewhere in the pipeline. */
export function computeCompositeRankScore(p: PortfolioPatternRecord): number {
  const signals = [p.absoluteCommercialQualityV2, p.commercialAppealV2Overall, p.luxuryCompositionOverall, p.surfacePatternSuitability, p.productTargetScore];
  return signals.reduce((a, b) => a + b, 0) / signals.length;
}

/** Ranks a group of (index, score) pairs, highest score = rank 1. Ties share
 * the same rank (standard competition ranking, "1224" style) so identical
 * composite scores are never arbitrarily ordered against each other. */
function rankIndices(scores: number[]): number[] {
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
  const ranks = new Array<number>(scores.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && scores[order[j + 1]] === scores[order[i]]) j++;
    const rank = i + 1;
    for (let k = i; k <= j; k++) ranks[order[k]] = rank;
    i = j + 1;
  }
  return ranks;
}

/** Percentile (0-100) of "what fraction of the group this pattern
 * outperforms or ties" — 100 = best in group, 0 = worst. `n === 1` returns
 * 100 (a group of one has nothing to be outranked by). */
function percentileFromRank(rank: number, n: number): number {
  if (n <= 1) return 100;
  return Math.round(((n - rank) / (n - 1)) * 1000) / 10;
}

function percentileBucket(percentile: number): PortfolioPatternRecord['percentileBucket'] {
  if (percentile >= 99) return 'top1';
  if (percentile >= 95) return 'top5';
  if (percentile >= 90) return 'top10';
  if (percentile <= 1) return 'bottom1';
  if (percentile <= 5) return 'bottom5';
  if (percentile <= 10) return 'bottom10';
  if (percentile >= 25 && percentile <= 75) return 'middle50';
  return 'other';
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key);
    if (group) group.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function applyScopedRanks(patterns: PortfolioPatternRecord[], scores: number[], assign: (p: PortfolioPatternRecord, rank: number, percentile: number) => void) {
  const ranks = rankIndices(scores);
  patterns.forEach((p, i) => {
    const rank = ranks[i];
    const percentile = percentileFromRank(rank, patterns.length);
    assign(p, rank, percentile);
  });
}

/** Fills in every Section 5 field on every record: overall rank/percentile
 * across the whole portfolio, plus rank scoped within this pattern's own
 * preset/product/layout group (a pattern that ranks modestly overall can
 * still be the strongest example of its own preset — both numbers are kept
 * so neither view is lost). Mutates and returns the same array (Section 4's
 * generation already holds the full manifest in memory; a copy would double
 * memory for no benefit at 5,000-record scale). */
export function computePortfolioRanking(patterns: PortfolioPatternRecord[]): PortfolioPatternRecord[] {
  for (const p of patterns) p.compositeRankScore = computeCompositeRankScore(p);

  applyScopedRanks(patterns, patterns.map(computeCompositeRankScore), (p, rank, percentile) => {
    p.rankOverall = rank;
    p.percentileOverall = percentile;
    p.percentileBucket = percentileBucket(percentile);
  });

  for (const group of groupBy(patterns, (p) => p.styleDnaId).values()) {
    applyScopedRanks(group, group.map(computeCompositeRankScore), (p, rank, percentile) => {
      p.rankWithinPreset = rank;
      p.percentileWithinPreset = percentile;
    });
  }

  for (const group of groupBy(patterns, (p) => p.productTarget).values()) {
    applyScopedRanks(group, group.map(computeCompositeRankScore), (p, rank) => {
      p.rankWithinProduct = rank;
    });
  }

  for (const group of groupBy(patterns, (p) => p.layoutId).values()) {
    applyScopedRanks(group, group.map(computeCompositeRankScore), (p, rank) => {
      p.rankWithinLayout = rank;
    });
  }

  return patterns;
}
