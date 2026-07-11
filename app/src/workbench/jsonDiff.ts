// Generic deep-diff for two JSON-shaped values — used by the Design
// Workbench's History panel (Section 6: "Compare versions") to show what
// changed between two Design Specification snapshots. Pure, no
// dependencies; doesn't know anything about DesignSpecification's shape
// specifically, so it works for any JSON-serializable value.

export type JsonDiffKind = 'added' | 'removed' | 'changed';

export interface JsonDiffEntry {
  path: string;
  kind: JsonDiffKind;
  before?: unknown;
  after?: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (isPlainObject(a) && isPlainObject(b)) return JSON.stringify(a) === JSON.stringify(b);
  if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

/** Walks `before`/`after` in parallel, emitting one entry per leaf value
 * that was added, removed, or changed. Object/array keys not present on
 * one side are reported as a single `added`/`removed` entry for that
 * whole subtree rather than recursing further into a side that doesn't
 * exist, so the result stays readable for a Design Spec-sized document. */
export function diffJson(before: unknown, after: unknown, path = '$'): JsonDiffEntry[] {
  if (valuesEqual(before, after)) return [];

  const beforeIsContainer = isPlainObject(before) || Array.isArray(before);
  const afterIsContainer = isPlainObject(after) || Array.isArray(after);

  if (!beforeIsContainer || !afterIsContainer || Array.isArray(before) !== Array.isArray(after)) {
    if (before === undefined) return [{ path, kind: 'added', after }];
    if (after === undefined) return [{ path, kind: 'removed', before }];
    return [{ path, kind: 'changed', before, after }];
  }

  const entries: JsonDiffEntry[] = [];
  if (Array.isArray(before) && Array.isArray(after)) {
    const maxLen = Math.max(before.length, after.length);
    for (let i = 0; i < maxLen; i++) {
      entries.push(...diffJson(before[i], after[i], `${path}[${i}]`));
    }
    return entries;
  }

  const beforeObj = before as Record<string, unknown>;
  const afterObj = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
  for (const key of keys) {
    entries.push(...diffJson(beforeObj[key], afterObj[key], `${path}.${key}`));
  }
  return entries;
}
