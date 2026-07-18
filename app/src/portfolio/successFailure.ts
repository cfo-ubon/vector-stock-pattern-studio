import type { PortfolioPatternRecord } from './types';
import { computeSampleConfidence, type ConfidenceTier } from './confidence';

// Build 013, Section 6 (Success Pattern Discovery) and Section 7 (Failure
// Pattern Discovery). Both sections ask the same real question in opposite
// directions — "what real, declared/measured traits are over-represented in
// the patterns that already scored well/poorly" — so they share one
// mechanism: compare how often a trait value appears in a scored subgroup
// (top or bottom percentile bucket, already computed by Section 5's
// `computePortfolioRanking`) against how often it appears in the whole
// portfolio. A trait genuinely "discovered", not asserted, is one whose
// lift (subgroup frequency / population frequency) is measurably above 1
// AND whose sample size clears `computeSampleConfidence`'s real 30-sample
// floor — a trait that only appears twice in a 50-pattern success bucket is
// reported as Low confidence, never hidden, never inflated.

export interface TraitFinding {
  traitName: string;
  value: string;
  /** How many subgroup members carry this trait value. */
  occurrences: number;
  subgroupSize: number;
  populationSize: number;
  /** Fraction of the whole portfolio carrying this trait value. */
  populationFraction: number;
  /** Fraction of the subgroup carrying this trait value. */
  subgroupFraction: number;
  /** subgroupFraction / populationFraction — 1.0 means "no association",
   * >1 means over-represented in the subgroup, <1 under-represented. */
  lift: number;
  confidence: ConfidenceTier;
  reason: string;
}

type TraitExtractor = (p: PortfolioPatternRecord) => string[];

const SINGLE_VALUE_TRAITS: Record<string, (p: PortfolioPatternRecord) => string | undefined> = {
  styleDnaId: (p) => p.styleDnaId,
  layoutId: (p) => p.layoutId,
  layoutClass: (p) => p.layoutClass,
  productTarget: (p) => p.productTarget,
  botanicalFamily: (p) => p.botanicalFamily,
  colorStrategy: (p) => p.colorStrategy,
  clusterType: (p) => p.clusterType,
  heroStructure: (p) => p.heroStructure,
  compositionZone: (p) => p.compositionZone,
};

const MULTI_VALUE_TRAITS: Record<string, TraitExtractor> = {
  strengthTag: (p) => p.strengthTags,
  failureMode: (p) => p.failureModes,
};

