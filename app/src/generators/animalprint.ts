import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round, smoothClosedPath } from '../engine/svgAst';
import { accentColors, blendHex } from '../palettes/palettes';
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

/** A tapered, pointed-tip stripe/blotch silhouette: samples a spine curve,
 * offsets each sample perpendicular to the tangent by a width envelope
 * (pinched to zero at both ends), and closes the two offset rails into one
 * path. Real animal markings (zebra/tiger stripes, leopard rosette
 * segments) taper to a point rather than having the constant-width
 * rounded-cap look a plain `stroke` produces, and their edges are slightly
 * ragged rather than perfectly parallel — `edgeJitter` adds that. */
function taperedBlotchPath(
  rng: Rng,
  spine: (t: number) => [number, number],
  widthFn: (t: number) => number,
  samples: number,
  edgeJitter = 0,
): string {
  const top: Array<[number, number]> = [];
  const bottom: Array<[number, number]> = [];
  const eps = 0.5 / samples;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const [x, y] = spine(t);
    const [x0, y0] = spine(Math.max(0, t - eps));
    const [x1, y1] = spine(Math.min(1, t + eps));
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const w = widthFn(t) / 2;
    const jt = edgeJitter ? 1 + (rng() - 0.5) * edgeJitter : 1;
    const jb = edgeJitter ? 1 + (rng() - 0.5) * edgeJitter : 1;
    top.push([x + nx * w * jt, y + ny * w * jt]);
    bottom.push([x - nx * w * jb, y - ny * w * jb]);
  }
  let d = `M ${round(top[0][0])} ${round(top[0][1])} `;
  for (let i = 1; i < top.length; i++) d += `L ${round(top[i][0])} ${round(top[i][1])} `;
  for (let i = bottom.length - 1; i >= 0; i--) d += `L ${round(bottom[i][0])} ${round(bottom[i][1])} `;
  return d + 'Z';
}

const leopardRosette: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const ring = rngPick(rng, accents);
  const core = blendHex(rngPick(rng, accents), 0.65, '#2a1608');
  const children: ReturnType<typeof h>[] = [];

  // Real rosettes are a broken ring of 4-6 comma-shaped blotches, not one
  // continuous smooth loop — skip a segment here and there for the gaps.
  // Each blotch runs tangentially around the ring radius (not radially —
  // that reads as flower petals instead of a rosette).
  const segCount = rngInt(rng, 5, 7);
  const ringColor = blendHex(ring, 0.85, colors[0]);
  const ringRadius = r * 0.76;
  for (let i = 0; i < segCount; i++) {
    if (rng() < 0.12 && segCount > 4) continue; // occasional gap in the ring
    const theta = (((360 / segCount) * i + rngRange(rng, -8, 8)) * Math.PI) / 180;
    const cx = Math.cos(theta);
    const cy = Math.sin(theta);
    const tx = -Math.sin(theta);
    const ty = Math.cos(theta);
    const centerX = cx * ringRadius;
    const centerY = cy * ringRadius;
    const segLen = r * rngRange(rng, 0.7, 0.95);
    const segWidth = r * rngRange(rng, 0.26, 0.36);
    const spine = (t: number): [number, number] => {
      const along = (t - 0.5) * segLen;
      const bulge = Math.sin(t * Math.PI) * segLen * 0.18; // follows the ring's curvature
      return [centerX + tx * along + cx * bulge, centerY + ty * along + cy * bulge];
    };
    const widthFn = (t: number) => segWidth * Math.sin(Math.PI * t) ** 0.75;
    const d = taperedBlotchPath(rng, spine, widthFn, 7, 0.35);
    children.push(h('path', { d, fill: ringColor }));
  }

  const innerCount = rngInt(rng, 2, 4);
  for (let i = 0; i < innerCount; i++) {
    const angle = rngRange(rng, 0, Math.PI * 2);
    const dist = rngRange(rng, 0, r * 0.32);
    const innerR = r * rngRange(rng, 0.15, 0.26);
    const pts = irregularBlob(rng, innerR, 0.4, 5).map(
      ([x, y]) => [x + Math.cos(angle) * dist, y + Math.sin(angle) * dist] as [number, number],
    );
    children.push(h('path', { d: smoothClosedPath(pts), fill: core }));
  }
  return { node: h('g', {}, children), radius: r * 1.1 };
};

