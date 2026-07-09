import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { accentColors } from '../palettes/palettes';
import { rngPick, rngInt, rngRange, rngBool } from '../engine/rng';

// Terrazzo generator: small irregular stone/glass "chips" scattered on a
// solid ground — the flooring-inspired look that's been a strong 2025-2026
// surface-pattern trend. Best on Random Scatter at high density with a
// small motif size, so chips read as flecks rather than large shapes.

type Variant = (rng: Rng, colors: string[], size: number) => { node: ReturnType<typeof h>; radius: number };

function irregularChip(rng: Rng, r: number, sides: number): string {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides + rngRange(rng, -0.25, 0.25);
    const radius = r * rngRange(rng, 0.7, 1);
    pts.push(`${round(Math.cos(angle) * radius)},${round(Math.sin(angle) * radius)}`);
  }
  return pts.join(' ');
}

const angularChip: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const sides = rngInt(rng, 3, 6);
  const node = h('polygon', { points: irregularChip(rng, r, sides), fill: color });
  return { node, radius: r * 1.05 };
};

const roundChip: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const node = h('circle', { cx: 0, cy: 0, r: round(r * rngRange(rng, 0.6, 1)), fill: color });
  return { node, radius: r };
};

const sliverChip: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const w = r * rngRange(rng, 0.3, 0.5);
  const rot = rngRange(rng, 0, 360);
  const node = h('ellipse', { cx: 0, cy: 0, rx: round(r), ry: round(w), fill: color, transform: `rotate(${round(rot)})` });
  return { node, radius: r * 1.02 };
};

const chipCluster: Variant = (rng, colors, size) => {
  const r = size / 2;
  const count = rngInt(rng, 2, 3);
  const children = [];
  for (let i = 0; i < count; i++) {
    const angle = rngRange(rng, 0, Math.PI * 2);
    const dist = rngRange(rng, 0, r * 0.4);
    const chipR = r * rngRange(rng, 0.35, 0.55);
    const cx = Math.cos(angle) * dist;
    const cy = Math.sin(angle) * dist;
    if (rngBool(rng)) {
      children.push(h('circle', { cx: round(cx), cy: round(cy), r: round(chipR), fill: rngPick(rng, accentColors(colors)) }));
    } else {
      children.push(
        h('polygon', {
          points: irregularChip(rng, chipR, rngInt(rng, 3, 5))
            .split(' ')
            .map((pair) => {
              const [x, y] = pair.split(',').map(Number);
              return `${round(x + cx)},${round(y + cy)}`;
            })
            .join(' '),
          fill: rngPick(rng, accentColors(colors)),
        }),
      );
    }
  }
  return { node: h('g', {}, children), radius: r * 1.1 };
};

const VARIANTS: Variant[] = [angularChip, roundChip, sliverChip, chipCluster];

export const terrazzoGenerator: PatternGenerator = {
  id: 'terrazzo',
  label: 'Terrazzo',
  description: 'Irregular stone/glass chip flecks on a solid ground — the flooring-inspired trend pattern. Best on Random Scatter at high density with a small motif size.',
  defaultMotifSize: 35,
  recommendedDensity: 0.85,
  createMotif(rng: Rng, colors: string[], size: number): Motif {
    const variant = rngPick(rng, VARIANTS);
    const { node, radius } = variant(rng, colors, size);
    return { node, radius };
  },
};
