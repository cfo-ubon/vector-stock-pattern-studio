import type { Placement } from './types';

// Build 024 (Botanical Anatomy, Depth & Thumbnail Beauty Engine), Phase 6:
// Depth-Layering Engine. BUILD_024_AUDIT.md Section 4 confirmed
// `engine/depthEngine.ts` is a single color-shift helper (2 receding roles,
// no layer concept) and `engine/hierarchy.ts`'s `ROLE_LAYER_PRIORITY` is a
// flat 4-value paint-order table — neither is a real multi-plane depth
// system. This module is additive: it assigns each placement one of 7 named
// depth planes using only fields `Placement` already carries (`role`,
// `scale`, `clusterId`, `x`/`y`) — no new generation-time state, no RNG (a
// placement's own real geometry determines its plane, so the same
// placements always produce the same planes) — and exposes a real
// paint-order (`sortByDepthLayer`) plus geometry-derived diagnostics.
//
// EPS-safe constraint (see `engine/types.ts` doc comments on flatShadow/
// flatHighlight and `tile.test.ts`'s `feGaussianBlur` assertion): depth here
// is expressed entirely through z-order / occlusion / scale, never through
// opacity, blur or filters.

export type DepthLayer =
  | 'background'
  | 'farBackFoliage'
  | 'rearBranches'
  | 'secondaryFlowers'
  | 'heroFlowers'
  | 'foregroundLeaves'
  | 'accentDetails';

/** Back-to-front paint order — index doubles as z-priority. */
export const DEPTH_LAYER_ORDER: DepthLayer[] = [
  'background',
  'farBackFoliage',
  'rearBranches',
  'secondaryFlowers',
  'heroFlowers',
  'foregroundLeaves',
  'accentDetails',
];

const DEPTH_LAYER_Z: Record<DepthLayer, number> = Object.fromEntries(
  DEPTH_LAYER_ORDER.map((layer, i) => [layer, i]),
) as Record<DepthLayer, number>;

/** Below this fraction of the tile's average instance scale, a filler/accent
 * instance reads as small background texture rather than foreground detail. */
const SMALL_SCALE_FRACTION = 0.85;
/** A cluster member within this fraction of `clusterBaseRadius`-scale
 * distance of its own anchor reads as "close support," not "peripheral." */
const NEAR_ANCHOR_FRACTION = 0.5;

function wrapDist(dx: number, dy: number, tileSize: number): number {
  const wx = Math.min(Math.abs(dx), tileSize - Math.abs(dx));
  const wy = Math.min(Math.abs(dy), tileSize - Math.abs(dy));
  return Math.hypot(wx, wy);
}

/** Deterministically assigns one of the 7 named planes to a single
 * placement. Hero/secondary map directly to their own dedicated planes (a
 * tile's focal hierarchy already decided those roles are structurally
 * different — depth should agree, not re-litigate it). Filler/accent split
 * further by real, already-available geometry: distance from their own
 * cluster anchor (close = foreground support, far = background texture) and
 * relative scale (small = fine background/detail texture, large = a
 * foreground presence). Placements with no role (lattice layouts exempted
 * from hierarchy — see `HIERARCHY_EXEMPT_LAYOUTS`) sit on `background`: a
 * grid/brick/stripe repeat has no focal depth story to tell. */
export function assignDepthLayer(
  placement: Placement,
  avgScale: number,
  tileSize: number,
): DepthLayer {
  if (placement.role === 'hero') return 'heroFlowers';
  if (placement.role === 'secondary') return 'secondaryFlowers';

  const isSmall = avgScale > 0 && placement.scale < avgScale * SMALL_SCALE_FRACTION;
  const nearAnchor =
    placement.clusterId !== undefined &&
    placement.clusterAnchorX !== undefined &&
    placement.clusterAnchorY !== undefined &&
    wrapDist(placement.x - placement.clusterAnchorX, placement.y - placement.clusterAnchorY, tileSize) <=
      tileSize * NEAR_ANCHOR_FRACTION * 0.12;

  if (placement.role === 'filler') {
    if (nearAnchor && !isSmall) return 'foregroundLeaves';
    return 'farBackFoliage';
  }
  if (placement.role === 'accent') {
    if (isSmall) return 'accentDetails';
    if (placement.clusterId !== undefined && !nearAnchor) return 'rearBranches';
    return 'accentDetails';
  }
  return 'background';
}

export interface DepthLayerAssignment {
  placement: Placement;
  layer: DepthLayer;
  index: number;
}

/** Assigns every placement a plane and returns them re-ordered back-to-front
 * by plane (stable within a plane — ties keep their original relative order,
 * same convention `sortByLayerPriority` already uses). */
export function assignDepthLayers(placements: Placement[], tileSize: number): DepthLayerAssignment[] {
  const avgScale = placements.length > 0 ? placements.reduce((s, p) => s + p.scale, 0) / placements.length : 1;
  const assigned = placements.map((placement, index) => ({
    placement,
    layer: assignDepthLayer(placement, avgScale, tileSize),
    index,
  }));
  return assigned
    .slice()
    .sort((a, b) => DEPTH_LAYER_Z[a.layer] - DEPTH_LAYER_Z[b.layer] || a.index - b.index);
}

/** Sorts placements back-to-front by depth plane, discarding the assignment
 * metadata — the drop-in replacement for `sortByLayerPriority` wherever a
 * tile opts into the Depth-Layering Engine. */
export function sortByDepthLayer(placements: Placement[], tileSize: number): Placement[] {
  return assignDepthLayers(placements, tileSize).map((a) => a.placement);
}