const zebraStripe: Variant = (rng, colors, size) => {
  const color = rngPick(rng, accentColors(colors));
  const angle = rngRange(rng, -35, 35);
  const len = size * rngRange(rng, 0.9, 1.2);
  const wobble = size * rngRange(rng, 0.14, 0.22);
  const maxWidth = size * rngRange(rng, 0.16, 0.26);
  const cycles = rngPick(rng, [1, 1]); // gentle single S-bend, like real zebra stripes
  const spine = (t: number): [number, number] => {
    const x = (t - 0.5) * len;
    const y = Math.sin(t * Math.PI * cycles) * wobble;
    return [x, y];
  };
  // Pinched, pointed tips instead of a constant-width rounded-cap stroke.
  const widthFn = (t: number) => maxWidth * Math.sin(Math.PI * t) ** 0.5;
  const d = taperedBlotchPath(rng, spine, widthFn, 14, 0.22);
  const node = h('path', { d, fill: color, transform: `rotate(${round(angle)})` });
  return { node, radius: (len / 2) * 1.1 };
};

const tigerStripe: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const angle = rngRange(rng, -25, 25);
  const len = size * rngRange(rng, 0.75, 1.05);
  const amp = size * rngRange(rng, 0.08, 0.16);
  const maxWidth = size * rngRange(rng, 0.1, 0.17);
  const spine = (t: number): [number, number] => {
    const x = (t - 0.5) * len;
    const y = Math.sin(t * Math.PI * 1.6) * amp;
    return [x, y];
  };
  // Tiger stripes taper to a sharper point than zebra's (higher exponent).
  const widthFn = (t: number) => maxWidth * Math.sin(Math.PI * t) ** 1.3;
  const d = taperedBlotchPath(rng, spine, widthFn, 12, 0.3);
  const node = h('path', { d, fill: color, transform: `rotate(${round(angle)})` });
  return { node, radius: r * 1.05 };
};

/** Straight-edged polygon (no curve smoothing) — reticulated giraffe
 * patches read as angular "cracked mud" cells, unlike the soft rounded
 * blobs every other variant here uses. */
function polygonPath(pts: Array<[number, number]>): string {
  let d = `M ${round(pts[0][0])} ${round(pts[0][1])} `;
  for (let i = 1; i < pts.length; i++) d += `L ${round(pts[i][0])} ${round(pts[i][1])} `;
  return d + 'Z';
}

const giraffePatch: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const pts = irregularBlob(rng, r * 0.88, 0.4, rngInt(rng, 5, 8));
  const node = h('path', { d: polygonPath(pts), fill: color });
  return { node, radius: r * 1.02 };
};

const cowPatch: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const pts = irregularBlob(rng, r * 0.9, 0.55, rngInt(rng, 6, 9));
  const children: ReturnType<typeof h>[] = [h('path', { d: smoothClosedPath(pts), fill: color })];
  // Real Holstein patches cluster — a smaller satellite blotch overlapping
  // the main one reads far more natural than one isolated perfect blob.
  if (rng() < 0.5) {
    const satAngle = rngRange(rng, 0, Math.PI * 2);
    const satDist = r * rngRange(rng, 0.45, 0.7);
    const satR = r * rngRange(rng, 0.28, 0.45);
    const satPts = irregularBlob(rng, satR, 0.5, rngInt(rng, 5, 7)).map(
      ([x, y]) => [x + Math.cos(satAngle) * satDist, y + Math.sin(satAngle) * satDist] as [number, number],
    );
    children.push(h('path', { d: smoothClosedPath(satPts), fill: color }));
  }
  return { node: h('g', {}, children), radius: r * 1.35 };
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
