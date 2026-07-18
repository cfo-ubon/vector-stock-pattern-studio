import { describe, it, expect } from 'vitest';
import {
  addCollectionMembership,
  removeCollectionMembership,
  dedupeCollectionIds,
  removeInvalidMemberships,
} from './collectionMembership';

describe('addCollectionMembership', () => {
  it('adds a new collection id', () => {
    expect(addCollectionMembership([], 'COL-1')).toEqual(['COL-1']);
  });

  it('does not add a duplicate (Rule 4)', () => {
    const result = addCollectionMembership(['COL-1'], 'COL-1');
    expect(result).toEqual(['COL-1']);
  });

  it('returns the same array reference when already present (cheap no-op detection)', () => {
    const ids = ['COL-1', 'COL-2'];
    expect(addCollectionMembership(ids, 'COL-1')).toBe(ids);
  });

  it('preserves existing membership when adding a second collection', () => {
    expect(addCollectionMembership(['COL-1'], 'COL-2')).toEqual(['COL-1', 'COL-2']);
  });
});

describe('removeCollectionMembership', () => {
  it('removes a present collection id', () => {
    expect(removeCollectionMembership(['COL-1', 'COL-2'], 'COL-1')).toEqual(['COL-2']);
  });

  it('is a no-op for an absent id', () => {
    expect(removeCollectionMembership(['COL-2'], 'COL-1')).toEqual(['COL-2']);
  });

  it('returns the same array reference when nothing changes', () => {
    const ids = ['COL-2'];
    expect(removeCollectionMembership(ids, 'COL-1')).toBe(ids);
  });
});

describe('dedupeCollectionIds', () => {
  it('removes duplicates while preserving first-seen order', () => {
    expect(dedupeCollectionIds(['COL-1', 'COL-2', 'COL-1', 'COL-3', 'COL-2'])).toEqual(['COL-1', 'COL-2', 'COL-3']);
  });

  it('handles an already-deduped list', () => {
    expect(dedupeCollectionIds(['COL-1'])).toEqual(['COL-1']);
  });
});

describe('removeInvalidMemberships', () => {
  it('removes only the ids present in the invalid set', () => {
    const result = removeInvalidMemberships(['COL-1', 'COL-2', 'COL-3'], new Set(['COL-2']));
    expect(result).toEqual(['COL-1', 'COL-3']);
  });

  it('returns the same array reference when nothing is invalid', () => {
    const ids = ['COL-1'];
    expect(removeInvalidMemberships(ids, new Set(['COL-9']))).toBe(ids);
  });
});
