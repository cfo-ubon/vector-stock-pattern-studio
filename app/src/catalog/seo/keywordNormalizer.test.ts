import { describe, it, expect } from 'vitest';
import { normalizeKeyword, normalizeKeywords } from './keywordNormalizer';

describe('normalizeKeyword', () => {
  it('trims, lowercases, and collapses internal whitespace', () => {
    expect(normalizeKeyword('  Seamless   Floral  Pattern  ')).toBe('seamless floral pattern');
  });
  it('is idempotent', () => {
    const once = normalizeKeyword('Boho Print');
    expect(normalizeKeyword(once)).toBe(once);
  });
});

describe('normalizeKeywords', () => {
  it('normalizes every entry and drops whitespace-only ones', () => {
    expect(normalizeKeywords(['Floral', '  ', 'Spring  Pattern', ''])).toEqual(['floral', 'spring pattern']);
  });
});
