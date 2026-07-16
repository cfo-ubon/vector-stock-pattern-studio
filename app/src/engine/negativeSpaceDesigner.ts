import type { ProductUseId } from '../collection/productTargets';

// Build 006, Section 5 (Negative Space Designer): the brief asks for
// negative space to become "intentional" -- detect the product a pattern
// targets (wallpaper/fabric/gift wrap/editorial-style stationery/...) and
// optimize spacing differently for it, instead of one `negativeSpace` dial
// treated identically regardless of what the tile is actually meant to
// become. This is a real, well-known surface-pattern convention, not an
// invented one: a repeat-heavy print (wallpaper/fabric/textile) reads
// better a little FULLER so the seam disappears into the overall texture,
// while a gift-wrap/stationery/packaging print wants more real breathing
// room so a single motif can pop as a focal gift-worthy moment.
//
// Deliberately a single small additive nudge on top of the already-real
// `negativeSpace` dial (never a replacement) -- an undefined `productTarget`
// (the overwhelming majority of existing calls, every pre-Build-006 saved
// pattern/preset/test) reproduces the exact prior `negativeSpace` value,
// zero behavior change.
const PRODUCT_NEGATIVE_SPACE_ADJUSTMENT: Record<ProductUseId, number> = {
  // Repeat-forward uses: a touch denser so the tile's own seam disappears
  // into the overall texture rather than reading as a gap in an otherwise
  // busy repeat.
  wallpaper: -0.05,
  fabric: -0.03,
  textile: -0.03,
  homeDecor: 0,
  digitalPaper: 0.02,
  // Focal-object uses: real extra breathing room around a hero motif so it
  // reads as a deliberate gift-worthy/editorial moment rather than a plain
  // all-over repeat.
  giftWrap: 0.12,
  wrappingPaper: 0.1,
  packaging: 0.05,
  notebookCovers: 0.05,
  stationery: 0.08,
};

/** Real per-product negative-space adjustment -- see
 * `PRODUCT_NEGATIVE_SPACE_ADJUSTMENT`'s own doc comment for the design
 * rationale behind each value. Clamped to the same [0, 1] range
 * `negativeSpace` itself is already clamped to elsewhere (`designModel.ts`).
 * `productTarget` undefined is a pure identity (returns `baseNegativeSpace`
 * unchanged) -- this function only ever nudges, never invents, a value. */
export function resolveNegativeSpaceForProduct(baseNegativeSpace: number, productTarget?: ProductUseId): number {
  if (productTarget === undefined) return baseNegativeSpace;
  const adjustment = PRODUCT_NEGATIVE_SPACE_ADJUSTMENT[productTarget] ?? 0;
  return Math.max(0, Math.min(1, baseNegativeSpace + adjustment));
}
