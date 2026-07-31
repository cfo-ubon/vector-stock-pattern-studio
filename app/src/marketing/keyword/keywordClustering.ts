import type { MarketKeyword, KeywordCluster } from '../domain/marketKeyword';
import { KEYWORD_CLUSTER_VALUES } from '../domain/marketKeyword';

// Build 028, Module 1 Section 5 — groups a flat keyword list into the 8
// documented clusters. Pure and read-only: clustering here means "group by
// the `cluster` field the keyword was tagged with," not an ML-style
// automatic categorization this build has no real data source to justify.

export type KeywordClusterGroups = Record<KeywordCluster, MarketKeyword[]>;

export function clusterKeywords(keywords: MarketKeyword[]): KeywordClusterGroups {
  const groups = Object.fromEntries(KEYWORD_CLUSTER_VALUES.map((c) => [c, [] as MarketKeyword[]])) as KeywordClusterGroups;
  for (const keyword of keywords) {
    groups[keyword.cluster].push(keyword);
  }
  return groups;
}

export interface KeywordDuplicateGroup {
  keyword: string;
  entries: MarketKeyword[];
}

/** Section 5's "duplicate risk" support — real, structural duplicate
 * detection (same normalized keyword text tracked more than once), not a
 * fabricated risk score. Callers combine this with each entry's own
 * `duplicateRisk` band for the full picture. */
export function findDuplicateKeywordGroups(keywords: MarketKeyword[]): KeywordDuplicateGroup[] {
  const byNormalized = new Map<string, MarketKeyword[]>();
  for (const keyword of keywords) {
    const normalized = keyword.keyword.trim().toLowerCase();
    if (!normalized) continue;
    const bucket = byNormalized.get(normalized) ?? [];
    bucket.push(keyword);
    byNormalized.set(normalized, bucket);
  }
  const duplicates: KeywordDuplicateGroup[] = [];
  for (const [normalized, entries] of byNormalized) {
    if (entries.length > 1) {
      duplicates.push({ keyword: normalized, entries });
    }
  }
  return duplicates;
}

/** Section 5's "portfolio coverage" rollup per cluster — a real count from
 * each keyword's own `portfolioCoverage` field, summed per cluster, so the
 * Marketing dashboard can show "botanical subject keywords: 12 patterns in
 * portfolio" without recomputing anything the keyword records don't
 * already carry. */
export function summarizeClusterCoverage(keywords: MarketKeyword[]): Record<KeywordCluster, number> {
  const groups = clusterKeywords(keywords);
  const summary = {} as Record<KeywordCluster, number>;
  for (const cluster of KEYWORD_CLUSTER_VALUES) {
    summary[cluster] = groups[cluster].reduce((sum, k) => sum + k.portfolioCoverage, 0);
  }
  return summary;
}
