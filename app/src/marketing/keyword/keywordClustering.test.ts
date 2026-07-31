import { describe, it, expect } from 'vitest';
import { createMarketKeyword } from '../domain/marketKeyword';
import { clusterKeywords, findDuplicateKeywordGroups, summarizeClusterCoverage } from './keywordClustering';

describe('clusterKeywords', () => {
  it('groups keywords by their real cluster field, covering every documented cluster', () => {
    const a = createMarketKeyword({ keyword: 'botanical', cluster: 'subject', evidenceSource: 'SAMPLE_DATA', now: 1000 });
    const b = createMarketKeyword({ keyword: 'sage green', cluster: 'color', evidenceSource: 'SAMPLE_DATA', now: 1000 });
    const groups = clusterKeywords([a, b]);
    expect(groups.subject).toEqual([a]);
    expect(groups.color).toEqual([b]);
    expect(groups.core).toEqual([]);
  });
});

describe('findDuplicateKeywordGroups', () => {
  it('finds real structural duplicates by normalized keyword text', () => {
    const a = createMarketKeyword({ keyword: 'Spring Floral', cluster: 'subject', evidenceSource: 'SAMPLE_DATA', now: 1000 });
    const b = createMarketKeyword({ keyword: 'spring floral', cluster: 'subject', evidenceSource: 'USER_OBSERVATION', now: 2000 });
    const c = createMarketKeyword({ keyword: 'geometric', cluster: 'subject', evidenceSource: 'SAMPLE_DATA', now: 3000 });
    const duplicates = findDuplicateKeywordGroups([a, b, c]);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].keyword).toBe('spring floral');
    expect(duplicates[0].entries).toHaveLength(2);
  });

  it('reports no duplicates when every keyword is unique', () => {
    const a = createMarketKeyword({ keyword: 'botanical', cluster: 'subject', evidenceSource: 'SAMPLE_DATA', now: 1000 });
    expect(findDuplicateKeywordGroups([a])).toEqual([]);
  });
});

describe('summarizeClusterCoverage', () => {
  it('sums each keyword real portfolioCoverage value per cluster', () => {
    const a = createMarketKeyword({ keyword: 'a', cluster: 'subject', evidenceSource: 'SAMPLE_DATA', portfolioCoverage: 3, now: 1000 });
    const b = createMarketKeyword({ keyword: 'b', cluster: 'subject', evidenceSource: 'SAMPLE_DATA', portfolioCoverage: 4, now: 1000 });
    const summary = summarizeClusterCoverage([a, b]);
    expect(summary.subject).toBe(7);
    expect(summary.core).toBe(0);
  });
});
