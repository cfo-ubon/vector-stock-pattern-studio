// Build 013, Section 8 (Similarity and Duplicate Intelligence).
// BUILD_013_AUDIT.md confirmed no per-tile, portfolio-scale similarity
// mechanism exists anywhere in this codebase — `engine/candidateEngine.ts`'s
// `rejectExactDuplicates` only ever compares candidates within one
// generation session (serialized-SVG byte equality), and
// `engine/portfolioQuality.ts`'s fingerprint/diversity functions operate at
// the *preset* level (are the 15 Style DNA presets distinguishable from
// each other), never per-tile. This module is genuinely new, built entirely
// from already-real signals: declared Style DNA/layout/product fields
// (`buildPortfolioParams`'s own resolved `GenerateParams`) and the real
// shape-topology signatures `engine/svgGeometry.ts`'s
// `extractMotifShapeSignatures` already extracts for `motifShapeDiversity`
// — no new geometry measurement invented.
//
// The brief explicitly warns "avoid treating all same-collection designs as
// duplicates" — this module never compares two tiles from *different*
// Style DNA presets or layouts as potential duplicates of each other (they
// can't be, by construction: different presets deliberately produce
// different silhouettes/palettes/compositions). Comparison is always
// bucketed to `(styleDnaId, layoutId)` first (BUILD_013_AUDIT.md's own
// stated performance mitigation — this also bounds the O(n^2) pairwise cost
// to within-bucket comparisons only, typically 150-350 tiles per bucket
// instead of 5,000).

export interface FingerprintInput {
  styleDnaId: string;
  layoutId: string;
  compositionZone?: string;
  paletteId?: string;
  botanicalFamily?: string;
  hierarchyPreset?: string;
  productTarget: string;
  density: number;
  negativeSpace: number;
  nodeCount: number;
  /** Real shape-topology signatures, one per motif instance (see
   * `extractMotifShapeSignatures`) — the strongest available "silhouette"
   * signal without re-deriving geometry this module doesn't own. */
  shapeSignatures: string[];
}

export function bucket(value: number, step: number): number {
  // Rounded to 6 decimals to avoid floating-point artifacts like
  // 0.30000000000000004 leaking into the (otherwise human-inspectable)
  // fingerprint string for an input as ordinary as density=0.3, step=0.05.
  return Math.round((Math.round(value / step) * step) * 1e6) / 1e6;
}

/** A deterministic, human-inspectable fingerprint string — every bucketed
 * field is separated so a reviewer can read `docs/build_reports/
 * BUILD_013_REPORT.md`'s duplicate examples and see exactly why two tiles
 * were classified as similar, never an opaque hash. */
export function computeSimilarityFingerprint(input: FingerprintInput): string {
  const densityBucket = bucket(input.density, 0.05);
  const negativeSpaceBucket = bucket(input.negativeSpace, 0.05);
  const nodeCountBucket = bucket(input.nodeCount, 200);
  const shapeSet = [...new Set(input.shapeSignatures)].sort();
  return [
    `style:${input.styleDnaId}`,
    `layout:${input.layoutId}`,
    `zone:${input.compositionZone ?? 'none'}`,
    `palette:${input.paletteId ?? 'none'}`,
    `family:${input.botanicalFamily ?? 'none'}`,
    `hierarchy:${input.hierarchyPreset ?? 'none'}`,
    `product:${input.productTarget}`,
    `density:${densityBucket}`,
    `negSpace:${negativeSpaceBucket}`,
    `nodes:${nodeCountBucket}`,
    `shapes:${shapeSet.length}`,
  ].join('|');
}

/** Jaccard similarity (0-1) between two tiles' real shape-signature
 * multisets (deduped to sets — a real, standard set-similarity metric, not
 * a fabricated one). 1.0 means both tiles drew the exact same set of
 * distinct motif silhouettes; 0 means no overlap at all. */
export function shapeSetSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const s of setA) if (setB.has(s)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

export type DuplicateStatus = 'exactDuplicate' | 'deterministicDuplicate' | 'nearDuplicate' | 'acceptableVariant';

export interface DuplicateThresholds {
  /** Shape-set similarity at/above which two same-bucket tiles are an
   * "exact duplicate" (structurally identical silhouette set AND identical
   * bucketed structural fields) — default 1.0 (no wiggle room at all). */
  exact: number;
  /** At/above which (but below `exact`, or `exact` similarity with a
   * structural field difference) two tiles are a "deterministic duplicate"
   * — same preset/layout/product, shape sets identical, differ only in
   * palette/zone/density bucket. Default 1.0 (same as exact on shape, the
   * distinguishing factor is the structural-field check in
   * `classifyDuplicate`). */
  deterministic: number;
  /** At/above which two same-bucket tiles are a "near duplicate" — high
   * but imperfect shape overlap. Default 0.8, the conventional "very
   * similar" Jaccard threshold used in near-duplicate literature; adjustable
   * per the brief's own "provide adjustable thresholds" instruction. */
  near: number;
}

export const DEFAULT_DUPLICATE_THRESHOLDS: DuplicateThresholds = { exact: 1.0, deterministic: 1.0, near: 0.8 };

/** Classifies the relationship between two tiles already known to share a
 * `(styleDnaId, layoutId)` bucket (callers are expected to bucket first —
 * see module doc comment). Returns `undefined` when the pair is below the
 * `near` threshold — i.e. a real, distinct output, not a duplicate of any
 * kind, the brief's own "meaningfully distinct outputs" / "acceptable
 * collection variants" distinction. */
export function classifyDuplicate(
  a: Pick<FingerprintInput, 'shapeSignatures' | 'productTarget' | 'paletteId' | 'compositionZone'> & { densityBucket: number; nodeCountBucket: number },
  b: Pick<FingerprintInput, 'shapeSignatures' | 'productTarget' | 'paletteId' | 'compositionZone'> & { densityBucket: number; nodeCountBucket: number },
  thresholds: DuplicateThresholds = DEFAULT_DUPLICATE_THRESHOLDS,
): { status: DuplicateStatus; similarity: number } | undefined {
  const similarity = shapeSetSimilarity(a.shapeSignatures, b.shapeSignatures);
  if (similarity < thresholds.near) return undefined;

  const sameStructure = a.productTarget === b.productTarget && a.paletteId === b.paletteId && a.compositionZone === b.compositionZone && a.densityBucket === b.densityBucket && a.nodeCountBucket === b.nodeCountBucket;

  if (similarity >= thresholds.exact && sameStructure) return { status: 'exactDuplicate', similarity };
  if (similarity >= thresholds.deterministic) return { status: 'deterministicDuplicate', similarity };
  if (similarity >= thresholds.near) return { status: sameStructure ? 'nearDuplicate' : 'acceptableVariant', similarity };
  return undefined;
}
