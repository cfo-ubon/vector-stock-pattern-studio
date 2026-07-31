import { describe, it, expect } from 'vitest';
import { createMarketKeyword, isValidMarketKeyword, InvalidMarketKeywordInputError } from './marketKeyword';

describe('createMarketKeyword', () => {
  it('creates a well-shaped keyword with a real cluster and evidence source', () => {
    const keyword = createMarketKeyword({ keyword: 'spring floral wallpaper', cluster: 'subject', evidenceSource: 'USER_OBSERVATION', now: 1000 });
    expect(keyword.id).toMatch(/^KW-\d{8}-[0-9A-Z]{6}$/);
    expect(keyword.cluster).toBe('subject');
    expect(isValidMarketKeyword(keyword)).toBe(true);
  });

  it('rejects an empty keyword', () => {
    expect(() => createMarketKeyword({ keyword: '', cluster: 'core', evidenceSource: 'SAMPLE_DATA' })).toThrow(InvalidMarketKeywordInputError);
  });

  it('rejects an unknown cluster', () => {
    // @ts-expect-error intentionally invalid input for the runtime guard
    expect(() => createMarketKeyword({ keyword: 'x', cluster: 'nonsense', evidenceSource: 'SAMPLE_DATA' })).toThrow(InvalidMarketKeywordInputError);
  });
});