export interface DepthDiagnostics {
  /** How many of the 7 named planes have at least one real instance. */
  layerCount: number;
  /** Average number of OTHER planes whose instances geometrically overlap
   * the hero plane's own bounding circles — 0 means the hero sits with
   * nothing in front of or behind it at all (a flat cutout read). */
  overlapDepth: number;
  /** Fraction of the hero's own bounding-circle area covered by
   * foreground-plane (`foregroundLeaves`/`accentDetails`) instances — real
   * occlusion is a stronger depth cue than color/scale alone. */
  heroOcclusionRatio: number;
  /** Fraction of the tile's 4 corner quadrants that contain at least one
   * foreground-plane instance — a real "framing" composition keeps some
   * foreground presence at the edges, not only dead center. */
  foregroundFramingScore: number;
  /** Fraction of far-back-plane (`farBackFoliage`/`rearBranches`) instances
   * that are NOT majority-occluded by anything closer — some rear-plane
   * visibility is needed for depth to read at all; 0 means the rear planes
   * are completely hidden (pointless to have drawn them) and 1 means
   * nothing recedes (no depth cue from occlusion). */
  rearLayerVisibility: number;
  /** True when 2 or fewer distinct planes are actually present among this
   * tile's real placements — the composition has no depth story to tell
   * regardless of what color/scale tricks are layered on top. */
  flattenedCompositionRisk: boolean;
}

function circleOverlapFraction(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
  tileSize: number,
): number {
  const d = wrapDist(ax - bx, ay - by, tileSize);
  if (d >= ar + br) return 0;
  if (d <= Math.abs(ar - br)) return 1; // one fully inside the other
  // Linear falloff approximation (not exact lens-area formula) — this is a
  // relative "how much do these overlap" signal for a diagnostic, not a
  // rendering computation, so an exact circular-segment integral is
  // unwarranted precision for the question being asked.
  return Math.max(0, 1 - (d - Math.abs(ar - br)) / (ar + br - Math.abs(ar - br)));
}

export function computeDepthDiagnostics(
  placements: Placement[],
  tileSize: number,
  motifSize: number,
): DepthDiagnostics {
  if (placements.length === 0) {
    return {
      layerCount: 0,
      overlapDepth: 0,
      heroOcclusionRatio: 0,
      foregroundFramingScore: 0,
      rearLayerVisibility: 1,
      flattenedCompositionRisk: true,
    };
  }
  const assigned = assignDepthLayers(placements, tileSize);
  const presentLayers = new Set(assigned.map((a) => a.layer));
  const layerCount = presentLayers.size;

  const radiusOf = (p: Placement) => (motifSize / 2) * p.scale;
  const heroes = assigned.filter((a) => a.layer === 'heroFlowers');
  const foreground = assigned.filter((a) => a.layer === 'foregroundLeaves' || a.layer === 'accentDetails');
  const rear = assigned.filter((a) => a.layer === 'farBackFoliage' || a.layer === 'rearBranches');
  const closer = (layer: DepthLayer) => assigned.filter((a) => DEPTH_LAYER_Z[a.layer] > DEPTH_LAYER_Z[layer]);

  let overlapDepthSum = 0;
  let heroOcclusionSum = 0;
  if (heroes.length > 0) {
    for (const hero of heroes) {
      const hr = radiusOf(hero.placement);
      const overlappingPlanes = new Set<DepthLayer>();
      let occlusion = 0;
      for (const other of assigned) {
        if (other === hero) continue;
        const overlap = circleOverlapFraction(
          hero.placement.x,
          hero.placement.y,
          hr,
          other.placement.x,
          other.placement.y,
          radiusOf(other.placement),
          tileSize,
        );
        if (overlap > 0.05) {
          overlappingPlanes.add(other.layer);
          if (other.layer === 'foregroundLeaves' || other.layer === 'accentDetails') {
            occlusion = Math.max(occlusion, overlap);
          }
        }
      }
      overlapDepthSum += overlappingPlanes.size;
      heroOcclusionSum += occlusion;
    }
  }
  const overlapDepth = heroes.length > 0 ? overlapDepthSum / heroes.length : 0;
  const heroOcclusionRatio = heroes.length > 0 ? heroOcclusionSum / heroes.length : 0;

  // Foreground framing: which of the 4 quadrants (split at tile center)
  // contain at least one foreground-plane instance.
  const quadrants = new Set<string>();
  for (const f of foreground) {
    const qx = f.placement.x < tileSize / 2 ? 'L' : 'R';
    const qy = f.placement.y < tileSize / 2 ? 'T' : 'B';
    quadrants.add(qx + qy);
  }
  const foregroundFramingScore = quadrants.size / 4;

  // Rear visibility: fraction of rear-plane instances not majority-occluded
  // by any strictly-closer plane's instance.
  let visibleRear = 0;
  for (const r of rear) {
    const rr = radiusOf(r.placement);
    const occludedByCloser = closer(r.layer).some((other) => {
      const overlap = circleOverlapFraction(
        r.placement.x,
        r.placement.y,
        rr,
        other.placement.x,
        other.placement.y,
        radiusOf(other.placement),
        tileSize,
      );
      return overlap > 0.6;
    });
    if (!occludedByCloser) visibleRear++;
  }
  const rearLayerVisibility = rear.length > 0 ? visibleRear / rear.length : 1;

  return {
    layerCount,
    overlapDepth: Math.round(overlapDepth * 100) / 100,
    heroOcclusionRatio: Math.round(heroOcclusionRatio * 100) / 100,
    foregroundFramingScore: Math.round(foregroundFramingScore * 100) / 100,
    rearLayerVisibility: Math.round(rearLayerVisibility * 100) / 100,
    flattenedCompositionRisk: layerCount <= 2,
  };
}
