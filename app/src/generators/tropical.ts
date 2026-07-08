import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { accentColors } from '../palettes/palettes';
import { rngPick, rngInt, rngRange } from '../engine/rng';

// Tropical generator. Palm fronds, monstera leaves, hibiscus blooms and
// citrus slices — flat, saturated shapes typical of tropical/summer stock
// patterns. `colors[0]` doubles as the tile background color (set by the
// engine), which lets monstera leaves "punch" background-colored notches
// into a filled leaf shape for the classic split-leaf silhouette.

type Variant = (rng: Rng, colors: string[], size: number) => { node: ReturnType<typeof h>; radius: number };

function bladePath(length: number, width: number): string {
  const w = width / 2;
  return `M 0 0 C ${round(w)} ${round(-length * 0.35)} ${round(w * 0.6)} ${round(-length * 0.8)} 0 ${round(-length)} C ${round(-w * 0.6)} ${round(-length * 0.8)} ${round(-w)} ${round(-length * 0.35)} 0 0 Z`;
}

const palmFrond: Variant = (rng, colors, size) => {
  const bladeCount = rngInt(rng, 5, 7);
  const length = size * rngRange(rng, 0.55, 0.7);
  const width = length * 0.32;
  const spread = 130;
  const color = rngPick(rng, accentColors(colors));
  const children = [];
  for (let i = 0; i < bladeCount; i++) {
    const angle = -spread / 2 + (spread * i) / (bladeCount - 1);
    children.push(h('path', { d: bladePath(length, width), fill: color, transform: `rotate(${round(angle)})` }));
  }
  const node = h('g', { transform: `translate(0 ${round(size * 0.4)})` }, children);
  return { node, radius: size * 0.6 };
};

const monsteraLeaf: Variant = (rng, colors, size) => {
  const r = size / 2;
  const leafColor = rngPick(rng, accentColors(colors));
  const holeColor = colors[0];
  const leafPath = `M 0 ${round(-r)} C ${round(r * 0.75)} ${round(-r * 0.7)} ${round(r * 0.8)} ${round(r * 0.4)} 0 ${round(r)} C ${round(-r * 0.8)} ${round(r * 0.4)} ${round(-r * 0.75)} ${round(-r * 0.7)} 0 ${round(-r)} Z`;
  const children = [h('path', { d: leafPath, fill: leafColor })];
  const holePairs = rngInt(rng, 2, 3);
  for (let i = 0; i < holePairs; i++) {
    const t = (i + 1) / (holePairs + 1);
    const y = -r * 0.5 + r * 1.1 * t;
    const hw = r * 0.14;
    for (const side of [-1, 1]) {
      children.push(
        h('ellipse', {
          cx: round(side * r * 0.42),
          cy: round(y),
          rx: round(hw),
          ry: round(hw * 1.6),
          fill: holeColor,
          transform: `rotate(${round(side * 20)} ${round(side * r * 0.42)} ${round(y)})`,
        }),
      );
    }
  }
  children.push(
    h('line', {
      x1: 0,
      y1: round(-r * 0.9),
      x2: 0,
      y2: round(r * 0.9),
      stroke: holeColor,
      'stroke-width': round(size * 0.02),
      opacity: 0.5,
    }),
  );
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const hibiscusBloom: Variant = (rng, colors, size) => {
  const r = size / 2;
  const petals = 5;
  const petalColor = rngPick(rng, accentColors(colors));
  const centerColor = rngPick(rng, accentColors(colors));
  const petalLen = r * 0.95;
  const petalW = petalLen * 0.62;
  const children = [];
  for (let i = 0; i < petals; i++) {
    const angle = (360 / petals) * i;
    children.push(
      h('g', { transform: `rotate(${round(angle)}) translate(0 ${round(-petalLen * 0.42)})` }, [
        h('ellipse', { cx: 0, cy: 0, rx: round(petalW / 2), ry: round(petalLen / 2), fill: petalColor, opacity: 0.92 }),
      ]),
    );
  }
  children.push(h('circle', { cx: 0, cy: 0, r: round(r * 0.16), fill: centerColor }));
  children.push(
    h('line', {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: round(-r * 0.55),
      stroke: centerColor,
      'stroke-width': round(size * 0.035),
      'stroke-linecap': 'round',
    }),
  );
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const citrusSlice: Variant = (rng, colors, size) => {
  const r = size / 2;
  const rindColor = rngPick(rng, accentColors(colors));
  const fleshColor = rngPick(rng, accentColors(colors));
  const segments = rngInt(rng, 7, 10);
  const children = [
    h('circle', { cx: 0, cy: 0, r: round(r), fill: rindColor }),
    h('circle', { cx: 0, cy: 0, r: round(r * 0.88), fill: fleshColor }),
  ];
  for (let i = 0; i < segments; i++) {
    const angle = (360 / segments) * i * (Math.PI / 180);
    children.push(
      h('line', {
        x1: 0,
        y1: 0,
        x2: round(Math.cos(angle) * r * 0.85),
        y2: round(Math.sin(angle) * r * 0.85),
        stroke: rindColor,
        'stroke-width': round(size * 0.025),
      }),
    );
  }
  children.push(h('circle', { cx: 0, cy: 0, r: round(r * 0.12), fill: rindColor, opacity: 0.5 }));
  return { node: h('g', {}, children), radius: r * 1.02 };
};

const VARIANTS: Variant[] = [palmFrond, monsteraLeaf, hibiscusBloom, citrusSlice];

export const tropicalGenerator: PatternGenerator = {
  id: 'tropical',
  label: 'Tropical',
  description: 'Palm fronds, monstera leaves, hibiscus blooms and citrus slices.',
  defaultMotifSize: 75,
  createMotif(rng: Rng, colors: string[], size: number): Motif {
    const variant = rngPick(rng, VARIANTS);
    const { node, radius } = variant(rng, colors, size);
    return { node, radius };
  },
};
