import type { Rng, SvgNode } from './types';
import { h, round } from './svgAst';
import { rngRange, jitter } from './rng';
import type { FactoryMotif } from './motifFactory';

// Border & Corner asset generation (Professional Asset Factory Engine) —
// genuinely new layout algorithms; no precedent exists elsewhere in the
// engine (every other layout in /layouts builds a seamless *square* tile
// wrapped in both axes; a border strip only repeats along its running axis,
// and a corner unit doesn't repeat at all). Both build directly from
// FactoryMotif instances (engine/motifFactory.ts) rather than going through
// engine/tile.ts's buildTile pipeline, since neither output is a seamless
// square tile.

export type BorderEdge = 'top' | 'bottom' | 'left' | 'right';
export type CornerId = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

function scaleMotifToFit(motif: FactoryMotif, targetSize: number): number {
  const naturalSize = Math.max(motif.bounds.width, motif.bounds.height) || 1;
  return targetSize / naturalSize;
}

/** One motif instance placed at (x, y) with the given uniform scale/rotation
 * — recentres the motif's own bounding box on the placement point first
 * (a FactoryMotif's geometry isn't necessarily centered on its own origin),
 * matching what a designer expects when they say "place this motif here". */
function placeMotif(motif: FactoryMotif, x: number, y: number, scale: number, rotationDeg: number): SvgNode {
  const cx = (motif.bounds.minX + motif.bounds.maxX) / 2;
  const cy = (motif.bounds.minY + motif.bounds.maxY) / 2;
  return h('g', { transform: `translate(${round(x)} ${round(y)}) rotate(${round(rotationDeg)}) scale(${round(scale)}) translate(${round(-cx)} ${round(-cy)})` }, [motif.node]);
}

/** A single row of motifs running along one edge of the tile, evenly spaced
 * along the running axis and wrap-cloned along that axis only (never the
 * cross axis) so the strip repeats seamlessly end-to-end when tiled
 * side-by-side — the one-dimensional analogue of engine/tile.ts's 2D
 * wrap-and-clip technique. */
export function buildBorderStrip(opts: {
  edge: BorderEdge;
  length: number;
  band: number;
  motifs: FactoryMotif[];
  rng: Rng;
  backgroundColor: string;
  count: number;
}): { svg: SvgNode; width: number; height: number } {
  const { edge, length, band, motifs, rng, backgroundColor, count } = opts;
  const horizontal = edge === 'top' || edge === 'bottom';
  const width = horizontal ? length : band;
  const height = horizontal ? band : length;
  const spacing = length / Math.max(1, count);
  const targetSize = band * 0.72;

  const groups: SvgNode[] = [];
  for (let i = 0; i < count; i++) {
    const motif = motifs[i % motifs.length];
    const along = spacing * (i + 0.5) + rngRange(rng, -spacing * 0.1, spacing * 0.1);
    const cross = band / 2 + rngRange(rng, -band * 0.06, band * 0.06);
    const scale = scaleMotifToFit(motif, targetSize) * (1 + rngRange(rng, -0.08, 0.08));
    const rotationDeg = jitter(rng, 0, 6);
    const [x, y] = horizontal ? [along, cross] : [cross, along];
    // Wrap-clone along the running axis only — a border tiles end-to-end,
    // never top-to-bottom.
    for (const offset of [-1, 0, 1]) {
      const wx = horizontal ? x + offset * length : x;
      const wy = horizontal ? y : y + offset * length;
      if (wx < -band || wx > width + band || wy < -band || wy > height + band) continue;
      groups.push(placeMotif(motif, wx, wy, scale, rotationDeg));
    }
  }

  const content = h('g', { id: `border-${edge}` }, [
    h('defs', {}, [h('clipPath', { id: `border-clip-${edge}` }, [h('rect', { x: 0, y: 0, width, height })])]),
    h('rect', { x: 0, y: 0, width, height, fill: backgroundColor }),
    h('g', { 'clip-path': `url(#border-clip-${edge})` }, groups),
  ]);
  return { svg: content, width, height };
}

/** A quarter-plane cluster of motifs concentrated near the corner point and
 * thinning out with distance from it (a decorative-corner taper, the same
 * shape convention real textile/wallpaper border sets use), built once in
 * "top-left" orientation with the corner point at the origin, then mirrored
 * per corner via scale(-1) so all 4 corners are visually consistent with
 * each other rather than 4 independently-random clusters. */
export function buildCornerUnit(opts: {
  corner: CornerId;
  band: number;
  motifs: FactoryMotif[];
  rng: Rng;
  backgroundColor: string;
  count: number;
}): { svg: SvgNode; width: number; height: number } {
  const { corner, band, motifs, rng, backgroundColor, count } = opts;

  // Base cluster in top-left convention: corner point at (0,0), motifs
  // scattered through the quadrant with density biased toward the origin
  // via a squared random radius (uniform-in-area sampling would spread
  // evenly; squashing the radius toward 0 concentrates more points near
  // the corner, tapering outward).
  const baseGroups: SvgNode[] = [];
  for (let i = 0; i < count; i++) {
    const motif = motifs[i % motifs.length];
    const angle = rngRange(rng, 0, Math.PI / 2);
    const radiusFrac = rngRange(rng, 0, 1) ** 1.6;
    const r = radiusFrac * band * 0.92;
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);
    const taper = 1 - radiusFrac * 0.55;
    const targetSize = band * 0.3 * taper;
    const scale = scaleMotifToFit(motif, targetSize);
    const rotationDeg = jitter(rng, 0, 10);
    baseGroups.push(placeMotif(motif, x, y, scale, rotationDeg));
  }
  const baseCluster = h('g', { id: 'corner-cluster-base' }, baseGroups);

  // Mirror the base (always authored in top-left convention) into whichever
  // corner was requested. scale(-1) flips coordinates negative, so an
  // offsetting translate brings the flipped content back into [0, band].
  let mirrorTransform = '';
  if (corner === 'top-right') mirrorTransform = `translate(${band} 0) scale(-1 1)`;
  else if (corner === 'bottom-left') mirrorTransform = `translate(0 ${band}) scale(1 -1)`;
  else if (corner === 'bottom-right') mirrorTransform = `translate(${band} ${band}) scale(-1 -1)`;

  const mirrored = mirrorTransform ? h('g', { transform: mirrorTransform }, [baseCluster]) : baseCluster;

  const content = h('g', { id: `corner-${corner}` }, [
    h('defs', {}, [h('clipPath', { id: `corner-clip-${corner}` }, [h('rect', { x: 0, y: 0, width: band, height: band })])]),
    h('rect', { x: 0, y: 0, width: band, height: band, fill: backgroundColor }),
    h('g', { 'clip-path': `url(#corner-clip-${corner})` }, [mirrored]),
  ]);
  return { svg: content, width: band, height: band };
}
