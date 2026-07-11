// Pure tree-traversal helpers for the Design Spec Panel's Tree View
// (Section 2's Collapse/Expand + Search) — split out of
// components/workbench/JsonTreeView.tsx so that file only exports
// components (keeps React Fast Refresh working) and so this logic is
// independently unit-testable without rendering anything.

/** Every container (object/array) path under `value` — used to build the
 * "expand all" path set. */
export function collectContainerPaths(value: unknown, path = '$'): string[] {
  if (value === null || typeof value !== 'object') return [];
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value);
  return [path, ...entries.flatMap(([k, v]) => collectContainerPaths(v, Array.isArray(value) ? `${path}[${k}]` : `${path}.${k}`))];
}

/** Paths that should be force-revealed because a descendant leaf (or the
 * node's own key) matches `search` (case-insensitive substring match
 * against the key or the stringified value). */
export function collectSearchRevealPaths(value: unknown, search: string, path = '$'): Set<string> {
  const reveal = new Set<string>();
  const query = search.trim().toLowerCase();
  if (!query) return reveal;

  function walk(node: unknown, nodePath: string, keyLabel: string): boolean {
    const selfMatches = keyLabel.toLowerCase().includes(query) || (typeof node !== 'object' && String(node).toLowerCase().includes(query));
    if (node !== null && typeof node === 'object') {
      const entries = Array.isArray(node) ? node.map((v, i) => [String(i), v] as const) : Object.entries(node);
      let childMatched = false;
      for (const [k, v] of entries) {
        const childPath = Array.isArray(node) ? `${nodePath}[${k}]` : `${nodePath}.${k}`;
        if (walk(v, childPath, k)) childMatched = true;
      }
      if (childMatched) reveal.add(nodePath);
      return childMatched || selfMatches;
    }
    return selfMatches;
  }
  walk(value, path, '');
  return reveal;
}
