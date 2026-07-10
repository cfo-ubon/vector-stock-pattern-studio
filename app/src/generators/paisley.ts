import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { accentColors, blendHex } from '../palettes/palettes';
import { rngPick, rngInt, rngRange, rngBool } from '../engine/rng';

// Paisley & Ikat generator: the Persian teardrop (boteh) motif and the
// soft-feathered-edge diamond/chevron look of ikat weaving — both huge,
// long-running bestsellers in boho/ethnic textile stock. Ikat's signature
// "blurred" edge is faked with 2-3 flat, decreasing-opacity offset copies
// instead of a gradient, keeping every shape solid-fill/no-filter.

type Variant = (rng: Rng, colors: string[], size: number) => { node: ReturnType<typeof h>; radius: number };

function paisleyPath(r: number): string {
  // A teardrop that curls back on itself at the top — the boteh silhouette.
  return `M 0 ${round(r)} C ${round(r * 0.9)} ${round(r * 0.6)} ${round(r * 0.85)} ${round(-r * 0.1)} ${round(r * 0.35)} ${round(-r * 0.55)} C ${round(r * 0.05)} ${round(-r * 0.8)} ${round(-r * 0.35)} ${round(-r * 0.75)} ${round(-r * 0.3)} ${round(-r * 0.4)} C ${round(-r * 0.27)} ${round(-r * 0.18)} ${round(-r * 0.05)} ${round(-r * 0.05)} ${round(r * 0.05)} ${round(-r * 0.18)} C ${round(r * 0.12)} ${round(-r * 0.28)} ${round(r * 0.02)} ${round(-r * 0.4)} ${round(-r * 0.12)} ${round(-r * 0.38)} C ${round(-r * 0.55)} ${round(-r * 0.3)} ${round(-r * 0.7)} ${round(r * 0.15)} 0 ${round(r)} Z`;
}

/** Radiating fringe ticks along a polyline/polygon's outer edge — the
 * short frayed-thread marks real ikat weaving leaves at a color-band
 * boundary. `close` treats `points` as a closed polygon (diamond) instead
 * of an open path (chevron). Outward direction is picked per-segment by
 * comparing the edge normal against the segment midpoint (every motif here
 * is centered on the origin, so "away from origin" is "outward"). */
function edgeFringe(points: Array<[number, number]>, close: boolean, color: string, count: number, len: number, width: number): ReturnType<typeof h>[] {
  const ticks: ReturnType<typeof h>[] = [];
  const segCount = close ? points.length : points.length - 1;
  for (let e = 0; e < segCount; e++) {
    const [x1, y1] = points[e];
    const [x2, y2] = points[(e + 1) % points.length];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const edgeLen = Math.hypot(dx, dy) || 1;
    let nx = dy / edgeLen;
    let ny = -dx / edgeLen;
    const midx = (x1 + x2) / 2;
    const midy = (y1 + y2) / 2;
    if (nx * midx + ny * midy < 0) {
      nx = -nx;
      ny = -ny;
    }
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      ticks.push(
        h('line', {
          x1: round(px),
          y1: round(py),
          x2: round(px + nx * len),
          y2: round(py + ny * len),
          stroke: color,
          'stroke-width': round(width),
          'stroke-linecap': 'round',
        }),
      );
    }
  }
  return ticks;
}

const paisleyTeardrop: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const body = rngPick(rng, accents);
  const detail = rngPick(rng, accents);
  const rot = rngRange(rng, -20, 20);
  // Blended toward the background rather than toward `detail` — `detail`
  // can land on nearly the same accent as `body` (independent random
  // picks), which made the echo strokes invisible against the fill in
  // testing. Blending toward colors[0] guarantees contrast against `body`
  // regardless of which two accents got picked.
  const echoColor = blendHex(colors[0], 0.4, body);
  const children: ReturnType<typeof h>[] = [
    h('g', { transform: `rotate(${round(rot)})` }, [
      h('path', { d: paisleyPath(r), fill: body }),
      // Nested echo contours — the concentric "paisley within paisley"
      // rings every real boteh print carries — faked cheaply by re-
      // stroking the same outline at a smaller scale instead of building
      // separate inner geometry.
      h('path', { d: paisleyPath(r), fill: 'none', stroke: echoColor, 'stroke-width': round(r * 0.03), transform: 'scale(0.74)' }),
      h('path', { d: paisleyPath(r), fill: 'none', stroke: echoColor, 'stroke-width': round(r * 0.025), transform: 'scale(0.5)' }),
      // A miniature paisley nested near the head, in the undiluted detail
      // tone (same convention as the dot trail below) — the classic
      // "paisley-in-paisley" curl real prints use as a filler.
      h('path', {
        d: paisleyPath(r),
        fill: detail,
        transform: `translate(${round(r * 0.1)} ${round(-r * 0.35)}) scale(0.3) rotate(25)`,
      }),
    ]),
  ];
  if (rngBool(rng)) {
    const dotCount = rngInt(rng, 3, 5);
    for (let i = 0; i < dotCount; i++) {
      const t = (i + 1) / (dotCount + 1);
      children.push(
        h('circle', {
          cx: round(Math.sin((rot * Math.PI) / 180) * r * 0.2 * t),
          cy: round(r * (0.6 - t * 1.1)),
          r: round(r * 0.06),
          fill: detail,
          transform: `rotate(${round(rot)})`,
        }),
      );
    }
  }
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const paisleySwirl: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const body = rngPick(rng, accents);
  const rot = rngRange(rng, 0, 360);
  const echoColor = blendHex(colors[0], 0.4, body);
  const node = h('g', { transform: `rotate(${round(rot)})` }, [
    h('path', { d: paisleyPath(r * 0.8), fill: body }),
    h('path', { d: paisleyPath(r * 0.8), fill: 'none', stroke: echoColor, 'stroke-width': round(r * 0.025), transform: 'scale(0.7)' }),
    h('circle', { cx: 0, cy: round(-r * 0.3), r: round(r * 0.12), fill: rngPick(rng, accents) }),
  ]);
  return { node, radius: r * 0.9 };
};

