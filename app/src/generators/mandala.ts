import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { accentColors, blendHex } from '../palettes/palettes';
import { rngPick, rngInt, rngBool } from '../engine/rng';

// Mandala / Kaleidoscope generator. Each motif is itself a small mandala:
// concentric rings of petals, dots and spokes built with strict N-fold
// rotational symmetry around the origin. Because the symmetry lives inside
// the motif, these read as medallions in any layout — grid gives a classic
// "tile" arrangement, half-drop gives wallpaper, scatter gives a loose
// kaleidoscope field.

type Variant = (rng: Rng, colors: string[], size: number) => { node: ReturnType<typeof h>; radius: number };

/** Ring of identical children rotated around the origin — the basic
 * building block of every mandala variant. */
function ring(count: number, offsetDeg: number, child: (i: number) => ReturnType<typeof h>): ReturnType<typeof h>[] {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(h('g', { transform: `rotate(${round(offsetDeg + (360 / count) * i)})` }, [child(i)]));
  }
  return out;
}

function petal(len: number, width: number, dist: number, fill: string): ReturnType<typeof h> {
  return h('path', {
    d: `M 0 ${round(-dist)} C ${round(width / 2)} ${round(-dist - len * 0.35)} ${round(width / 2)} ${round(-dist - len * 0.75)} 0 ${round(-dist - len)} C ${round(-width / 2)} ${round(-dist - len * 0.75)} ${round(-width / 2)} ${round(-dist - len * 0.35)} 0 ${round(-dist)} Z`,
    fill,
  });
}

const petalRosette: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const fold = rngInt(rng, 6, 10);
  const outer = rngPick(rng, accents);
  const inner = rngPick(rng, accents);
  const core = rngPick(rng, accents);
  const children = [
    ...ring(fold, 0, () => petal(r * 0.5, r * 0.3, r * 0.42, outer)),
    // Inner ring was 95%-transparent — pre-blend against background.
    ...ring(fold, 180 / fold, () => petal(r * 0.38, r * 0.24, r * 0.22, blendHex(inner, 0.95, colors[0]))),
    h('circle', { cx: 0, cy: 0, r: round(r * 0.16), fill: core }),
    h('circle', { cx: 0, cy: 0, r: round(r * 0.07), fill: colors[0] }),
  ];
  return { node: h('g', {}, children), radius: r * 1.0 };
};

const dotMedallion: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const fold = rngInt(rng, 8, 12);
  const ringColor = rngPick(rng, accents);
  const dotColor = rngPick(rng, accents);
  const coreColor = rngPick(rng, accents);
  const children = [
    h('circle', { cx: 0, cy: 0, r: round(r * 0.55), fill: 'none', stroke: ringColor, 'stroke-width': round(size * 0.04) }),
    ...ring(fold, 0, () => h('circle', { cx: 0, cy: round(-r * 0.8), r: round(r * 0.09), fill: dotColor })),
    ...ring(fold, 180 / fold, () => h('circle', { cx: 0, cy: round(-r * 0.55), r: round(r * 0.05), fill: ringColor })),
    h('circle', { cx: 0, cy: 0, r: round(r * 0.28), fill: coreColor }),
    ...ring(6, 0, () => h('circle', { cx: 0, cy: round(-r * 0.16), r: round(r * 0.045), fill: colors[0] })),
  ];
  return { node: h('g', {}, children), radius: r * 0.95 };
};

const sunMandala: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const fold = rngInt(rng, 10, 14);
  const rayColor = rngPick(rng, accents);
  const diskColor = rngPick(rng, accents);
  const children = [
    ...ring(fold, 0, () =>
      h('polygon', {
        points: `0,${round(-r * 0.55)} ${round(r * 0.06)},${round(-r * 0.9)} ${round(-r * 0.06)},${round(-r * 0.9)}`,
        fill: rayColor,
      }),
    ),
    h('circle', { cx: 0, cy: 0, r: round(r * 0.48), fill: diskColor }),
    h('circle', { cx: 0, cy: 0, r: round(r * 0.34), fill: 'none', stroke: colors[0], 'stroke-width': round(size * 0.025) }),
    ...(rngBool(rng)
      ? ring(8, 0, () => h('circle', { cx: 0, cy: round(-r * 0.2), r: round(r * 0.04), fill: colors[0] }))
      : [h('circle', { cx: 0, cy: 0, r: round(r * 0.1), fill: rayColor })]),
  ];
  return { node: h('g', {}, children), radius: r * 0.95 };
};

const lotusRing: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const fold = rngInt(rng, 5, 8);
  const outer = rngPick(rng, accents);
  const mid = rngPick(rng, accents);
  const children = [
    ...ring(fold, 0, () => petal(r * 0.62, r * 0.42, r * 0.3, outer)),
    // Mid ring was 92%-transparent — pre-blend against background.
    ...ring(fold, 180 / fold, () => petal(r * 0.45, r * 0.3, r * 0.18, blendHex(mid, 0.92, colors[0]))),
    h('circle', { cx: 0, cy: 0, r: round(r * 0.2), fill: rngPick(rng, accents) }),
  ];
  return { node: h('g', {}, children), radius: r * 1.0 };
};

const VARIANTS: Variant[] = [petalRosette, dotMedallion, sunMandala, lotusRing];

export const mandalaGenerator: PatternGenerator = {
  id: 'mandala',
  label: 'Mandala',
  description: 'Medallions with strict rotational symmetry: petal rosettes, dotted rings, sunbursts and lotus.',
  defaultMotifSize: 90,
  createMotif(rng: Rng, colors: string[], size: number): Motif {
    const variant = rngPick(rng, VARIANTS);
    const { node, radius } = variant(rng, colors, size);
    return { node, radius };
  },
};
