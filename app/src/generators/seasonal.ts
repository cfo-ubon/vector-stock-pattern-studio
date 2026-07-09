import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round, polygonPoints } from '../engine/svgAst';
import { accentColors, blendHex } from '../palettes/palettes';
import { rngPick, rngInt, rngRange, rngBool } from '../engine/rng';

// Seasonal / Holiday generator: Christmas and Halloween motif pools.
// The sub-theme is chosen once per tile in beginTile() (from the same
// seeded rng) so a single pattern never mixes pumpkins with snowflakes —
// each generated tile is coherently one holiday, but different seeds can
// land on different holidays.

type Variant = (rng: Rng, colors: string[], size: number) => { node: ReturnType<typeof h>; radius: number };

// --- Christmas pool ---

const snowflake: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const arms = 6;
  const w = size * 0.04;
  const children = [];
  for (let i = 0; i < arms; i++) {
    const angle = (360 / arms) * i;
    children.push(
      h('g', { transform: `rotate(${angle})` }, [
        h('line', { x1: 0, y1: 0, x2: 0, y2: round(-r * 0.9), stroke: color, 'stroke-width': round(w), 'stroke-linecap': 'round' }),
        h('line', { x1: 0, y1: round(-r * 0.55), x2: round(r * 0.18), y2: round(-r * 0.72), stroke: color, 'stroke-width': round(w * 0.8), 'stroke-linecap': 'round' }),
        h('line', { x1: 0, y1: round(-r * 0.55), x2: round(-r * 0.18), y2: round(-r * 0.72), stroke: color, 'stroke-width': round(w * 0.8), 'stroke-linecap': 'round' }),
      ]),
    );
  }
  return { node: h('g', {}, children), radius: r * 0.95 };
};

const pineTree: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const tree = rngPick(rng, accents);
  const trunk = rngPick(rng, accents);
  const tiers = 3;
  const children = [];
  for (let i = 0; i < tiers; i++) {
    const w = r * (0.9 - i * 0.22);
    const top = -r + (i * r) / 2.1;
    children.push(
      h('polygon', {
        points: `0,${round(top)} ${round(w)},${round(top + r * 0.62)} ${round(-w)},${round(top + r * 0.62)}`,
        fill: tree,
      }),
    );
  }
  children.push(h('rect', { x: round(-r * 0.1), y: round(r * 0.55), width: round(r * 0.2), height: round(r * 0.3), fill: trunk }));
  if (rngBool(rng)) {
    children.push(h('circle', { cx: 0, cy: round(-r), r: round(r * 0.1), fill: rngPick(rng, accents) }));
  }
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const ornamentBall: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const ball = rngPick(rng, accents);
  const band = rngPick(rng, accents);
  return {
    node: h('g', {}, [
      h('rect', { x: round(-r * 0.08), y: round(-r * 0.95), width: round(r * 0.16), height: round(r * 0.2), fill: band }),
      h('circle', { cx: 0, cy: round(r * 0.05), r: round(r * 0.68), fill: ball }),
      h('path', {
        d: `M ${round(-r * 0.62)} ${round(-r * 0.1)} Q 0 ${round(r * 0.15)} ${round(r * 0.62)} ${round(-r * 0.1)}`,
        fill: 'none',
        stroke: band,
        'stroke-width': round(size * 0.045),
      }),
    ]),
    radius: r * 1.0,
  };
};

const hollySprig: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const leaf = rngPick(rng, accents);
  const berry = rngPick(rng, accents);
  const leafPath = (flip: number) =>
    h('path', {
      d: `M 0 0 Q ${round(flip * r * 0.25)} ${round(-r * 0.3)} ${round(flip * r * 0.55)} ${round(-r * 0.35)} Q ${round(flip * r * 0.5)} ${round(-r * 0.15)} ${round(flip * r * 0.75)} ${round(-r * 0.05)} Q ${round(flip * r * 0.45)} ${round(r * 0.1)} 0 0 Z`,
      fill: leaf,
    });
  return {
    node: h('g', {}, [
      leafPath(1),
      leafPath(-1),
      h('circle', { cx: 0, cy: round(r * 0.12), r: round(r * 0.12), fill: berry }),
      h('circle', { cx: round(-r * 0.18), cy: round(r * 0.02), r: round(r * 0.1), fill: berry }),
      h('circle', { cx: round(r * 0.18), cy: round(r * 0.02), r: round(r * 0.1), fill: berry }),
    ]),
    radius: r * 0.85,
  };
};

const candyCane: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const cane = rngPick(rng, accents);
  const stripe = colors[0];
  const w = size * 0.14;
  return {
    node: h('g', {}, [
      h('path', {
        d: `M ${round(-r * 0.15)} ${round(r * 0.85)} L ${round(-r * 0.15)} ${round(-r * 0.4)} A ${round(r * 0.35)} ${round(r * 0.35)} 0 0 1 ${round(r * 0.55)} ${round(-r * 0.4)}`,
        fill: 'none',
        stroke: cane,
        'stroke-width': round(w),
        'stroke-linecap': 'round',
      }),
      ...[0.6, 0.25, -0.1].map((t) =>
        h('line', {
          x1: round(-r * 0.15 - w / 2),
          y1: round(r * t),
          x2: round(-r * 0.15 + w / 2),
          y2: round(r * t - w * 0.4),
          stroke: stripe,
          'stroke-width': round(w * 0.32),
        }),
      ),
    ]),
    radius: r * 1.0,
  };
};

// --- Halloween pool ---

