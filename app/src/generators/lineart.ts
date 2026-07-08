import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { rngPick, rngInt, rngRange } from '../engine/rng';

// Line Art / one-line generator. Every shape is stroke-only (fill: none) —
// no filled regions at all — matching the minimal continuous-line
// illustration style popular in modern stock patterns.

type Variant = (rng: Rng, colors: string[], size: number) => { node: ReturnType<typeof h>; radius: number };

function strokeAttrs(color: string, width: number) {
  return { fill: 'none', stroke: color, 'stroke-width': round(width), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;
}

const lineLeaf: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, colors);
  const w = size * 0.055;
  const outline = `M 0 ${round(-r)} C ${round(r * 0.7)} ${round(-r * 0.4)} ${round(r * 0.7)} ${round(r * 0.4)} 0 ${round(r)} C ${round(-r * 0.7)} ${round(r * 0.4)} ${round(-r * 0.7)} ${round(-r * 0.4)} 0 ${round(-r)}`;
  const vein = `M 0 ${round(-r * 0.8)} Q ${round(r * 0.15)} 0 0 ${round(r * 0.8)}`;
  const node = h('g', {}, [
    h('path', { d: outline, ...strokeAttrs(color, w) }),
    h('path', { d: vein, ...strokeAttrs(color, w * 0.7) }),
  ]);
  return { node, radius: r * 1.05 };
};

const lineFlower: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, colors);
  const w = size * 0.05;
  const loops = rngInt(rng, 5, 6);
  const children = [];
  for (let i = 0; i < loops; i++) {
    const angle = (360 / loops) * i;
    children.push(
      h('ellipse', {
        cx: 0,
        cy: round(-r * 0.42),
        rx: round(r * 0.3),
        ry: round(r * 0.42),
        transform: `rotate(${round(angle)})`,
        ...strokeAttrs(color, w),
      }),
    );
  }
  children.push(h('circle', { cx: 0, cy: 0, r: round(r * 0.14), ...strokeAttrs(color, w) }));
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const spiralSwirl: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, colors);
  const turns = rngRange(rng, 1.5, 2.5);
  const steps = 40;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * turns * Math.PI * 2;
    const radius = t * r;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    d += i === 0 ? `M ${round(x)} ${round(y)}` : ` L ${round(x)} ${round(y)}`;
  }
  const node = h('path', { d, ...strokeAttrs(color, size * 0.045) });
  return { node, radius: r * 1.05 };
};

const wavyContour: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, colors);
  const lines = rngInt(rng, 2, 3);
  const children = [];
  for (let i = 0; i < lines; i++) {
    const y = -r * 0.5 + (r * i) / (lines - 1 || 1);
    const amp = size * rngRange(rng, 0.12, 0.22);
    children.push(
      h('path', {
        d: `M ${round(-r)} ${round(y)} Q ${round(-r / 2)} ${round(y - amp)} 0 ${round(y)} Q ${round(r / 2)} ${round(y + amp)} ${round(r)} ${round(y)}`,
        ...strokeAttrs(color, size * 0.035),
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const lineSunburst: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, colors);
  const rays = rngInt(rng, 7, 10);
  const children = [h('circle', { cx: 0, cy: 0, r: round(r * 0.4), ...strokeAttrs(color, size * 0.045) })];
  for (let i = 0; i < rays; i++) {
    const angle = ((Math.PI * 2) / rays) * i;
    children.push(
      h('line', {
        x1: round(Math.cos(angle) * r * 0.55),
        y1: round(Math.sin(angle) * r * 0.55),
        x2: round(Math.cos(angle) * r * 0.95),
        y2: round(Math.sin(angle) * r * 0.95),
        ...strokeAttrs(color, size * 0.035),
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 1.02 };
};

const VARIANTS: Variant[] = [lineLeaf, lineFlower, spiralSwirl, wavyContour, lineSunburst];

export const lineArtGenerator: PatternGenerator = {
  id: 'lineart',
  label: 'Line Art',
  description: 'Minimal stroke-only continuous-line leaves, flowers, spirals and sunbursts.',
  defaultMotifSize: 65,
  createMotif(rng: Rng, colors: string[], size: number): Motif {
    const variant = rngPick(rng, VARIANTS);
    const { node, radius } = variant(rng, colors, size);
    return { node, radius };
  },
};
