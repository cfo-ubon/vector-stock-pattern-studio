import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round, smoothClosedPath } from '../engine/svgAst';
import { accentColors } from '../palettes/palettes';
import { rngPick, rngInt, rngRange } from '../engine/rng';

// Animal Print generator: leopard rosettes, zebra/tiger stripes, giraffe
// patches and cow spots — a huge, evergreen fashion/nursery/home-decor
// stock category on its own. Best on Random Scatter (spots) or Grid
// (stripes) at moderate-high density.

type Variant = (rng: Rng, colors: string[], size: number) => { node: ReturnType<typeof h>; radius: number };

function irregularBlob(rng: Rng, r: number, irregularity: number, pointCount: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < pointCount; i++) {
    const angle = (Math.PI * 2 * i) / pointCount;
    const radius = r * (1 - irregularity / 2 + rng() * irregularity);
    pts.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  return pts;
}

const leopardRosette: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const ring = rngPick(rng, accents);
  const core = rngPick(rng, accents);
  const outer = irregularBlob(rng, r, 0.45, rngInt(rng, 5, 7));
  const children = [h('path', { d: smoothClosedPath(outer), fill: ring, opacity: 0.85 })];
  const innerCount = rngInt(rng, 2, 4);
  for (let i = 0; i < innerCount; i++) {
    const angle = rngRange(rng, 0, Math.PI * 2);
    const dist = rngRange(rng, 0, r * 0.3);
    const innerR = r * rngRange(rng, 0.18, 0.3);
    const pts = irregularBlob(rng, innerR, 0.4, 5).map(([x, y]) => [x + Math.cos(angle) * dist, y + Math.sin(angle) * dist] as [number, number]);
    children.push(h('path', { d: smoothClosedPath(pts), fill: core }));
  }
  return { node: h('g', {}, children), radius: r * 1.1 };
};

const zebraStripe: Variant = (rng, colors, size) => {
  const color = rngPick(rng, accentColors(colors));
  const angle = rngRange(rng, -35, 35);
  const len = size * rngRange(rng, 0.9, 1.2);
  const w = size * rngRange(rng, 0.16, 0.28);
  const wobble = size * 0.12;
  const d = `M ${round(-len / 2)} 0 Q ${round(-len / 4)} ${round(-wobble)} 0 0 Q ${round(len / 4)} ${round(wobble)} ${round(len / 2)} 0`;
  const node = h('path', {
    d,
    fill: 'none',
    stroke: color,
    'stroke-width': round(w),
    'stroke-linecap': 'round',
    transform: `rotate(${round(angle)})`,
  });
  return { node, radius: (len / 2) * 1.1 };
};

const tigerStripe: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const angle = rngRange(rng, -25, 25);
  const points: Array<[number, number]> = [];
  const segs = 4;
  const len = size * rngRange(rng, 0.8, 1.1);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs - 0.5;
    points.push([t * len, Math.sin(t * Math.PI * 2) * size * 0.06]);
  }
  const w = size * rngRange(rng, 0.1, 0.18);
  let d = `M ${round(points[0][0])} ${round(points[0][1])}`;
  for (let i = 1; i < points.length; i++) d += ` L ${round(points[i][0])} ${round(points[i][1])}`;
  const node = h('path', {
    d,
    fill: 'none',
    stroke: color,
    'stroke-width': round(w),
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    transform: `rotate(${round(angle)})`,
  });
  return { node, radius: r * 1.05 };
};

const giraffePatch: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const pts = irregularBlob(rng, r * 0.85, 0.3, rngInt(rng, 5, 6));
  const node = h('path', { d: smoothClosedPath(pts), fill: color });
  return { node, radius: r * 1.0 };
};

const cowPatch: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const pts = irregularBlob(rng, r * 0.9, 0.55, rngInt(rng, 6, 9));
  const node = h('path', { d: smoothClosedPath(pts), fill: color });
  return { node, radius: r * 1.15 };
};

const VARIANTS: Variant[] = [leopardRosette, zebraStripe, tigerStripe, giraffePatch, cowPatch];

// A real animal-print product is one animal, not a mash-up — pick one
// species per tile (same fix as Plaid/Check, Paisley/Ikat, Seasonal).
let currentVariant: Variant = leopardRosette;

export const animalPrintGenerator: PatternGenerator = {
  id: 'animalprint',
  label: 'Animal Print',
  description: 'Leopard rosettes, zebra stripes, tiger stripes, giraffe or cow patches — one animal per pattern. Classic fashion/nursery animal-skin prints.',
  defaultMotifSize: 75,
  beginTile(rng: Rng) {
    currentVariant = rngPick(rng, VARIANTS);
  },
  createMotif(rng: Rng, colors: string[], size: number): Motif {
    const { node, radius } = currentVariant(rng, colors, size);
    return { node, radius };
  },
};
