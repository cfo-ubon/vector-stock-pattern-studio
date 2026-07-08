import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, polygonPoints, round } from '../engine/svgAst';
import { accentColors } from '../palettes/palettes';
import { rngPick, rngInt, rngBool } from '../engine/rng';

// Geometric / Scandinavian-Bauhaus generator. Every variant is built from
// flat, solid-fill primitives (circle, triangle, hexagon, line) — no
// gradients or shadows — composed around the origin so the motif can be
// rotated/scaled/translated uniformly by the engine. Each call picks one of
// several "recipes" so a single category still produces varied output.

type Variant = (rng: Rng, colors: string[], size: number) => { node: ReturnType<typeof h>; radius: number };

const concentricCircles: Variant = (rng, colors, size) => {
  const r = size / 2;
  const rings = rngInt(rng, 2, 3);
  const children = [];
  for (let i = rings; i >= 1; i--) {
    children.push(
      h('circle', {
        cx: 0,
        cy: 0,
        r: round((r * i) / rings),
        fill: rngPick(rng, accentColors(colors)),
      }),
    );
  }
  return { node: h('g', {}, children), radius: r };
};

const triangleStack: Variant = (rng, colors, size) => {
  const count = rngInt(rng, 1, 2);
  const children = [];
  for (let i = 0; i < count; i++) {
    const s = size * (1 - i * 0.35);
    const rot = i % 2 === 0 ? -90 : 90;
    children.push(
      h('polygon', {
        points: polygonPoints(0, i * size * 0.12, s / 2, 3, rot),
        fill: rngPick(rng, accentColors(colors)),
      }),
    );
  }
  return { node: h('g', {}, children), radius: (size / 2) * 1.05 };
};

const hexTile: Variant = (rng, colors, size) => {
  const r = size / 2;
  const inner = rngBool(rng);
  const children = [h('polygon', { points: polygonPoints(0, 0, r, 6, 0), fill: rngPick(rng, accentColors(colors)) })];
  if (inner) {
    children.push(h('polygon', { points: polygonPoints(0, 0, r * 0.55, 6, 0), fill: rngPick(rng, accentColors(colors)) }));
  }
  return { node: h('g', {}, children), radius: r };
};

const crossPlus: Variant = (rng, colors, size) => {
  const arm = size * 0.22;
  const len = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const children = [
    h('rect', { x: round(-arm / 2), y: round(-len), width: round(arm), height: round(len * 2), fill: color }),
    h('rect', { x: round(-len), y: round(-arm / 2), width: round(len * 2), height: round(arm), fill: color }),
  ];
  if (rngBool(rng)) {
    children.push(h('circle', { cx: 0, cy: 0, r: round(arm * 0.65), fill: rngPick(rng, accentColors(colors)) }));
  }
  return { node: h('g', {}, children), radius: (size / 2) * 1.02 };
};

const diamondGrid: Variant = (rng, colors, size) => {
  const r = size / 2;
  const rotation = rngBool(rng) ? 45 : 0;
  const children = [h('polygon', { points: polygonPoints(0, 0, r, 4, rotation), fill: rngPick(rng, accentColors(colors)) })];
  if (rngBool(rng)) {
    children.push(
      h('polygon', {
        points: polygonPoints(0, 0, r * 0.5, 4, rotation),
        fill: rngPick(rng, accentColors(colors)),
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 1.02 };
};

const stripedArc: Variant = (rng, colors, size) => {
  const r = size / 2;
  const stroke = rngPick(rng, accentColors(colors));
  const lines = rngInt(rng, 3, 5);
  const children = [];
  for (let i = 0; i < lines; i++) {
    const y = -r + (i * (2 * r)) / (lines - 1 || 1);
    children.push(
      h('line', {
        x1: round(-r),
        y1: round(y),
        x2: round(r),
        y2: round(y),
        stroke,
        'stroke-width': round(size * 0.08),
        'stroke-linecap': 'round',
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const halfMoon: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const bg = rngPick(rng, accentColors(colors));
  const node = h('g', {}, [
    h('circle', { cx: 0, cy: 0, r: round(r), fill: bg }),
    h('path', { d: `M ${round(-r)} 0 A ${round(r)} ${round(r)} 0 0 1 ${round(r)} 0 Z`, fill: color }),
  ]);
  return { node, radius: r * 1.02 };
};

const dotCluster: Variant = (rng, colors, size) => {
  const r = size / 2;
  const count = rngInt(rng, 4, 7);
  const children = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const rad = r * 0.55;
    children.push(
      h('circle', {
        cx: round(Math.cos(angle) * rad),
        cy: round(Math.sin(angle) * rad),
        r: round(size * 0.09),
        fill: rngPick(rng, accentColors(colors)),
      }),
    );
  }
  children.push(h('circle', { cx: 0, cy: 0, r: round(size * 0.1), fill: rngPick(rng, accentColors(colors)) }));
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const archShape: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const bandColor = rngPick(rng, accentColors(colors));
  const children = [
    h('path', { d: `M ${round(-r)} ${round(r)} L ${round(-r)} 0 A ${round(r)} ${round(r)} 0 0 1 ${round(r)} 0 L ${round(r)} ${round(r)} Z`, fill: color }),
  ];
  if (rngBool(rng)) {
    children.push(
      h('path', {
        d: `M ${round(-r * 0.6)} ${round(r)} L ${round(-r * 0.6)} 0 A ${round(r * 0.6)} ${round(r * 0.6)} 0 0 1 ${round(r * 0.6)} 0 L ${round(r * 0.6)} ${round(r)} Z`,
        fill: bandColor,
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const waveStripes: Variant = (rng, colors, size) => {
  const r = size / 2;
  const rows = rngInt(rng, 3, 4);
  const color = rngPick(rng, accentColors(colors));
  const children = [];
  for (let i = 0; i < rows; i++) {
    const y = -r + (i * (2 * r)) / (rows - 1 || 1);
    children.push(
      h('path', {
        d: `M ${round(-r)} ${round(y)} Q ${round(-r / 2)} ${round(y - size * 0.14)} 0 ${round(y)} Q ${round(r / 2)} ${round(y + size * 0.14)} ${round(r)} ${round(y)}`,
        fill: 'none',
        stroke: color,
        'stroke-width': round(size * 0.07),
        'stroke-linecap': 'round',
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 1.1 };
};

const VARIANTS: Variant[] = [concentricCircles, triangleStack, hexTile, crossPlus, diamondGrid, stripedArc, halfMoon, dotCluster, archShape, waveStripes];

export const geometricGenerator: PatternGenerator = {
  id: 'geometric',
  label: 'Geometric',
  description: 'Scandinavian / Bauhaus inspired shapes: circles, triangles, hexagons, crosses and stripes.',
  defaultMotifSize: 60,
  createMotif(rng: Rng, colors: string[], size: number): Motif {
    const variant = rngPick(rng, VARIANTS);
    const { node, radius } = variant(rng, colors, size);
    return { node, radius };
  },
};
