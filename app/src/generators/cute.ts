import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { accentColors, blendHex } from '../palettes/palettes';
import { rngPick, rngRange, rngBool } from '../engine/rng';

// Cute / Kids generator: flat-icon-style animal faces and nursery motifs
// (bear, cat, bunny, paw prints, hearts, stars). Faces use the darkest
// palette color for eyes/nose so features stay readable on any body color.

type Variant = (rng: Rng, colors: string[], size: number) => { node: ReturnType<typeof h>; radius: number };

/** Relative luminance — used to pick the darkest color for facial features
 * and to avoid giving a face a body the same shade as the features. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function darkest(colors: string[]): string {
  return colors.reduce((a, b) => (luminance(b) < luminance(a) ? b : a));
}

function face(colors: string[], rng: Rng, r: number): { body: string; feature: string; cheek: string } {
  const accents = accentColors(colors);
  const feature = darkest(accents);
  const bodyChoices = accents.filter((c) => c !== feature);
  const body = bodyChoices.length ? rngPick(rng, bodyChoices) : accents[0];
  const cheekChoices = accents.filter((c) => c !== body && c !== feature);
  const cheek = cheekChoices.length ? rngPick(rng, cheekChoices) : feature;
  void r;
  return { body, feature, cheek };
}

function eyesAndCheeks(r: number, feature: string, cheek: string, body: string): ReturnType<typeof h>[] {
  // Cheeks were 55%-transparent cheek color over the face — pre-blend into
  // a solid tint instead (identical look, no transparency; EPS-safe).
  const cheekTint = blendHex(cheek, 0.55, body);
  return [
    h('circle', { cx: round(-r * 0.28), cy: round(-r * 0.05), r: round(r * 0.07), fill: feature }),
    h('circle', { cx: round(r * 0.28), cy: round(-r * 0.05), r: round(r * 0.07), fill: feature }),
    h('circle', { cx: round(-r * 0.45), cy: round(r * 0.18), r: round(r * 0.09), fill: cheekTint }),
    h('circle', { cx: round(r * 0.45), cy: round(r * 0.18), r: round(r * 0.09), fill: cheekTint }),
  ];
}

const bearFace: Variant = (rng, colors, size) => {
  const r = size / 2;
  const { body, feature, cheek } = face(colors, rng, r);
  const children = [
    h('circle', { cx: round(-r * 0.55), cy: round(-r * 0.55), r: round(r * 0.28), fill: body }),
    h('circle', { cx: round(r * 0.55), cy: round(-r * 0.55), r: round(r * 0.28), fill: body }),
    h('circle', { cx: 0, cy: 0, r: round(r * 0.78), fill: body }),
    ...eyesAndCheeks(r, feature, cheek, body),
    h('ellipse', { cx: 0, cy: round(r * 0.18), rx: round(r * 0.11), ry: round(r * 0.08), fill: feature }),
  ];
  // Ears sit off-center at (±0.55r, -0.55r) with their own 0.28r radius, so
  // the true extent is ~1.06r, not the face circle's 0.78r.
  return { node: h('g', {}, children), radius: r * 1.1 };
};

const catFace: Variant = (rng, colors, size) => {
  const r = size / 2;
  const { body, feature, cheek } = face(colors, rng, r);
  const children = [
    h('polygon', { points: `${round(-r * 0.72)},${round(-r * 0.3)} ${round(-r * 0.55)},${round(-r * 0.95)} ${round(-r * 0.18)},${round(-r * 0.55)}`, fill: body }),
    h('polygon', { points: `${round(r * 0.72)},${round(-r * 0.3)} ${round(r * 0.55)},${round(-r * 0.95)} ${round(r * 0.18)},${round(-r * 0.55)}`, fill: body }),
    h('circle', { cx: 0, cy: 0, r: round(r * 0.72), fill: body }),
    ...eyesAndCheeks(r, feature, cheek, body),
    h('polygon', { points: `0,${round(r * 0.1)} ${round(r * 0.07)},${round(r * 0.2)} ${round(-r * 0.07)},${round(r * 0.2)}`, fill: feature }),
    // Whiskers
    ...[-1, 1].flatMap((s) =>
      [0, 1].map((i) =>
        h('line', {
          x1: round(s * r * 0.55),
          y1: round(r * 0.02 + i * r * 0.12),
          x2: round(s * r * 0.95),
          y2: round(-r * 0.03 + i * r * 0.16),
          stroke: feature,
          'stroke-width': round(size * 0.018),
          'stroke-linecap': 'round',
        }),
      ),
    ),
  ];
  // Ear tips reach ~1.1r (triangle apex at (-0.55r,-0.95r) from origin).
  return { node: h('g', {}, children), radius: r * 1.15 };
};

const bunnyFace: Variant = (rng, colors, size) => {
  const r = size / 2;
  const { body, feature, cheek } = face(colors, rng, r);
  const earTilt = rngRange(rng, 8, 18);
  const children = [
    ...[-1, 1].map((s) =>
      h('ellipse', {
        cx: round(s * r * 0.32),
        cy: round(-r * 0.75),
        rx: round(r * 0.18),
        ry: round(r * 0.5),
        fill: body,
        transform: `rotate(${round(s * earTilt)} ${round(s * r * 0.32)} ${round(-r * 0.75)})`,
      }),
    ),
    h('circle', { cx: 0, cy: round(r * 0.05), r: round(r * 0.62), fill: body }),
    ...eyesAndCheeks(r * 0.85, feature, cheek, body),
    h('ellipse', { cx: 0, cy: round(r * 0.2), rx: round(r * 0.08), ry: round(r * 0.06), fill: feature }),
  ];
  // Ear ellipse centers are ~0.82r from origin with their own 0.5r radius —
  // worst case (tilt-dependent) reaches up to ~1.3r.
  return { node: h('g', {}, children), radius: r * 1.35 };
};

const pawPrint: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const children = [
    h('ellipse', { cx: 0, cy: round(r * 0.25), rx: round(r * 0.42), ry: round(r * 0.35), fill: color }),
    ...[-0.5, -0.17, 0.17, 0.5].map((t, i) =>
      h('circle', {
        cx: round(t * r * 1.3),
        cy: round(-r * 0.28 - (i === 1 || i === 2 ? r * 0.12 : 0)),
        r: round(r * 0.14),
        fill: color,
      }),
    ),
  ];
  return { node: h('g', {}, children), radius: r * 0.9 };
};

const puffyHeart: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const node = h('path', {
    d: `M 0 ${round(r * 0.75)} C ${round(-r * 1.05)} ${round(r * 0.05)} ${round(-r * 0.6)} ${round(-r * 0.75)} 0 ${round(-r * 0.25)} C ${round(r * 0.6)} ${round(-r * 0.75)} ${round(r * 1.05)} ${round(r * 0.05)} 0 ${round(r * 0.75)} Z`,
    fill: color,
  });
  // Bezier control points reach out to ~1.05r on each side.
  return { node, radius: r * 1.1 };
};

const twinkleStar: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const points = 5;
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r * 0.8 : r * 0.36;
    pts.push(`${round(Math.cos(angle) * radius)},${round(Math.sin(angle) * radius)}`);
  }
  const children = [h('polygon', { points: pts.join(' '), fill: color })];
  if (rngBool(rng)) {
    const feature = darkest(accentColors(colors));
    children.push(
      h('circle', { cx: round(-r * 0.14), cy: round(r * 0.02), r: round(r * 0.05), fill: feature }),
      h('circle', { cx: round(r * 0.14), cy: round(r * 0.02), r: round(r * 0.05), fill: feature }),
    );
  }
  return { node: h('g', {}, children), radius: r * 0.85 };
};

const VARIANTS: Variant[] = [bearFace, catFace, bunnyFace, pawPrint, puffyHeart, twinkleStar];

export const cuteGenerator: PatternGenerator = {
  id: 'cute',
  label: 'Cute / Kids',
  description: 'Flat-icon animal faces (bear, cat, bunny), paw prints, hearts and stars for nursery patterns.',
  defaultMotifSize: 60,
  createMotif(rng: Rng, colors: string[], size: number): Motif {
    const variant = rngPick(rng, VARIANTS);
    const { node, radius } = variant(rng, colors, size);
    return { node, radius };
  },
};
