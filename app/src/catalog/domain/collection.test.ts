import { describe, it, expect } from 'vitest';
import {
  createCollection,
  normalizeCollection,
  normalizeCollectionName,
  validateCollectionName,
  isValidCollection,
  InvalidCollectionNameError,
  COLLECTION_NAME_MAX_LENGTH,
  COLLECTION_SCHEMA_VERSION,
  type Collection,
} from './collection';
import { isValidCollectionId } from './id';

describe('validateCollectionName / createCollection — validation (Rule 1)', () => {
  it('rejects an empty name', () => {
    expect(() => validateCollectionName('')).toThrow(InvalidCollectionNameError);
  });

  it('rejects a whitespace-only name', () => {
    expect(() => validateCollectionName('   \t  ')).toThrow(InvalidCollectionNameError);
  });

  it('rejects a name longer than the maximum length', () => {
    const tooLong = 'x'.repeat(COLLECTION_NAME_MAX_LENGTH + 1);
    expect(() => validateCollectionName(tooLong)).toThrow(InvalidCollectionNameError);
  });

  it('accepts a name exactly at the maximum length', () => {
    const exact = 'x'.repeat(COLLECTION_NAME_MAX_LENGTH);
    expect(validateCollectionName(exact)).toHaveLength(COLLECTION_NAME_MAX_LENGTH);
  });

  it('trims surrounding whitespace and collapses internal runs', () => {
    expect(validateCollectionName('  Spring   Florals  ')).toBe('Spring Florals');
  });

  it('createCollection throws for an empty name (never persists an invalid record)', () => {
    expect(() => createCollection({ name: '' })).toThrow(InvalidCollectionNameError);
  });
});

describe('normalizeCollectionName — case-insensitive duplicate-detection key', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeCollectionName('  Spring   FLORALS  ')).toBe('spring florals');
  });

  it('two differently-cased/spaced names normalize to the same key', () => {
    expect(normalizeCollectionName('Etsy Q3')).toBe(normalizeCollectionName('  etsy   q3 '));
  });
});

describe('createCollection — identity, defaults, timestamps', () => {
  it('generates a valid, unique COL- id', () => {
    const a = createCollection({ name: 'A' });
    const b = createCollection({ name: 'B' });
    expect(isValidCollectionId(a.id)).toBe(true);
    expect(a.id).not.toBe(b.id);
  });

  it('defaults description to empty string and coverAssetId to null', () => {
    const c = createCollection({ name: 'No Extras' });
    expect(c.description).toBe('');
    expect(c.coverAssetId).toBeNull();
  });

  it('defaults isArchived to false and archivedAt to null', () => {
    const c = createCollection({ name: 'Active by default' });
    expect(c.isArchived).toBe(false);
    expect(c.archivedAt).toBeNull();
  });

  it('sets schemaVersion to the current COLLECTION_SCHEMA_VERSION', () => {
    const c = createCollection({ name: 'Versioned' });
    expect(c.schemaVersion).toBe(COLLECTION_SCHEMA_VERSION);
  });

  it('accepts an injectable `now` for deterministic timestamps in tests', () => {
    const fixedNow = 1700000000000;
    const c = createCollection({ name: 'Deterministic', now: fixedNow });
    expect(c.createdAt).toBe(fixedNow);
    expect(c.updatedAt).toBe(fixedNow);
  });

  it('accepts an explicit coverAssetId and description', () => {
    const c = createCollection({ name: 'With extras', description: 'A short blurb', coverAssetId: 'VSP-20260101-ABCDEF' });
    expect(c.coverAssetId).toBe('VSP-20260101-ABCDEF');
    expect(c.description).toBe('A short blurb');
  });

  it('passes isValidCollection', () => {
    expect(isValidCollection(createCollection({ name: 'Valid' }))).toBe(true);
  });
});

describe('normalizeCollection — defensive loading of older/partial records (Rule: no crash on schema drift)', () => {
  it('fills in missing fields with safe defaults', () => {
    const partial = {
      id: 'COL-20260101-AAAAAA',
      name: 'Legacy',
      createdAt: 1,
      updatedAt: 1,
      isArchived: false,
    } as unknown as Collection;
    const normalized = normalizeCollection(partial);
    expect(normalized.description).toBe('');
    expect(normalized.coverAssetId).toBeNull();
    expect(normalized.archivedAt).toBeNull();
    expect(normalized.schemaVersion).toBe(COLLECTION_SCHEMA_VERSION);
    expect(normalized.normalizedName).toBe('legacy');
  });

  it('preserves already-correct fields unchanged', () => {
    const full = createCollection({ name: 'Already Normalized', now: 12345 });
    const normalized = normalizeCollection(full);
    expect(normalized).toEqual(full);
  });
});

describe('isValidCollection', () => {
  it('rejects null/non-objects', () => {
    expect(isValidCollection(null)).toBe(false);
    expect(isValidCollection('not a collection')).toBe(false);
  });

  it('rejects an object missing required fields', () => {
    expect(isValidCollection({ id: 'COL-1' })).toBe(false);
  });
});
