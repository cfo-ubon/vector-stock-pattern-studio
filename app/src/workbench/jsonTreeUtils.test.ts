import { describe, it, expect } from 'vitest';
import { collectContainerPaths, collectSearchRevealPaths } from './jsonTreeUtils';

describe('collectContainerPaths', () => {
  it('returns an empty array for a primitive', () => {
    expect(collectContainerPaths(42)).toEqual([]);
  });

  it('collects the root plus every nested object/array path', () => {
    const value = { a: { b: 1 }, c: [1, { d: 2 }] };
    expect(collectContainerPaths(value).sort()).toEqual(['$', '$.a', '$.c', '$.c[1]'].sort());
  });
});

describe('collectSearchRevealPaths', () => {
  const value = { a: { b: 'findme' }, c: [1, 2] };

  it('returns an empty set for a blank search', () => {
    expect(collectSearchRevealPaths(value, '')).toEqual(new Set());
  });

  it('reveals the ancestor chain of a matching leaf value', () => {
    const reveal = collectSearchRevealPaths(value, 'findme');
    expect(reveal.has('$')).toBe(true);
    expect(reveal.has('$.a')).toBe(true);
  });

  it('matches case-insensitively against keys too', () => {
    const reveal = collectSearchRevealPaths({ someKey: 1 }, 'SOMEKEY');
    expect(reveal.has('$')).toBe(true);
  });

  it('does not reveal branches with no match', () => {
    const reveal = collectSearchRevealPaths(value, 'findme');
    expect(reveal.has('$.c')).toBe(false);
  });
});