const ikatDiamond: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const color = rngPick(rng, accents);
  const layers = 3;
  const children: ReturnType<typeof h>[] = [];
  // The feathered ikat edge was stacked transparent layers; pre-blend each
  // layer against the accumulated color underneath it instead (outermost
  // layer sits on the background, each inner layer on the previous one) —
  // same nested-tone look, fully opaque.
  let acc = colors[0];
  const layerAlphas = [0.35, 0.6, 0.85];
  let outerCorners: Array<[number, number]> | null = null;
  for (let i = 0; i < layers; i++) {
    const layerR = r * (1 - i * 0.22);
    // Each corner jitters independently (not one shared offset) for a
    // hand-dyed, slightly irregular diamond instead of a clean geometric one.
    const corners: Array<[number, number]> = [
      [rngRange(rng, -r * 0.05, r * 0.05), -layerR + rngRange(rng, -r * 0.05, r * 0.05)],
      [layerR + rngRange(rng, -r * 0.05, r * 0.05), rngRange(rng, -r * 0.05, r * 0.05)],
      [rngRange(rng, -r * 0.05, r * 0.05), layerR + rngRange(rng, -r * 0.05, r * 0.05)],
      [-layerR + rngRange(rng, -r * 0.05, r * 0.05), rngRange(rng, -r * 0.05, r * 0.05)],
    ];
    acc = blendHex(color, layerAlphas[i], acc);
    children.push(h('polygon', { points: corners.map(([x, y]) => `${round(x)},${round(y)}`).join(' '), fill: acc }));
    if (i === 0) outerCorners = corners;
  }
  if (outerCorners) {
    // Frayed-thread fringe along the outermost band — the visual signature
    // of real ikat weaving that a clean polygon edge alone can't sell.
    children.push(...edgeFringe(outerCorners, true, blendHex(color, 0.3, colors[0]), 10, r * 0.12, size * 0.012));
  }
  return { node: h('g', {}, children), radius: r * 1.2 };
};

const ikatChevron: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const color = rngPick(rng, accents);
  const layers = 3;
  const children: ReturnType<typeof h>[] = [];
  // Chevron strokes never overlap each other (spacing exceeds the stroke
  // width), so blending each against the background is exact.
  const chevronAlphas = [0.4, 0.65, 0.9];
  let outerPts: Array<[number, number]> | null = null;
  for (let i = 0; i < layers; i++) {
    const off = r * (1 - i * 0.28);
    const pts: Array<[number, number]> = [
      [-r, -off + rngRange(rng, -r * 0.05, r * 0.05)],
      [rngRange(rng, -r * 0.04, r * 0.04), off * 0.2 + rngRange(rng, -r * 0.05, r * 0.05)],
      [r, -off + rngRange(rng, -r * 0.05, r * 0.05)],
    ];
    children.push(
      h('polyline', {
        points: pts.map(([x, y]) => `${round(x)},${round(y)}`).join(' '),
        fill: 'none',
        stroke: blendHex(color, chevronAlphas[i], colors[0]),
        'stroke-width': round(size * 0.09),
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }),
    );
    if (i === 0) outerPts = pts;
  }
  if (outerPts) {
    children.push(...edgeFringe(outerPts, false, blendHex(color, 0.3, colors[0]), 8, r * 0.1, size * 0.012));
  }
  return { node: h('g', {}, children), radius: r * 1.15 };
};

const PAISLEY_POOL: Variant[] = [paisleyTeardrop, paisleySwirl];
const IKAT_POOL: Variant[] = [ikatDiamond, ikatChevron];

// Paisley's curling teardrops and ikat's blurred-edge geometric diamonds
// are two distinct visual languages — mixing both in one tile reads as
// inconsistent, not varied. Pick one family per tile (still varies within
// that family), the same fix as Plaid/Check and Seasonal.
let currentPool: Variant[] = PAISLEY_POOL;

export const paisleyGenerator: PatternGenerator = {
  id: 'paisley',
  label: 'Paisley & Ikat',
  description: 'Persian teardrop paisley (boteh) or soft-edged ikat diamonds/chevrons — one family per pattern. Long-running boho/ethnic textile bestsellers.',
  defaultMotifSize: 75,
  beginTile(rng: Rng) {
    currentPool = rngInt(rng, 0, 1) === 0 ? PAISLEY_POOL : IKAT_POOL;
  },
  createMotif(rng: Rng, colors: string[], size: number): Motif {
    const variant = rngPick(rng, currentPool);
    const { node, radius } = variant(rng, colors, size);
    return { node, radius };
  },
};
