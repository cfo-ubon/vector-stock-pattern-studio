import type { PortfolioPatternRecord } from './types';

// Build 013, Section 9 (Portfolio Clustering). The brief asks for
// "data-derived" clusters, not an externally-imposed taxonomy — but it also
// forbids inventing new machinery with no measurable grounding (no new
// scoring, no fabricated statistic). Rather than bolting on an unrelated
// k-means/embedding library for a one-off report, this module builds
// clusters from two signals this codebase already treats as real and
// meaningful: the declared `(styleDnaId, layoutClass)` segment (Build 012's
// own layout-aware evaluation categories) and the *measured*
// `compositeRankScore` band within that segment (Section 5's own ranking
// output). A cluster is therefore always both explainable ("Premium
// Textile, lattice layouts, top third by measured score") and traceable
// back to real per-tile numbers — never an opaque cluster id with no
// description behind it.

export interface ClusterSummary {
  clusterId: number;
  label: string;
  styleDnaId: string;
  layoutClass: string;
  scoreBand: 'top' | 'mid' | 'bottom';
  size: number;
  avgCompositeRankScore: number;
  avgAbsoluteCommercialQualityV2: number;
  dominantProductTargets: Array<{ value: string; count: number }>;
  dominantFailureModes: Array<{ value: string; count: number }>;
  dominantStrengthTags: Array<{ value: string; count: number }>;
  samplePatternIds: string[];
}

function topCounts(values: string[], max = 3): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([value, count]) => ({ value, count }));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

/** Splits one `(styleDnaId, layoutClass)` segment (already sorted by
 * `compositeRankScore` descending) into top/mid/bottom thirds. Segments
 * with fewer than 9 members (too small to split into 3 groups of >=3
 * without an arbitrary tie-break) are kept as a single "mid" band instead —
 * documented, not silently forced into 3 groups regardless of size. */
function assignBands(segment: PortfolioPatternRecord[]): Map<PortfolioPatternRecord, 'top' | 'mid' | 'bottom'> {
  const bands = new Map<PortfolioPatternRecord, 'top' | 'mid' | 'bottom'>();
  if (segment.length < 9) {
    for (const p of segment) bands.set(p, 'mid');
    return bands;
  }
  const third = Math.floor(segment.length / 3);
  segment.forEach((p, i) => {
    if (i < third) bands.set(p, 'top');
    else if (i < segment.length - third) bands.set(p, 'mid');
    else bands.set(p, 'bottom');
  });
  return bands;
}

function styleLabel(stylePresetLabels: Record<string, string>, styleDnaId: string): string {
  return stylePresetLabels[styleDnaId] ?? styleDnaId;
}

/** Assigns `clusterId`/`clusterLabel` to every record (mutates in place, as
 * `computePortfolioRanking` does) and returns one summary per cluster.
 * `stylePresetLabels` lets callers pass real Style DNA labels
 * (`STYLE_DNA_PRESETS[id].label`) without this module importing the engine
 * layer directly — keeps `src/portfolio/` a one-directional consumer of
 * `src/engine/`, not the reverse. */
export function computePortfolioClusters(patterns: PortfolioPatternRecord[], stylePresetLabels: Record<string, string>): ClusterSummary[] {
  const segments = new Map<string, PortfolioPatternRecord[]>();
  for (const p of patterns) {
    const key = `${p.styleDnaId}::${p.layoutClass}`;
    const group = segments.get(key);
    if (group) group.push(p);
    else segments.set(key, [p]);
  }

  const summaries: ClusterSummary[] = [];
  let clusterId = 0;

  for (const [key, segment] of segments) {
    const [styleDnaId, layoutClass] = key.split('::');
    const sorted = [...segment].sort((a, b) => (b.compositeRankScore ?? 0) - (a.compositeRankScore ?? 0));
    const bands = assignBands(sorted);

    for (const band of ['top', 'mid', 'bottom'] as const) {
      const members = sorted.filter((p) => bands.get(p) === band);
      if (members.length === 0) continue;

      const id = clusterId++;
      const label = `${styleLabel(stylePresetLabels, styleDnaId)} — ${layoutClass} layouts — ${band} tier (n=${members.length}, avg ${average(members.map((p) => p.compositeRankScore ?? 0))})`;
      for (const p of members) {
        p.clusterId = id;
        p.clusterLabel = label;
      }

      summaries.push({
        clusterId: id,
        label,
        styleDnaId,
        layoutClass,
        scoreBand: band,
        size: members.length,
        avgCompositeRankScore: average(members.map((p) => p.compositeRankScore ?? 0)),
        avgAbsoluteCommercialQualityV2: average(members.map((p) => p.absoluteCommercialQualityV2)),
        dominantProductTargets: topCounts(members.map((p) => p.productTarget)),
        dominantFailureModes: topCounts(members.flatMap((p) => p.failureModes)),
        dominantStrengthTags: topCounts(members.flatMap((p) => p.strengthTags)),
        samplePatternIds: members.slice(0, 5).map((p) => p.patternId),
      });
    }
  }

  return summaries.sort((a, b) => b.size - a.size);
}
