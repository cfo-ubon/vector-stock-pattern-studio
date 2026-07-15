import type { TileData } from './types';
import { extractInstances } from './svgGeometry';
import type { CompositionMetrics } from './scoring';

// Build 001.1, Section 6 (Pattern Readability). The brief names 3 concrete
// viewing conditions a stock buyer actually encounters: a marketplace
// thumbnail (~200px), a slightly larger preview (~400px), and zooming in
// close on the full-size asset (~800%). These are two genuinely different
// failure modes, not one "quality" score at different strengths:
//
//   - At thumbnail sizes, DETAIL LOSS is the risk: a real on-screen pixel
//     size for the smallest/least-important instances (computed from the
//     tile's own real `tileSize`/`motifSize`/each instance's own `scale` —
//     never a fabricated size) can fall below what's actually resolvable,
//     and — more commercially critical — the HERO motif specifically must
//     still read as a distinct shape, not a blur, since that's what a
//     marketplace search-result thumbnail actually needs to sell the
//     pattern.
//   - At high zoom, MECHANICAL/SEAM artifacts are the risk: repetition and
//     tile-edge seams that are invisible at normal viewing size become
//     obvious up close. This reuses real, already-computed metrics
//     (`cornerContinuity`, `gridAppearanceScore`, `svgHealth`) rather than
//     inventing a new geometry pass — a close-up view doesn't change the
//     underlying geometry, it just makes existing seam/mechanical defects
//     easier to see, so the same defects those metrics already measure at
//     normal scale are exactly what surfaces at zoom.

export interface PatternReadabilityResult {
  /** 0-100 — readability at a ~200px marketplace thumbnail. */
  thumbnail200: number;
  /** 0-100 — readability at a ~400px larger preview. */
  thumbnail400: number;
  /** 0-100 — readability at ~800% zoom (mechanical/seam artifacts, not
   * detail loss — see module header). */
  zoom800: number;
  /** True only when every one of the 3 scales clears a real legibility
   * floor — a pattern that reads well only at one scale is not, in the
   * brief's own words, "readable at every scale". */
  readableAtAllScales: boolean;
}

const READABILITY_FLOOR = 50;
/** Below this on-screen px size, an instance is effectively invisible —
 * not "small", gone. */
const MIN_VISIBLE_PX = 2;
/** The hero specifically needs to read as a distinct shape, not just a
 * visible speck — a taller bar than the generic visibility floor. */
const HERO_LEGIBLE_PX = 6;

function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Real on-screen size (px) of one instance at a given display width —
 * `tile.params.motifSize` and the instance's own `scale` are the actual
 * values `engine/tile.ts` drew it at, scaled by how much smaller the
 * whole tile is being displayed than its native `tileSize`. */
function onScreenSizePx(motifSize: number, instanceScale: number, tileSize: number, displayPx: number): number {
  return motifSize * instanceScale * (displayPx / tileSize);
}

function scoreForThumbnail(tile: TileData, displayPx: number): number {
  const instances = extractInstances(tile);
  if (instances.length === 0) return 100;
  const { tileSize, motifSize } = tile.params;

  const visibleCount = instances.filter((i) => onScreenSizePx(motifSize, i.scale, tileSize, displayPx) >= MIN_VISIBLE_PX).length;
  const visibleFraction = visibleCount / instances.length;

  const heroes = instances.filter((i) => i.role === 'hero');
  const heroLegible = heroes.length === 0 || heroes.every((h) => onScreenSizePx(motifSize, h.scale, tileSize, displayPx) >= HERO_LEGIBLE_PX);

  // Weighted so the hero's own legibility dominates — a thumbnail where
  // every filler motif vanished but the hero still reads clearly is a
  // commercially fine thumbnail; the reverse is not.
  return clamp01to100(visibleFraction * 40 + (heroLegible ? 60 : 0));
}

/** Reuses real, already-computed metrics for the zoom condition — see
 * module header for why zoom is a "surface existing defects", not "compute
 * a new one" measurement. */
function scoreForZoom(metrics: CompositionMetrics): number {
  return clamp01to100(metrics.cornerContinuity * 0.45 + metrics.gridAppearanceScore * 0.3 + metrics.svgHealth * 0.25);
}

/** Runs all 3 Section 6 readability checks against one rendered tile.
 * Deterministic — same tile + metrics always produce the same result. */
export function computePatternReadability(tile: TileData, metrics: CompositionMetrics): PatternReadabilityResult {
  const thumbnail200 = scoreForThumbnail(tile, 200);
  const thumbnail400 = scoreForThumbnail(tile, 400);
  const zoom800 = scoreForZoom(metrics);
  return {
    thumbnail200,
    thumbnail400,
    zoom800,
    readableAtAllScales: thumbnail200 >= READABILITY_FLOOR && thumbnail400 >= READABILITY_FLOOR && zoom800 >= READABILITY_FLOOR,
  };
}
