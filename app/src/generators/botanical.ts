import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { accentColors, blendHex } from '../palettes/palettes';
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
  const fill = rngPick(rng, accentColors(colors));
  const veinColor = rngPick(rng, accentColors(colors));
  return h('g', {}, [
    h('path', { d: leafPath(length, width), fill }),
    h('line', {
      x1: 0,
      y1: round(-length / 2 + length * 0.1),
      x2: 0,
      y2: round(length / 2 - length * 0.1),
      // Vein sits fully on the leaf — exact pre-blend, no transparency.
      stroke: blendHex(veinColor, 0.6, fill),
      'stroke-width': round(length * 0.03),
      'stroke-linecap': 'round',
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
  const petalColor = rngPick(rng, accentColors(colors));
  const centerColor = rngPick(rng, accentColors(colors));
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
  const stemColor = rngPick(rng, accentColors(colors));
  const budColor = rngPick(rng, accentColors(colors));
  const budPath = `M 0 ${round(-r * 0.75)} C ${round(r * 0.42)} ${round(-r * 0.55)} ${round(r * 0.4)} ${round(r * 0.1)} 0 ${round(r * 0.3)} C ${round(-r * 0.4)} ${round(r * 0.1)} ${round(-r * 0.42)} ${round(-r * 0.55)} 0 ${round(-r * 0.75)} Z`;
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
    h('path', { d: budPath, fill: budColor }),
    ...(rngBool(rng)
      ? [h('g', { transform: `translate(0 ${round(r * 0.55)}) rotate(${round((rngBool(rng) ? 1 : -1) * rngRange(rng, 35, 50))})` }, [leafNode(rng, colors, r * 0.65, r * 0.32)])]
      : []),
  ]);
  return { node, radius: r * 1.05 };
};

const fernFrond: Variant = (rng, colors, size) => {
  const half = size / 2;
  const stemColor = rngPick(rng, accentColors(colors));
  const leafletColor = rngPick(rng, accentColors(colors));
  const pairs = rngInt(rng, 4, 6);
  const children = [
    h('line', { x1: 0, y1: round(-half), x2: 0, y2: round(half), stroke: stemColor, 'stroke-width': round(size * 0.03), 'stroke-linecap': 'round' }),
  ];
  for (let i = 0; i < pairs; i++) {
    const t = (i + 1) / (pairs + 1);
    const y = -half + size * t;
    const leafletLen = size * (0.28 - t * 0.12);
    for (const side of [-1, 1]) {
      children.push(
        h('path', {
          d: `M 0 ${round(y)} Q ${round(side * leafletLen * 0.7)} ${round(y - leafletLen * 0.15)} ${round(side * leafletLen)} ${round(y)} Q ${round(side * leafletLen * 0.7)} ${round(y + leafletLen * 0.15)} 0 ${round(y)} Z`,
          fill: leafletColor,
        }),
      );
    }
  }
  return { node: h('g', {}, children), radius: half * 1.1 };
};

const simpleTulip: Variant = (rng, colors, size) => {
  const r = size / 2;
  const stemColor = rngPick(rng, accentColors(colors));
  const petalColor = rngPick(rng, accentColors(colors));
  const petalW = r * 0.4;
  const petalH = r * 0.85;
  const children = [
    h('path', { d: `M 0 ${round(r * 0.15)} Q ${round(r * 0.2)} ${round(r * 0.5)} 0 ${round(r)}`, fill: 'none', stroke: stemColor, 'stroke-width': round(size * 0.045), 'stroke-linecap': 'round' }),
  ];
  for (const [dx, rot] of [[0, 0], [-petalW * 0.75, -18], [petalW * 0.75, 18]] as const) {
    children.push(
      h('path', {
        d: `M 0 0 C ${round(petalW / 2)} ${round(-petalH * 0.4)} ${round(petalW / 2)} ${round(-petalH * 0.85)} 0 ${round(-petalH)} C ${round(-petalW / 2)} ${round(-petalH * 0.85)} ${round(-petalW / 2)} ${round(-petalH * 0.4)} 0 0 Z`,
        // Side petals were 90%-transparent — pre-blend against background.
        fill: dx === 0 ? petalColor : blendHex(petalColor, 0.9, colors[0]),
        transform: `translate(${round(dx)} ${round(r * 0.15)}) rotate(${rot})`,
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 1.1 };
};

const leafyBranch: Variant = (rng, colors, size) => {
  const half = size / 2;
  const stemColor = rngPick(rng, accentColors(colors));
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

/** Two-layer bloom: an outer petal ring, an inner offset petal ring in a
 * second color, and a detailed center — reads as a "premium" flower next
 * to the flat single-ring blooms. */
const layeredBloom: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const outer = rngPick(rng, accents);
  let inner = rngPick(rng, accents);
  if (inner === outer && accents.length > 1) inner = accents[(accents.indexOf(outer) + 1) % accents.length];
  const core = rngPick(rng, accents);
  const petals = rngInt(rng, 7, 9);
  const children: ReturnType<typeof h>[] = [];
  for (let i = 0; i < petals; i++) {
    children.push(
      h('g', { transform: `rotate(${round((360 / petals) * i)})` }, [
        h('ellipse', { cx: 0, cy: round(-r * 0.58), rx: round(r * 0.2), ry: round(r * 0.42), fill: outer }),
      ]),
    );
  }
  for (let i = 0; i < petals; i++) {
    children.push(
      h('g', { transform: `rotate(${round((360 / petals) * i + 180 / petals)})` }, [
        h('ellipse', { cx: 0, cy: round(-r * 0.34), rx: round(r * 0.13), ry: round(r * 0.27), fill: blendHex(inner, 0.92, colors[0]) }),
      ]),
    );
  }
  children.push(h('circle', { cx: 0, cy: 0, r: round(r * 0.17), fill: core }));
  const dots = 6;
  for (let i = 0; i < dots; i++) {
    const a = ((Math.PI * 2) / dots) * i;
    children.push(h('circle', { cx: round(Math.cos(a) * r * 0.09), cy: round(Math.sin(a) * r * 0.09), r: round(r * 0.028), fill: colors[0] }));
  }
  return { node: h('g', { transform: `rotate(${round(rngRange(rng, 0, 45))})` }, children), radius: r * 1.05 };
};

/** Wildflower sprig: a curved stem carrying a small round flower head,
 * a pair of leaves and a bud — the loose hand-picked look that sells in
 * ditsy/meadow patterns. */
const wildflowerSprig: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const stemColor = rngPick(rng, accents);
  const headColor = rngPick(rng, accents);
  const budColor = rngPick(rng, accents);
  const bend = rngRange(rng, -0.25, 0.25);
  const children: ReturnType<typeof h>[] = [
    h('path', {
      d: `M 0 ${round(r)} Q ${round(r * bend)} ${round(r * 0.1)} ${round(r * bend * 0.6)} ${round(-r * 0.55)}`,
      fill: 'none',
      stroke: stemColor,
      'stroke-width': round(size * 0.04),
      'stroke-linecap': 'round',
    }),
  ];
  // Flower head: ring of small petal dots around a center
  const headX = r * bend * 0.6;
  const headY = -r * 0.62;
  const petals = 6;
  for (let i = 0; i < petals; i++) {
    const a = ((Math.PI * 2) / petals) * i;
    children.push(
      h('circle', { cx: round(headX + Math.cos(a) * r * 0.17), cy: round(headY + Math.sin(a) * r * 0.17), r: round(r * 0.11), fill: headColor }),
    );
  }
  children.push(h('circle', { cx: round(headX), cy: round(headY), r: round(r * 0.09), fill: blendHex(stemColor, 0.85, colors[0]) }));
  // Two leaves on the stem
  for (const [t, side] of [
    [0.32, 1],
    [0.58, -1],
  ] as const) {
    const y = r - r * 1.55 * t;
    const leafLen = size * rngRange(rng, 0.2, 0.28);
    children.push(
      h('g', { transform: `translate(${round(r * bend * t)} ${round(y)}) rotate(${round(side * rngRange(rng, 40, 60))})` }, [
        h('ellipse', { cx: 0, cy: round(-leafLen / 2), rx: round(leafLen * 0.22), ry: round(leafLen / 2), fill: rngPick(rng, accents) }),
      ]),
    );
  }
  // A bud branching off near the top
  const budSide = rngRange(rng, 0, 1) < 0.5 ? -1 : 1;
  children.push(
    h('path', {
      d: `M ${round(r * bend * 0.5)} ${round(-r * 0.25)} Q ${round(r * bend * 0.5 + budSide * r * 0.18)} ${round(-r * 0.42)} ${round(r * bend * 0.5 + budSide * r * 0.26)} ${round(-r * 0.5)}`,
      fill: 'none',
      stroke: stemColor,
      'stroke-width': round(size * 0.03),
      'stroke-linecap': 'round',
    }),
    h('ellipse', { cx: round(r * bend * 0.5 + budSide * r * 0.28), cy: round(-r * 0.54), rx: round(r * 0.07), ry: round(r * 0.1), fill: budColor }),
  );
  return { node: h('g', {}, children), radius: r * 1.1 };
};

const VARIANTS: Variant[] = [singleLeaf, flowerBloom, flowerBud, leafyBranch, fernFrond, simpleTulip, layeredBloom, wildflowerSprig];

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
