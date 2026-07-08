import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { accentColors } from '../palettes/palettes';
import { rngPick, rngInt, rngRange, rngBool } from '../engine/rng';

// Boho / Tribal generator. Sunrise arches, crescent moons, zigzag chevrons,
// tribal diamonds and fringe/tassel motifs — the earthy, hand-drawn-but-flat
// look common in boho stock patterns. Built from stacked arcs, dashed
// strokes and simple polygons; no gradients or texture fills.

type Variant = (rng: Rng, colors: string[], size: number) => { node: ReturnType<typeof h>; radius: number };

const sunriseArch: Variant = (rng, colors, size) => {
  const r = size / 2;
  const bands = rngInt(rng, 3, 4);
  const children = [];
  for (let i = bands; i >= 1; i--) {
    const bandR = (r * i) / bands;
    children.push(
      h('path', {
        d: `M ${round(-bandR)} 0 A ${round(bandR)} ${round(bandR)} 0 0 1 ${round(bandR)} 0`,
        fill: 'none',
        stroke: rngPick(rng, accentColors(colors)),
        'stroke-width': round((r / bands) * 0.7),
        'stroke-linecap': 'round',
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const crescentMoon: Variant = (rng, colors, size) => {
  const r = size / 2;
  const moonColor = rngPick(rng, accentColors(colors));
  const bg = colors[0];
  const children = [
    h('circle', { cx: 0, cy: 0, r: round(r * 0.75), fill: moonColor }),
    h('circle', { cx: round(r * 0.32), cy: round(-r * 0.12), r: round(r * 0.68), fill: bg }),
  ];
  const starCount = rngInt(rng, 1, 3);
  for (let i = 0; i < starCount; i++) {
    const angle = rngRange(rng, 0, Math.PI * 2);
    const dist = rngRange(rng, r * 0.9, r * 1.3);
    children.push(
      h('circle', {
        cx: round(Math.cos(angle) * dist),
        cy: round(Math.sin(angle) * dist),
        r: round(r * 0.06),
        fill: rngPick(rng, accentColors(colors)),
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 1.35 };
};

const zigzagChevron: Variant = (rng, colors, size) => {
  const w = size;
  const rows = rngInt(rng, 3, 4);
  const color = rngPick(rng, accentColors(colors));
  const children = [];
  for (let row = 0; row < rows; row++) {
    const y = -size / 2 + (row * size) / (rows - 1 || 1);
    const points = [];
    const zigzags = 3;
    for (let i = 0; i <= zigzags * 2; i++) {
      const x = -w / 2 + (w * i) / (zigzags * 2);
      const yy = y + (i % 2 === 0 ? -size * 0.06 : size * 0.06);
      points.push(`${round(x)},${round(yy)}`);
    }
    children.push(
      h('polyline', { points: points.join(' '), fill: 'none', stroke: color, 'stroke-width': round(size * 0.045), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    );
  }
  return { node: h('g', {}, children), radius: (size / 2) * 1.15 };
};

const tribalDiamond: Variant = (rng, colors, size) => {
  const r = size / 2;
  const rings = rngInt(rng, 2, 3);
  const children = [];
  for (let i = 0; i < rings; i++) {
    const ringR = r * (1 - i * 0.3);
    children.push(
      h('polygon', {
        points: `0,${round(-ringR)} ${round(ringR)},0 0,${round(ringR)} ${round(-ringR)},0`,
        fill: 'none',
        stroke: rngPick(rng, accentColors(colors)),
        'stroke-width': round(size * 0.035),
      }),
    );
  }
  if (rngBool(rng)) {
    children.push(h('circle', { cx: 0, cy: 0, r: round(r * 0.12), fill: rngPick(rng, accentColors(colors)) }));
  }
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const fringeTassel: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const fringeCount = rngInt(rng, 4, 6);
  const children = [h('path', { d: `M ${round(-r * 0.6)} ${round(-r * 0.4)} A ${round(r * 0.6)} ${round(r * 0.4)} 0 0 1 ${round(r * 0.6)} ${round(-r * 0.4)}`, fill: 'none', stroke: color, 'stroke-width': round(size * 0.05), 'stroke-linecap': 'round' })];
  for (let i = 0; i < fringeCount; i++) {
    const x = -r * 0.55 + (r * 1.1 * i) / (fringeCount - 1 || 1);
    const len = r * rngRange(rng, 0.5, 0.85);
    children.push(
      h('line', {
        x1: round(x),
        y1: round(-r * 0.4),
        x2: round(x),
        y2: round(-r * 0.4 + len),
        stroke: color,
        'stroke-width': round(size * 0.025),
        'stroke-linecap': 'round',
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 1.1 };
};

const dottedArc: Variant = (rng, colors, size) => {
  const r = size / 2;
  const dotCount = rngInt(rng, 8, 12);
  const color = rngPick(rng, accentColors(colors));
  const children = [];
  for (let i = 0; i < dotCount; i++) {
    const t = i / (dotCount - 1);
    const angle = Math.PI * t;
    children.push(
      h('circle', {
        cx: round(Math.cos(angle) * r * 0.8),
        cy: round(-Math.sin(angle) * r * 0.8),
        r: round(size * 0.035),
        fill: color,
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 0.9 };
};

const VARIANTS: Variant[] = [sunriseArch, crescentMoon, zigzagChevron, tribalDiamond, fringeTassel, dottedArc];

export const bohoGenerator: PatternGenerator = {
  id: 'boho',
  label: 'Boho / Tribal',
  description: 'Sunrise arches, crescent moons, zigzag chevrons, tribal diamonds and fringe motifs.',
  defaultMotifSize: 65,
  createMotif(rng: Rng, colors: string[], size: number): Motif {
    const variant = rngPick(rng, VARIANTS);
    const { node, radius } = variant(rng, colors, size);
    return { node, radius };
  },
};
