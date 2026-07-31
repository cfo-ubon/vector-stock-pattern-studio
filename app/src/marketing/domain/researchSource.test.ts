import { describe, it, expect } from 'vitest';
import {
  createResearchSource,
  normalizeResearchSource,
  isValidResearchSource,
  isValidResearchSourceType,
  InvalidResearchSourceInputError,
} from './researchSource';

describe('createResearchSource', () => {
  it('produces a well-shaped source with sensible defaults', () => {
    const now = new Date(2026, 6, 18).getTime();
    const source = createResearchSource({ sourceType: 'adobe-stock', sourceTitle: 'Spring floral search results', now });
    expect(source.id).toMatch(/^SRC-\d{8}-[0-9A-Z]{6}$/);
    expect(source.sourceType).toBe('adobe-stock');
    expect(source.sourceTitle).toBe('Spring floral search results');
    expect(source.marketplace).toBeNull();
    expect(source.tags).toEqual([]);
    expect(source.createdAt).toBe(now);
    expect(isValidResearchSource(source)).toBe(true);
  });

  it('rejects an unknown sourceType', () => {
    // @ts-expect-error intentionally invalid input for the runtime guard
    expect(() => createResearchSource({ sourceType: 'twitter', sourceTitle: 'x' })).toThrow(InvalidResearchSourceInputError);
  });

  it('rejects an empty sourceTitle', () => {
    expect(() => createResearchSource({ sourceType: 'pinterest', sourceTitle: '' })).toThrow(InvalidResearchSourceInputError);
  });
});

describe('isValidResearchSourceType', () => {
  it('accepts every documented source type from the brief', () => {
    for (const t of ['shutterstock', 'adobe-stock', 'freepik', 'etsy', 'getty-istock', 'pinterest', 'google-trends', 'seasonal-calendar', 'color-trend-reference', 'user-portfolio-performance', 'sales-report', 'rejection-history', 'manual-observation']) {
      expect(isValidResearchSourceType(t)).toBe(true);
    }
  });

  it('rejects unrelated strings', () => {
    expect(isValidResearchSourceType('instagram')).toBe(false);
    expect(isValidResearchSourceType(42)).toBe(false);
  });
});

describe('normalizeResearchSource', () => {
  it('fills in defaults for a record missing newer optional fields', () => {
    const bare = { id: 'SRC-20260101-ABCDEF', sourceType: 'etsy', sourceTitle: 'x', createdAt: 1000, schemaVersion: 1 } as never;
    const normalized = normalizeResearchSource(bare);
    expect(normalized.tags).toEqual([]);
    expect(normalized.marketplace).toBeNull();
    expect(normalized.searchTerm).toBe('');
  });
});
