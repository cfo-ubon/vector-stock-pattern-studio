import { describe, it, expect } from 'vitest';
import { listTrendPacks, getTrendPack, findTrendPacksBySeason, findTrendPacksByCompositionStyle, findTrendPacksByPatternType } from './trendPackService';

describe('trendPackService', () => {
  it('listTrendPacks returns all 4 quarterly packs', () => {
    expect(listTrendPacks()).toHaveLength(4);
  });

  it('getTrendPack resolves a real id and returns undefined for an unknown one', () => {
    expect(getTrendPack('2026-Q1')?.id).toBe('2026-Q1');
    expect(getTrendPack('not-real')).toBeUndefined();
  });

  it('findTrendPacksBySeason includes exact-season and yearRound packs only', () => {
    const results = findTrendPacksBySeason('summer');
    expect(results.length).toBeGreaterThan(0);
    for (const pack of results) {
      expect(['summer', 'yearRound']).toContain(pack.season);
    }
  });

  it('findTrendPacksByCompositionStyle filters correctly', () => {
    const results = findTrendPacksByCompositionStyle('balanced');
    for (const pack of results) {
      expect(pack.compositionStyle).toBe('balanced');
    }
  });

  it('findTrendPacksByPatternType only returns packs listing that pattern type', () => {
    const all = listTrendPacks();
    const target = all[0].patternTypes[0];
    const results = findTrendPacksByPatternType(target);
    expect(results.length).toBeGreaterThan(0);
    for (const pack of results) {
      expect(pack.patternTypes).toContain(target);
    }
  });
});
