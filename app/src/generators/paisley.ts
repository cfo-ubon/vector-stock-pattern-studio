import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { accentColors } from '../palettes/palettes';
import { rngPick, rngInt, rngRange, rngBool } from '../engine/rng';

// Paisley & Ikat generator: the Persian teardrop (boteh) motif and the
// soft-feathered-edge diamond/chevron look of ikat weaving — both huge,
// long-running bestsellers in boho/ethnic textile stock. Ikat's signature
// "blurred" edge is faked with 2-3 flat, decreasing-opacity offset copies
// instead of a gradient, keeping every shape solid-fill/no-filter.

type Variant = (rng: Rng, colors: string[], size: number) => { node: ReturnType<typeof h>; radius: number };

function paisleyPath(r: number): string {
  // A teardrop that curls back on itself at the top — the boteh silhouette.
  return `M 0 ${round(r)} C ${round(r * 0.9)} ${round(r * 0.6)} ${round(r * 0.85)} ${round(-r * 0.1)} ${round(r * 0.35)} ${round(-r * 0.55)} C ${round(r * 0.05)} ${round(-r * 0.8)} ${round(-r * 0.35)} ${round(-r * 0.75)} ${round(-r * 0.3)} ${round(-r * 0.4)} C ${round(-r * 0.27)} ${round(-r * 0.18)} ${round(-r * 0.05)} ${round(-r * 0.05)} ${round(r * 0.05)} ${round(-r * 0.18)} C ${round(r * 0.12)} ${round(-r * 0.28)} ${round(r * 0.02)} ${round(-r * 0.4)} ${round(-r * 0.12)} ${round(-r * 0.38)} C ${round(-r * 0.55)} ${round(-r * 0.3)} ${round(-r * 0.7)} ${round(r * 0.15)} 0 ${round(r)} Z`;
}

const paisleyTeardrop: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const body = rngPick(rng, accents);
  const detail = rngPick(rng, accents);
  const rot = rngRange(rng, -20, 20);
  const children = [h('path', { d: paisleyPath(r), fill: body, transform: `rotate(${round(rot)})` })];
  if (rngBool(rng)) {
    const dotCount = rngInt(rng, 3, 5);
    for (let i = 0; i < dotCount; i++) {
      const t = (i + 1) / (dotCount + 1);
      children.push(
        h('circle', {
          cx: round(Math.sin((rot * Math.PI) / 180) * r * 0.2 * t),
          cy: round(r * (0.6 - t * 1.1)),
          r: round(r * 0.06),
          fill: detail,
          transform: `rotate(${round(rot)})`,
        }),
      );
    }
  }
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const paisleySwirl: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const body = rngPick(rng, accents);
  const rot = rngRange(rng, 0, 360);
  const node = h('g', { transform: `rotate(${round(rot)})` }, [
    h('path', { d: paisleyPath(r * 0.8), fill: body }),
    h('circle', { cx: 0, cy: round(-r * 0.3), r: round(r * 0.12), fill: rngPick(rng, accents) }),
  ]);
  return { node, radius: r * 0.9 };
};

const ikatDiamond: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const color = rngPick(rng, accents);
  const layers = 3;
  const children = [];
  for (let i = 0; i < layers; i++) {
    const layerR = r * (1 - i * 0.22);
    const jitterX = rngRange(rng, -r * 0.06, r * 0.06);
    children.push(
      h('polygon', {
        points: `${round(jitterX)},${round(-layerR)} ${round(layerR + jitterX)},0 ${round(jitterX)},${round(layerR)} ${round(-layerR + jitterX)},0`,
        fill: color,
        opacity: round(0.35 + (i / (layers - 1)) * 0.5),
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const ikatChevron: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const color = rngPick(rng, accents);
  const layers = 3;
  const children = [];
  for (let i = 0; i < layers; i++) {
    const off = r * (1 - i * 0.28);
    const jitter = rngRange(rng, -r * 0.05, r * 0.05);
    children.push(
      h('polyline', {
        points: `${round(-r)},${round(-off + jitter)} 0,${round(off * 0.2 + jitter)} ${round(r)},${round(-off + jitter)}`,
        fill: 'none',
        stroke: color,
        'stroke-width': round(size * 0.09),
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        opacity: round(0.4 + (i / (layers - 1)) * 0.5),
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const PAISLEY_POOL: Variant[] = [paisleyTeardrop, paisleySwirl];
const IKAT_POOL: Variant[] = [ikatDiamond, ikatChevron];

// Paisley's curling teardrops and ikat's blurred-edge geometric diamonds
// are two distinct visual languages — mixing both in one tile reads as
// inconsistent, not varied. Pick one family per tile (still varies within
// that family), the same fix as Plaid/Check and Seasonal.
let currentPool: Variant[] = PAISLEY_POOL;

export const paisleyGenerator: PatternGenerator = {
  id: 'paisley',
  label: 'Paisley & Ikat',
  description: 'Persian teardrop paisley (boteh) or soft-edged ikat diamonds/chevrons — one family per pattern. Long-running boho/ethnic textile bestsellers.',
  defaultMotifSize: 75,
  beginTile(rng: Rng) {
    currentPool = rngInt(rng, 0, 1) === 0 ? PAISLEY_POOL : IKAT_POOL;
  },
  createMotif(rng: Rng, colors: string[], size: number): Motif {
    const variant = rngPick(rng, currentPool);
    const { node, radius } = variant(rng, colors, size);
    return { node, radius };
  },
};