const pumpkin: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const body = rngPick(rng, accents);
  const stem = rngPick(rng, accents);
  return {
    node: h('g', {}, [
      h('rect', { x: round(-r * 0.08), y: round(-r * 0.85), width: round(r * 0.16), height: round(r * 0.3), rx: round(r * 0.05), fill: stem }),
      // Side lobes were 90%-transparent for a subtle two-tone pumpkin —
      // pre-blend against the background instead (EPS-safe).
      h('ellipse', { cx: round(-r * 0.34), cy: 0, rx: round(r * 0.32), ry: round(r * 0.55), fill: blendHex(body, 0.9, colors[0]) }),
      h('ellipse', { cx: round(r * 0.34), cy: 0, rx: round(r * 0.32), ry: round(r * 0.55), fill: blendHex(body, 0.9, colors[0]) }),
      h('ellipse', { cx: 0, cy: 0, rx: round(r * 0.38), ry: round(r * 0.6), fill: body }),
    ]),
    radius: r * 0.9,
  };
};

const ghost: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const body = rngPick(rng, accents);
  const eye = colors[0];
  return {
    node: h('g', {}, [
      h('path', {
        d: `M ${round(-r * 0.5)} ${round(r * 0.6)} L ${round(-r * 0.5)} ${round(-r * 0.1)} A ${round(r * 0.5)} ${round(r * 0.5)} 0 0 1 ${round(r * 0.5)} ${round(-r * 0.1)} L ${round(r * 0.5)} ${round(r * 0.6)} L ${round(r * 0.25)} ${round(r * 0.42)} L 0 ${round(r * 0.6)} L ${round(-r * 0.25)} ${round(r * 0.42)} Z`,
        fill: body,
      }),
      h('circle', { cx: round(-r * 0.18), cy: round(-r * 0.12), r: round(r * 0.08), fill: eye }),
      h('circle', { cx: round(r * 0.18), cy: round(-r * 0.12), r: round(r * 0.08), fill: eye }),
    ]),
    radius: r * 0.85,
  };
};

const bat: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const wing = (flip: number) =>
    h('path', {
      d: `M ${round(flip * r * 0.15)} 0 Q ${round(flip * r * 0.45)} ${round(-r * 0.35)} ${round(flip * r * 0.95)} ${round(-r * 0.25)} Q ${round(flip * r * 0.75)} ${round(-r * 0.02)} ${round(flip * r * 0.85)} ${round(r * 0.18)} Q ${round(flip * r * 0.5)} ${round(r * 0.02)} ${round(flip * r * 0.15)} ${round(r * 0.15)} Z`,
      fill: color,
    });
  return {
    node: h('g', {}, [
      wing(1),
      wing(-1),
      h('ellipse', { cx: 0, cy: 0, rx: round(r * 0.18), ry: round(r * 0.26), fill: color }),
      h('polygon', { points: `${round(-r * 0.12)},${round(-r * 0.2)} ${round(-r * 0.04)},${round(-r * 0.38)} ${round(-r * 0.01)},${round(-r * 0.2)}`, fill: color }),
      h('polygon', { points: `${round(r * 0.12)},${round(-r * 0.2)} ${round(r * 0.04)},${round(-r * 0.38)} ${round(r * 0.01)},${round(-r * 0.2)}`, fill: color }),
    ]),
    radius: r * 0.95,
  };
};

const spookyStar: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r * 0.6 : r * 0.22;
    pts.push(`${round(Math.cos(angle) * radius)},${round(Math.sin(angle) * radius)}`);
  }
  const children = [h('polygon', { points: pts.join(' '), fill: color })];
  if (rngBool(rng)) {
    children.push(h('circle', { cx: round(r * rngRange(rng, 0.5, 0.7)), cy: round(-r * rngRange(rng, 0.4, 0.6)), r: round(r * 0.07), fill: color }));
  }
  return { node: h('g', {}, children), radius: r * 0.9 };
};

const spiderWeb: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const spokes = 6;
  const w = size * 0.03;
  const children = [];
  for (let i = 0; i < spokes; i++) {
    const angle = ((Math.PI * 2) / spokes) * i;
    children.push(
      h('line', { x1: 0, y1: 0, x2: round(Math.cos(angle) * r * 0.85), y2: round(Math.sin(angle) * r * 0.85), stroke: color, 'stroke-width': round(w) }),
    );
  }
  for (const ringR of [0.35, 0.6, 0.85]) {
    children.push(h('polygon', { points: polygonPoints(0, 0, r * ringR, spokes, -90), fill: 'none', stroke: color, 'stroke-width': round(w) }));
  }
  return { node: h('g', {}, children), radius: r * 0.9 };
};

const CHRISTMAS: Variant[] = [snowflake, pineTree, ornamentBall, hollySprig, candyCane];
const HALLOWEEN: Variant[] = [pumpkin, ghost, bat, spookyStar, spiderWeb];

let currentPool: Variant[] = CHRISTMAS;

export const seasonalGenerator: PatternGenerator = {
  id: 'seasonal',
  label: 'Seasonal / Holiday',
  description: 'Christmas (trees, snowflakes, holly, candy canes) or Halloween (pumpkins, ghosts, bats) — one theme per tile.',
  defaultMotifSize: 65,
  beginTile(rng: Rng) {
    currentPool = rngInt(rng, 0, 1) === 0 ? CHRISTMAS : HALLOWEEN;
  },
  createMotif(rng: Rng, colors: string[], size: number): Motif {
    const variant = rngPick(rng, currentPool);
    const { node, radius } = variant(rng, colors, size);
    return { node, radius };
  },
};
