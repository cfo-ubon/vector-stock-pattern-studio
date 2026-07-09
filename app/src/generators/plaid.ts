import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { accentColors } from '../palettes/palettes';
import { rngPick, rngBool } from '../engine/rng';

// Plaid & Check generator: the classic evergreen textile family —
// checkerboard, gingham, tartan/plaid, houndstooth, pinstripe and argyle.
// Best paired with the Grid layout at high density (these are "field"
// patterns meant to abut edge-to-edge, not scattered icons). Checkerboard
// and gingham specifically need their color to alternate by true grid
// *position*, not per-motif randomness — an independently-random checker
// square just looks broken — so they read `colorSeed` (the engine passes
// each placement's row+col from grid/brick/half-drop) and pick color by
// its parity instead of calling rngPick for the fill.

type Variant = (rng: Rng, colors: string[], size: number, colorSeed?: number) => { node: ReturnType<typeof h>; radius: number };

/** Pick a color by position parity when colorSeed is available (true
 * alternation), falling back to a random pick for layouts that don't have
 * a 2D grid (scatter/radial) so the generator still works everywhere. */
function alternate(rng: Rng, accents: string[], colorSeed: number | undefined, mod: number): string {
  if (colorSeed === undefined) return rngPick(rng, accents);
  return accents[colorSeed % mod % accents.length];
}

const checkerboardSquare: Variant = (rng, colors, size, colorSeed) => {
  const accents = accentColors(colors);
  const fill = accents.length >= 2 ? alternate(rng, accents, colorSeed, 2) : accents[0];
  const node = h('rect', { x: round(-size / 2), y: round(-size / 2), width: round(size), height: round(size), fill });
  return { node, radius: (size / 2) * Math.SQRT2 };
};

const ginghamCheck: Variant = (rng, colors, size, colorSeed) => {
  const accents = accentColors(colors);
  const base = colors[0];
  const band = accents.length >= 2 ? alternate(rng, accents, colorSeed, 2) : accents[0];
  const half = size / 2;
  const node = h('g', {}, [
    h('rect', { x: round(-half), y: round(-half), width: round(size), height: round(size), fill: base }),
    // Horizontal + vertical bands at partial opacity: where they cross,
    // the overlapping alpha stacks into a third, darker tone — the visual
    // signature of a woven gingham check.
    h('rect', { x: round(-half), y: round(-half * 0.5), width: round(size), height: round(size * 0.5), fill: band, opacity: 0.55 }),
    h('rect', { x: round(-half * 0.5), y: round(-half), width: round(size * 0.5), height: round(size), fill: band, opacity: 0.55 }),
  ]);
  return { node, radius: (size / 2) * Math.SQRT2 };
};

const tartanPlaid: Variant = (rng, colors, size, colorSeed) => {
  const accents = accentColors(colors);
  const base = accents.length >= 2 ? alternate(rng, accents, colorSeed, 2) : accents[0];
  const half = size / 2;
  const bandColors = [rngPick(rng, accents), rngPick(rng, accents)];
  const children: ReturnType<typeof h>[] = [h('rect', { x: round(-half), y: round(-half), width: round(size), height: round(size), fill: base })];
  const bandSpecs = [
    { pos: -half * 0.55, w: size * 0.16 },
    { pos: half * 0.1, w: size * 0.28 },
    { pos: half * 0.6, w: size * 0.1 },
  ];
  for (const [i, spec] of bandSpecs.entries()) {
    const c = bandColors[i % bandColors.length];
    children.push(h('rect', { x: round(-half), y: round(spec.pos - spec.w / 2), width: round(size), height: round(spec.w), fill: c, opacity: 0.6 }));
    children.push(h('rect', { x: round(spec.pos - spec.w / 2), y: round(-half), width: round(spec.w), height: round(size), fill: c, opacity: 0.6 }));
  }
  return { node: h('g', {}, children), radius: (size / 2) * Math.SQRT2 };
};

/** Classic "dogtooth" notched-square unit — two offset L-shaped notches
 * cut into opposite corners of a square, which is what makes adjacent
 * alternating-color copies interlock into the houndstooth look. */
const houndstoothUnit: Variant = (rng, colors, size, colorSeed) => {
  const accents = accentColors(colors);
  const fill = accents.length >= 2 ? alternate(rng, accents, colorSeed, 2) : accents[0];
  const s = size / 2;
  const pts = [
    [-s, -s], [0, -s], [0, -s * 0.5], [s * 0.5, -s * 0.5], [s * 0.5, 0], [s, 0],
    [s, s], [0, s], [0, s * 0.5], [-s * 0.5, s * 0.5], [-s * 0.5, 0], [-s, 0],
  ];
  const points = pts.map(([x, y]) => `${round(x)},${round(y)}`).join(' ');
  return { node: h('polygon', { points, fill }), radius: s * Math.SQRT2 };
};

const pinstripeBar: Variant = (rng, colors, size) => {
  const accents = accentColors(colors);
  const color = rngPick(rng, accents);
  const w = size * 0.14;
  const node = h('rect', { x: round(-w / 2), y: round(-size / 2), width: round(w), height: round(size), fill: color });
  return { node, radius: size / 2 };
};

const argyleDiamond: Variant = (rng, colors, size, colorSeed) => {
  const accents = accentColors(colors);
  const base = accents.length >= 2 ? alternate(rng, accents, colorSeed, 2) : accents[0];
  const lineColor = rngPick(rng, accents);
  const s = size / 2;
  const children = [
    h('polygon', { points: `0,${round(-s)} ${round(s)},0 0,${round(s)} ${round(-s)},0`, fill: base }),
    h('line', { x1: round(-s), y1: round(-s), x2: round(s), y2: round(s), stroke: lineColor, 'stroke-width': round(size * 0.03) }),
    h('line', { x1: round(-s), y1: round(s), x2: round(s), y2: round(-s), stroke: lineColor, 'stroke-width': round(size * 0.03) }),
  ];
  if (rngBool(rng)) {
    children.push(h('polygon', { points: `0,${round(-s * 0.5)} ${round(s * 0.5)},0 0,${round(s * 0.5)} ${round(-s * 0.5)},0`, fill: 'none', stroke: rngPick(rng, accents), 'stroke-width': round(size * 0.025) }));
  }
  return { node: h('g', {}, children), radius: s * 1.05 };
};

const VARIANTS: Variant[] = [checkerboardSquare, ginghamCheck, tartanPlaid, houndstoothUnit, pinstripeBar, argyleDiamond];

// Real plaid/check fabrics are always ONE consistent style repeated — a
// tile that randomly mixed checkerboard squares with houndstooth and
// pinstripes in the same repeat would look like a mistake, not a fabric.
// So the style is chosen once per tile (like Seasonal's holiday theme),
// not re-rolled per motif.
let currentVariant: Variant = checkerboardSquare;

export const plaidGenerator: PatternGenerator = {
  id: 'plaid',
  label: 'Plaid & Check',
  description: 'Checkerboard, gingham, tartan plaid, houndstooth, pinstripe or argyle — one consistent style per pattern. Best on Grid layout at 90-100% density.',
  defaultMotifSize: 100,
  recommendedDensity: 0.9,
  disableGridRhythm: true,
  beginTile(rng: Rng) {
    currentVariant = rngPick(rng, VARIANTS);
  },
  createMotif(rng: Rng, colors: string[], size: number, colorSeed?: number): Motif {
    const { node, radius } = currentVariant(rng, colors, size, colorSeed);
    return { node, radius };
  },
};
