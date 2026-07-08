import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round, smoothClosedPath } from '../engine/svgAst';
import { accentColors } from '../palettes/palettes';
import { rngPick, rngInt, rngRange, rngBool } from '../engine/rng';

// Abstract Organic generator. Memphis / Matisse cut-out inspired: irregular
// blobs and free curves built by perturbing a circle's radius at N points
// and smoothing through them with Catmull-Rom splines — flat solid fills,
// no gradients.

type Variant = (rng: Rng, colors: string[], size: number) => { node: ReturnType<typeof h>; radius: number };

function blobPoints(rng: Rng, r: number, pointCount: number, irregularity: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < pointCount; i++) {
    const angle = (Math.PI * 2 * i) / pointCount;
    const radius = r * (1 - irregularity / 2 + rng() * irregularity);
    pts.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  return pts;
}

const freeBlob: Variant = (rng, colors, size) => {
  const r = size / 2;
  const pts = blobPoints(rng, r, rngInt(rng, 7, 11), rngRange(rng, 0.2, 0.45));
  const node = h('path', { d: smoothClosedPath(pts), fill: rngPick(rng, accentColors(colors)) });
  return { node, radius: r * 1.1 };
};

const layeredBlob: Variant = (rng, colors, size) => {
  const r = size / 2;
  const layers = rngInt(rng, 2, 3);
  const children = [];
  for (let i = 0; i < layers; i++) {
    const layerR = r * (1 - i * 0.24);
    const pts = blobPoints(rng, layerR, rngInt(rng, 7, 10), rngRange(rng, 0.15, 0.3));
    const offsetAngle = rngRange(rng, 0, Math.PI * 2);
    const offsetDist = i === 0 ? 0 : r * 0.12;
    const ox = Math.cos(offsetAngle) * offsetDist;
    const oy = Math.sin(offsetAngle) * offsetDist;
    children.push(
      h('path', {
        d: smoothClosedPath(pts.map(([x, y]) => [x + ox, y + oy])),
        fill: rngPick(rng, accentColors(colors)),
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 1.15 };
};

const blobWithAccent: Variant = (rng, colors, size) => {
  const r = size / 2;
  const pts = blobPoints(rng, r, rngInt(rng, 6, 8), rngRange(rng, 0.2, 0.4));
  const accentR = r * rngRange(rng, 0.18, 0.3);
  const angle = rngRange(rng, 0, Math.PI * 2);
  const dist = r * rngRange(rng, 0.3, 0.55);
  const node = h('g', {}, [
    h('path', { d: smoothClosedPath(pts), fill: rngPick(rng, accentColors(colors)) }),
    h('circle', {
      cx: round(Math.cos(angle) * dist),
      cy: round(Math.sin(angle) * dist),
      r: round(accentR),
      fill: rngPick(rng, accentColors(colors)),
    }),
  ]);
  return { node, radius: r * 1.1 };
};

const squiggleLine: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const amp = r * rngRange(rng, 0.3, 0.55);
  const d = `M ${round(-r)} 0 Q ${round(-r / 2)} ${round(-amp)} 0 0 Q ${round(r / 2)} ${round(amp)} ${round(r)} 0`;
  const node = h('path', {
    d,
    fill: 'none',
    stroke: color,
    'stroke-width': round(size * 0.09),
    'stroke-linecap': 'round',
  });
  return { node, radius: r * 1.05 };
};

const cutoutArcStack: Variant = (rng, colors, size) => {
  const r = size / 2;
  const layers = rngInt(rng, 2, 3);
  const children = [];
  for (let i = 0; i < layers; i++) {
    const layerR = r * (1 - i * 0.28);
    const sweep = rngBool(rng) ? 1 : 0;
    children.push(
      h('path', {
        d: `M ${round(-layerR)} 0 A ${round(layerR)} ${round(layerR)} 0 0 ${sweep} ${round(layerR)} 0 L 0 0 Z`,
        fill: rngPick(rng, accentColors(colors)),
        transform: `rotate(${round(rngRange(rng, 0, 360))})`,
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const confettiCluster: Variant = (rng, colors, size) => {
  const r = size / 2;
  const count = rngInt(rng, 3, 5);
  const children = [];
  for (let i = 0; i < count; i++) {
    const angle = rngRange(rng, 0, Math.PI * 2);
    const dist = rngRange(rng, 0, r * 0.6);
    const shapeR = r * rngRange(rng, 0.12, 0.22);
    const cx = Math.cos(angle) * dist;
    const cy = Math.sin(angle) * dist;
    if (rngBool(rng)) {
      children.push(h('circle', { cx: round(cx), cy: round(cy), r: round(shapeR), fill: rngPick(rng, accentColors(colors)) }));
    } else {
      const pts = blobPoints(rng, shapeR, 5, 0.4).map(([x, y]) => [x + cx, y + cy] as [number, number]);
      children.push(h('path', { d: smoothClosedPath(pts), fill: rngPick(rng, accentColors(colors)) }));
    }
  }
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const VARIANTS: Variant[] = [freeBlob, layeredBlob, blobWithAccent, squiggleLine, cutoutArcStack, confettiCluster];

export const organicGenerator: PatternGenerator = {
  id: 'organic',
  label: 'Abstract Organic',
  description: 'Memphis / Matisse cut-out inspired blobs, squiggles and confetti shapes.',
  defaultMotifSize: 65,
  createMotif(rng: Rng, colors: string[], size: number): Motif {
    const variant = rngPick(rng, VARIANTS);
    const { node, radius } = variant(rng, colors, size);
    return { node, radius };
  },
};
