// AI-SBOS v3, Milestone 7 — Vector Integrity Gate. A positive
// whitelist audit on top of the existing blacklist check
// (`checkSvgStringValidity` in `engine/candidateEngine.ts`, which only
// rejects raster/external-ref/NaN content but doesn't assert every node
// IS a vector primitive). Walks the real `SvgNode` AST `buildTile`
// produces — the same AST both the on-screen preview and the exported
// .svg render from, so this gate inspects exactly what will ship, not a
// re-serialized approximation.
import type { SvgNode, SvgTag, TileData } from '../engine/types';
import { checkSvgStringValidity } from '../engine/candidateEngine';
import { buildPreviewMarkup } from '../export/previewMarkup';

const ALLOWED_TAGS: ReadonlySet<SvgTag> = new Set<SvgTag>(['g', 'path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'line', 'clipPath', 'defs', 'pattern', 'svg']);

export interface VectorIntegrityIssue {
  code: 'disallowed-tag' | 'raster-blacklist' | 'nan-attribute' | 'empty-group';
  detail: string;
}

export interface VectorIntegrityResult {
  status: 'VECTOR_PASS' | 'VECTOR_BLOCKED';
  issues: VectorIntegrityIssue[];
  nodeCount: number;
}

function walk(node: SvgNode, issues: VectorIntegrityIssue[], counter: { count: number }): void {
  counter.count += 1;
  if (!ALLOWED_TAGS.has(node.tag)) {
    issues.push({ code: 'disallowed-tag', detail: `<${node.tag}> is not one of the allowed vector primitives` });
  }
  if (node.attrs) {
    for (const [key, value] of Object.entries(node.attrs)) {
      if (typeof value === 'number' && !Number.isFinite(value)) {
        issues.push({ code: 'nan-attribute', detail: `attribute "${key}" on <${node.tag}> is not a finite number` });
      }
      if ((key === 'href' || key === 'xlink:href') && typeof value === 'string' && !value.startsWith('#')) {
        issues.push({ code: 'raster-blacklist', detail: `<${node.tag}> references an external resource via "${key}"` });
      }
    }
  }
  if ((node.tag === 'g' || node.tag === 'clipPath' || node.tag === 'defs') && (!node.children || node.children.length === 0)) {
    issues.push({ code: 'empty-group', detail: `<${node.tag}> has no children` });
  }
  for (const child of node.children ?? []) {
    walk(child, issues, counter);
  }
}

/** Real gate: PASS only if the AST is 100% built from allowed vector
 * primitives AND the existing blacklist check (raster `<image>`,
 * external refs, NaN/Infinity in the serialized string) also passes. A
 * VECTOR_BLOCKED asset can never become Commercial READY (Milestone 13). */
export function runVectorIntegrityGate(tileData: TileData): VectorIntegrityResult {
  const issues: VectorIntegrityIssue[] = [];
  const counter = { count: 0 };
  walk(tileData.svg, issues, counter);

  // Cross-check against the existing string-level blacklist too — belt
  // and suspenders, reusing rather than re-implementing that logic.
  const serialized = buildPreviewMarkup(tileData, 1, 'vector-integrity-check');
  const stringCheck = checkSvgStringValidity(serialized);
  if (!stringCheck.valid) {
    for (const issue of stringCheck.issues) {
      issues.push({ code: 'raster-blacklist', detail: issue });
    }
  }

  return {
    status: issues.length === 0 ? 'VECTOR_PASS' : 'VECTOR_BLOCKED',
    issues,
    nodeCount: counter.count,
  };
}
