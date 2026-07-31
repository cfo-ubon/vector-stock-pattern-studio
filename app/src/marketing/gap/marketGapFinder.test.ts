import { describe, it, expect } from 'vitest';
import { createMarketKeyword } from '../domain/marketKeyword';
import { findMarketGaps } from './marketGapFinder';

describe('findMarketGaps', () => {
  it('finds a real gap: high opportunity, low portfolio coverage', () => {
    const keyword = createMarketKeyword({
      keyword: 'minimal botanical stationery',
      cluster: 'subject',
      evidenceSource: 'USER_OBSERVATION',
      opportunityEstimate: 'high',
      portfolioCoverage: 0,
      now: 1000,
    });
    const gaps = findMarketGaps([keyword]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].keyword).toBe('minimal botanical stationery');
  });

  it('excludes a keyword with high opportunity but already well-covered in the portfolio', () => {
    const keyword = createMarketKeyword({
      keyword: 'covered keyword',
      cluster: 'subject',
      evidenceSource: 'SAMPLE_DATA',
      opportunityEstimate: 'high',
      portfolioCoverage: 10,
      now: 1000,
    });
    expect(findMarketGaps([keyword])).toEqual([]);
  });

  it('excludes a keyword with low/unknown opportunity even if portfolio coverage is zero', () => {
    const keyword = createMarketKeyword({
      keyword: 'low opportunity keyword',
      cluster: 'subject',
      evidenceSource: 'SAMPLE_DATA',
      opportunityEstimate: 'low',
      portfolioCoverage: 0,
      now: 1000,
    });
    expect(findMarketGaps([keyword])).toEqual([]);
  });

  it('sorts gaps by opportunity band, highest first', () => {
    const medium = createMarketKeyword({ keyword: 'medium', cluster: 'subject', evidenceSource: 'SAMPLE_DATA', opportunityEstimate: 'medium', portfolioCoverage: 0, now: 1000 });
    const veryHigh = createMarketKeyword({ keyword: 'very high', cluster: 'subject', evidenceSource: 'SAMPLE_DATA', opportunityEstimate: 'very-high', portfolioCoverage: 0, now: 1000 });
    const gaps = findMarketGaps([medium, veryHigh]);
    expect(gaps[0].keyword).toBe('very high');
  });
});
