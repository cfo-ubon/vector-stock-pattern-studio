import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { rngPick, rngInt, rngRange, rngBool } from '../engine/rng';

// Botanical / Floral generator. Flat, minimal leaf/flower/branch shapes
// built from simple bezier paths, ellipses and circles — no gradients or
// texture, matching the flat-illustration look common in stock florals.

type Variant = (rng: Rng, colors: string[], size: number) => { node: ReturnType<typeof h>; radius: number };

function leafPath(length: number, width: number): string {
  const w = width / 2;
  return `M 0 ${round(-length / 2)} C ${round(w)} ${round(-length / 4)} ${round(w)} ${round(length / 4)} 0 ${round(length / 2)} C ${round(-w)} ${round(length / 4)} ${round(-w)} ${round(-length / 4)} 0 ${round(-length / 2)} Z`;
}

function leafNode(rng: Rng, colors: string[], length: number, width: number): ReturnType<typeof h> {
  const fill = rngPick(rng, colors);
  const veinColor = rngPick(rng, colors);
  return h('g', {}, [
    h('path', { d: leafPath(length, width), fill }),
    h('line', {
      x1: 0,
      y1: round(-length / 2 + length * 0.1),
      x2: 0,
      y2: round(length / 2 - length * 0.1),
      stroke: veinColor,
      'stroke-width': round(length * 0.03),
      'stroke-linecap': 'round',
      opacity: 0.6,
    }),
  ]);
}

const singleLeaf: Variant = (rng, colors, size) => {
  const length = size * rngRange(rng, 0.75, 1);
  const width = length * rngRange(rng, 0.42, 0.6);
  const node = h('g', { transform: `rotate(${round(rngRange(rng, -20, 20))})` }, [leafNode(rng, colors, length, width)]);
  return { node, radius: length * 0.55 };
};

const flowerBloom: Variant = (rng, colors, size) => {
  const r = size / 2;
  const petals = rngInt(rng, 5, 7);
  const petalColor = rngPick(rng, colors);
  const centerColor = rngPick(rng, colors);
  const petalLen = r * 0.85;
  const petalW = petalLen * 0.5;
  const children = [];
  for (let i = 0; i < petals; i++) {
    const angle = (360 / petals) * i;
    children.push(
      h('g', { transform: `rotate(${round(angle)}) translate(0 ${round(-petalLen / 2)})` }, [
        h('ellipse', { cx: 0, cy: 0, rx: round(petalW / 2), ry: round(petalLen / 2), fill: petalColor }),
      ]),
    );
  }
  children.push(h('circle', { cx: 0, cy: 0, r: round(r * 0.22), fill: centerColor }));
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const flowerBud: Variant = (rng, colors, size) => {
  const r = size / 2;
  const stemColor = rngPick(rng, colors);
  const budColor = rngPick(rng, colors);
  const node = h('g', {}, [
    h('line', {
      x1: 0,
      y1: round(r * 0.2),
      x2: 0,
      y2: round(r),
      stroke: stemColor,
      'stroke-width': round(size * 0.05),
      'stroke-linecap': 'round',
    }),
    h('ellipse', { cx: 0, cy: round(-r * 0.15), rx: round(r * 0.4), ry: round(r * 0.55), fill: budColor }),
    ...(rngBool(rng)
      ? [h('g', { transform: `rotate(-35) translate(${round(r * 0.3)} ${round(r * 0.35)})` }, [leafNode(rng, colors, r * 0.7, r * 0.35)])]
      : []),
  ]);
  return { node, radius: r * 1.05 };
};

const leafyBranch: Variant = (rng, colors, size) => {
  const half = size / 2;
  const stemColor = rngPick(rng, colors);
  const leafCount = rngInt(rng, 3, 5);
  const children = [
    h('path', { d: `M 0 ${round(-half)} Q ${round(half * 0.15)} 0 0 ${round(half)}`, fill: 'none', stroke: stemColor, 'stroke-width': round(size * 0.045), 'stroke-linecap': 'round' }),
  ];
  for (let i = 0; i < leafCount; i++) {
    const t = (i + 1) / (leafCount + 1);
    const y = -half + size * t;
    const side = i % 2 === 0 ? 1 : -1;
    const leafLen = size * rngRange(rng, 0.32, 0.45);
    children.push(
      h(
        'g',
        {
          transform: `translate(0 ${round(y)}) rotate(${round(side * rngRange(rng, 45, 70))})`,
        },
        [leafNode(rng, colors, leafLen, leafLen * 0.48)],
      ),
    );
  }
  return { node: h('g', {}, children), radius: half * 1.15 };
};

const VARIANTS: Variant[] = [singleLeaf, flowerBloom, flowerBud, leafyBranch];

export const botanicalGenerator: PatternGenerator = {
  id: 'botanical',
  label: 'Botanical / Floral',
  description: 'Flat minimal leaves, blooms, buds and leafy branches.',
  defaultMotifSize: 70,
  createMotif(rng: Rng, colors: string[], size: number): Motif {
    const variant = rngPick(rng, VARIANTS);
    const { node, radius } = variant(rng, colors, size);
    return { node, radius };
  },
};