function traitValueCounts(patterns: PortfolioPatternRecord[], traitName: string): Map<string, number> {
  const counts = new Map<string, number>();
  const single = SINGLE_VALUE_TRAITS[traitName];
  const multi = MULTI_VALUE_TRAITS[traitName];
  for (const p of patterns) {
    const values = single ? [single(p)].filter((v): v is string => v !== undefined) : multi ? multi(p) : [];
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}

/** Coverage fraction for a trait finding's confidence: what share of this
 * trait's own distinct observed values (in the whole population) the
 * subgroup's occurrence set touches — a subgroup dominated by 1 of 15
 * possible styleDnaId values has low "coverage" of the taxonomy even at
 * high sample size, matching the brief's "coverage of the taxonomy" idea
 * from Section 10. */
function coverageFraction(populationCounts: Map<string, number>, subgroupCounts: Map<string, number>): number {
  const totalDistinct = populationCounts.size;
  if (totalDistinct === 0) return 1;
  const touched = [...subgroupCounts.keys()].filter((k) => subgroupCounts.get(k)! > 0).length;
  return touched / totalDistinct;
}

function findingsForTrait(traitName: string, population: PortfolioPatternRecord[], subgroup: PortfolioPatternRecord[], compositeScores: (p: PortfolioPatternRecord) => number): TraitFinding[] {
  const populationCounts = traitValueCounts(population, traitName);
  const subgroupCounts = traitValueCounts(subgroup, traitName);
  const coverage = coverageFraction(populationCounts, subgroupCounts);
  const findings: TraitFinding[] = [];

  for (const [value, occurrences] of subgroupCounts) {
    const populationCount = populationCounts.get(value) ?? 0;
    const populationFraction = populationCount / population.length;
    const subgroupFraction = occurrences / subgroup.length;
    const lift = populationFraction > 0 ? subgroupFraction / populationFraction : subgroupFraction > 0 ? Infinity : 0;

    const matchingScores = subgroup.filter((p) => {
      const single = SINGLE_VALUE_TRAITS[traitName];
      const multi = MULTI_VALUE_TRAITS[traitName];
      if (single) return single(p) === value;
      if (multi) return multi(p).includes(value);
      return false;
    }).map(compositeScores);

    const sampleConfidence = computeSampleConfidence({ sampleSize: occurrences, values: matchingScores, coverageFraction: coverage });

    findings.push({
      traitName,
      value,
      occurrences,
      subgroupSize: subgroup.length,
      populationSize: population.length,
      populationFraction: Math.round(populationFraction * 1000) / 1000,
      subgroupFraction: Math.round(subgroupFraction * 1000) / 1000,
      lift: Number.isFinite(lift) ? Math.round(lift * 100) / 100 : lift,
      confidence: sampleConfidence.tier,
      reason: sampleConfidence.reason,
    });
  }

  return findings.sort((a, b) => b.lift - a.lift);
}

const ALL_TRAIT_NAMES = [...Object.keys(SINGLE_VALUE_TRAITS), ...Object.keys(MULTI_VALUE_TRAITS)];

const TOP_PERCENTILE_FLOOR: Record<'top1' | 'top5' | 'top10', number> = { top1: 99, top5: 95, top10: 90 };
const BOTTOM_PERCENTILE_CEILING: Record<'bottom1' | 'bottom5' | 'bottom10', number> = { bottom1: 1, bottom5: 5, bottom10: 10 };

/** Section 6: which real traits are over-represented in the top-performing
 * slice of the portfolio. Deliberately cumulative — "top10" means
 * `percentileOverall >= 90`, i.e. includes the top1/top5 tiers nested
 * inside it (the standard meaning of "top decile"), NOT an exact-match on
 * `percentileBucket` (which Section 5 keeps mutually exclusive purely as a
 * compact per-pattern label). Only findings with `lift > 1` are kept — an
 * under-represented or neutral trait is not a "success pattern". */
export function discoverSuccessPatterns(patterns: PortfolioPatternRecord[], bucket: 'top1' | 'top5' | 'top10' = 'top10'): TraitFinding[] {
  const floor = TOP_PERCENTILE_FLOOR[bucket];
  const subgroup = patterns.filter((p) => (p.percentileOverall ?? -1) >= floor);
  if (subgroup.length === 0) return [];
  const compositeScores = (p: PortfolioPatternRecord) => p.compositeRankScore ?? 0;
  const all = ALL_TRAIT_NAMES.flatMap((trait) => findingsForTrait(trait, patterns, subgroup, compositeScores));
  return all.filter((f) => f.lift > 1).sort((a, b) => b.lift - a.lift);
}

/** Section 7: the mirror image — real traits over-represented in the
 * bottom-performing slice (cumulative bottom decile by default, same
 * "inclusive of the more extreme tiers" semantics as `discoverSuccessPatterns`).
 * Reported the same way, including `failureMode` tag frequency, so a report
 * can say e.g. "`gridAppearance` appears in 41% of bottom-decile tiles vs 6%
 * overall (lift 6.8x, High confidence)" with the exact numbers behind it. */
export function discoverFailurePatterns(patterns: PortfolioPatternRecord[], bucket: 'bottom1' | 'bottom5' | 'bottom10' = 'bottom10'): TraitFinding[] {
  const ceiling = BOTTOM_PERCENTILE_CEILING[bucket];
  const subgroup = patterns.filter((p) => (p.percentileOverall ?? 101) <= ceiling);
  if (subgroup.length === 0) return [];
  const compositeScores = (p: PortfolioPatternRecord) => p.compositeRankScore ?? 0;
  const all = ALL_TRAIT_NAMES.flatMap((trait) => findingsForTrait(trait, patterns, subgroup, compositeScores));
  return all.filter((f) => f.lift > 1).sort((a, b) => b.lift - a.lift);
}
