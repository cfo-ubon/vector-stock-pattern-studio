import { describe, it, expect } from 'vitest';
import { diffJson } from './jsonDiff';

describe('jsonDiff', () => {
  it('returns no entries for identical values', () => {
    expect(diffJson({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] })).toEqual([]);
  });

  it('reports a changed leaf value with its path', () => {
    const entries = diffJson({ a: 1 }, { a: 2 });
    expect(entries).toEqual([{ path: '$.a', kind: 'changed', before: 1, after: 2 }]);
  });

  it('reports an added key', () => {
    const entries = diffJson({ a: 1 }, { a: 1, b: 2 });
    expect(entries).toEqual([{ path: '$.b', kind: 'added', after: 2 }]);
  });

  it('reports a removed key', () => {
    const entries = diffJson({ a: 1, b: 2 }, { a: 1 });
    expect(entries).toEqual([{ path: '$.b', kind: 'removed', before: 2 }]);
  });

  it('recurses into nested objects', () => {
    const entries = diffJson({ a: { x: 1, y: 2 } }, { a: { x: 1, y: 3 } });
    expect(entries).toEqual([{ path: '$.a.y', kind: 'changed', before: 2, after: 3 }]);
  });

  it('diffs arrays by index', () => {
    const entries = diffJson([1, 2, 3], [1, 9, 3]);
    expect(entries).toEqual([{ path: '$[1]', kind: 'changed', before: 2, after: 9 }]);
  });

  it('reports an array growing as an added element', () => {
    const entries = diffJson([1], [1, 2]);
    expect(entries).toEqual([{ path: '$[1]', kind: 'added', after: 2 }]);
  });

  it('treats a type change (object -> primitive) as one changed entry, not a recursion', () => {
    const entries = diffJson({ a: { x: 1 } }, { a: 'now a string' });
    expect(entries).toEqual([{ path: '$.a', kind: 'changed', before: { x: 1 }, after: 'now a string' }]);
  });

  it('treats an array vs object at the same path as a changed entry, not a merge', () => {
    const entries = diffJson({ a: [1, 2] }, { a: { x: 1 } });
    expect(entries).toEqual([{ path: '$.a', kind: 'changed', before: [1, 2], after: { x: 1 } }]);
  });
});
