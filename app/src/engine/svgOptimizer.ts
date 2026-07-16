import type { SvgNode, TileData } from './types';
import { IDENTITY, matMul, parseTransform, type Matrix } from './svgAst';
import { countNodes } from './svgGeometry';

// SVG Optimizer (SVG Intelligence Engine Phase 3, Section 9) — a pure,
// deterministic post-process pass over an already-built `SvgNode` tree.
// Deliberately conservative: every transformation here is a *provably
// lossless* structural simplification (removes a node or an attribute
// without changing where a single pixel renders, and without reformatting
// a single number), never a visual approximation — this is what keeps it
// safe to apply unconditionally to every export without a visual-
// regression risk. It does not touch path geometry (control points, curve
// shape) at all, so every existing generator's exact silhouette is
// untouched.
//
// Two passes:
//  1. Redundant-group collapse — `tile.ts`'s wrap-instance technique
//     wraps every placed motif in its own `<g transform="...">`, and many
//     generators (anything multi-part: flowers, mandalas, paisleys...)
//     already return their own root `<g>` (occasionally with its own
//     `transform`, e.g. botanical.ts's growth motifs) — collapsing the
//     two into one node removes a `<g>` per motif instance. The combined
//     transform is built by *string concatenation*
//     (`"OUTER_STRING INNER_STRING"`), not by reformatting a computed
//     matrix: the SVG 1.1 spec defines a `transform` attribute's function
//     list as equivalent to the same functions split across nested
//     elements (§7.6), so concatenation is exact — no numeric rounding,
//     no risk of an svg-file consumer that expects a specific
//     `translate(...) rotate(...) scale(...)` shape (e.g.
//     `svgGeometry.ts`'s `extractPrimaryInstance`) seeing a reformatted
//     `matrix(...)` instead. A group is only ever collapsed into its
//     single child when it carries nothing besides `transform` (no `id`,
//     `data-role`, `clip-path`, ...), so `motif-N`/`layer-*` identity and
//     Affinity-visible metadata are never at risk of being dropped.
//  2. No-op transform stripping — a transform that parses (via
//     `svgAst.ts`'s existing `Matrix`/`matMul`/`parseTransform`, the same
//     math `computeBoundingRadius` already trusts) to the exact identity
//     matrix (e.g. a lone `rotate(0)`, or a concatenation that
//     mathematically cancels out) is removed from the attribute list
//     entirely, since it has zero visual effect and only adds noise for
//     anyone reading the exported markup in Affinity Designer's XML view.
//
// Precision is not re-rounded here: every coordinate this codebase emits
// already goes through `svgAst.ts`'s `round()` (3 decimals) at the point
// it's written, so there is nothing left to clean up post-hoc — see
// `engine/svgStructuralAudit.test.ts`'s existing decimal-precision check,
// which this module does not need to duplicate.

export interface OptimizationReport {
  nodesBefore: number;
  nodesAfter: number;
  nodesRemoved: number;
  /** Percent node-count reduction, 0-100. */
  reductionPercent: number;
  groupsCollapsed: number;
  transformsStripped: number;
}

function isIdentity(m: Matrix): boolean {
  return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0;
}

function matrixOf(transform: string | number | undefined): Matrix {
  return transform !== undefined ? parseTransform(String(transform)) : IDENTITY;
}

/** True when every attribute this node carries is `transform` (including
 * none at all) — the only shape a group is safe to dissolve into its
 * child, since any other attribute (`id`, `data-role`, `clip-path`, a
 * fill/stroke override on the group...) could be load-bearing. */
function hasOnlyTransformAttr(node: SvgNode): boolean {
  const keys = Object.keys(node.attrs ?? {});
  return keys.every((k) => k === 'transform');
}

/** Concatenates two `transform` attribute values exactly per the SVG
 * spec's function-list semantics — outer's functions apply after inner's,
 * same as nesting the two elements. Returns `undefined` (omit the
 * attribute) only when the *combined* matrix is the identity, not merely
 * when either string alone happens to look trivial. */
function combineTransforms(outer: string | number | undefined, inner: string | number | undefined): string | undefined {
  const combinedMatrix = matMul(matrixOf(outer), matrixOf(inner));
  if (isIdentity(combinedMatrix)) return undefined;
  return [outer, inner].filter((v) => v !== undefined).join(' ');
}

interface MutableCounters {
  groupsCollapsed: number;
  transformsStripped: number;
}

function optimizeNode(node: SvgNode, counters: MutableCounters): SvgNode {
  const children = (node.children ?? []).map((c) => optimizeNode(c, counters));

  if (node.tag === 'g' && hasOnlyTransformAttr(node) && children.length === 1 && children[0].tag === 'g') {
    const inner = children[0];
    const combined = combineTransforms(node.attrs?.transform, inner.attrs?.transform);
    counters.groupsCollapsed++;
    const nextAttrs = { ...(inner.attrs ?? {}) };
    if (combined !== undefined) nextAttrs.transform = combined;
    else delete nextAttrs.transform;
    return { ...inner, attrs: Object.keys(nextAttrs).length > 0 ? nextAttrs : undefined, children: inner.children };
  }

  if (node.attrs?.transform !== undefined && isIdentity(matrixOf(node.attrs.transform))) {
    const { transform: _drop, ...rest } = node.attrs;
    counters.transformsStripped++;
    return { ...node, attrs: Object.keys(rest).length > 0 ? rest : undefined, children };
  }

  return node.children ? { ...node, children } : node;
}

/** Optimizes one `SvgNode` tree, returning a new tree (input is never
 * mutated) plus a report of what changed. Safe to call on any subtree —
 * used both on a whole tile and (in future) individual Collection
 * assets. */
export function optimizeSvgTree(root: SvgNode): { node: SvgNode; report: OptimizationReport } {
  const nodesBefore = countNodes(root);
  const counters: MutableCounters = { groupsCollapsed: 0, transformsStripped: 0 };
  const node = optimizeNode(root, counters);
  const nodesAfter = countNodes(node);
  return {
    node,
    report: {
      nodesBefore,
      nodesAfter,
      nodesRemoved: nodesBefore - nodesAfter,
      reductionPercent: nodesBefore > 0 ? Math.round(((nodesBefore - nodesAfter) / nodesBefore) * 1000) / 10 : 0,
      groupsCollapsed: counters.groupsCollapsed,
      transformsStripped: counters.transformsStripped,
    },
  };
}

/** Convenience wrapper for the common case of optimizing a whole tile's
 * `svg` field. */
export function optimizeTileData(tileData: TileData): { tileData: TileData; report: OptimizationReport } {
  const { node, report } = optimizeSvgTree(tileData.svg);
  return { tileData: { ...tileData, svg: node }, report };
}
