import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round, smoothClosedPath } from '../engine/svgAst';
import { accentColors, blendHex } from '../palettes/palettes';
import { rngPick, rngInt, rngBool } from '../engine/rng';

// Mandala / Kaleidoscope generator. Each motif is itself a small mandala:
// concentric rings of petals, dots, scalloped lace and spokes built with
// strict N-fold rotational symmetry around the origin. Because the symmetry
// lives inside the motif, these read as medallions in any layout — grid
// gives a classic "tile" arrangement, half-drop gives wallpaper, scatter
// gives a loose kaleidoscope field.

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

/** A delicate scalloped/lace ring: radius modulated by a sine wave with
 * `bumpCount` lobes, sampled densely and smoothed — the fine wavy trim
 * real mandala art uses between petal tiers instead of a plain circle. */
function scallopRingPath(bumpCount: number, baseR: number, amp: number): string {
  const samples = Math.max(72, bumpCount * 8);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < samples; i++) {
    const theta = (i / samples) * Math.PI * 2;
    const rr = baseR + amp * Math.sin(theta * bumpCount);
    pts.push([Math.cos(theta) * rr, Math.sin(theta) * rr]);
  }
  return smoothClosedPath(pts);
}

/** Fine radial tick marks between two radii — the short spokes real
 * mandala medallions use to fill the gap between a dot ring and a border
 * ring instead of leaving it empty. */
function spokeTicks(count: number, r0: number, r1: number, color: string, width: number): ReturnType<typeof h>[] {
  return ring(count, 0, () =>
    h('line', { x1: 0, y1: round(-r0), x2: 0, y2: round(-r1), stroke: color, 'stroke-width': round(width), 'stroke-linecap': 'round' }),
  );
}

/** A petal, optionally with a single centerline vein stroke (the crease
 * real flower petals have) — `vein` omitted gives the old plain-fill look
 * for the smaller/inner tiers where the vein would just be visual noise. */
function petal(len: number, width: number, dist: number, fill: string, vein?: string): ReturnType<typeof h> {
  const path = h('path', {
    d: `M 0 ${round(-dist)} C ${round(width / 2)} ${round(-dist - len * 0.35)} ${round(width / 2)} ${round(-dist - len * 0.75)} 0 ${round(-dist - len)} C ${round(-width / 2)} ${round(-dist - len * 0.75)} ${round(-width / 2)} ${round(-dist - len * 0.35)} 0 ${round(-dist)} Z`,
    fill,
  });
  if (!vein) return path;
  const veinPath = h('path', {
    d: `M 0 ${round(-dist - len * 0.1)} L 0 ${round(-dist - len * 0.92)}`,
    fill: 'none',
    stroke: vein,
    'stroke-width': round(len * 0.035),
    'stroke-linecap': 'round',
  });
  return h('g', {}, [path, veinPath]);
}

const petalRosette: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const fold = rngInt(rng, 6, 10);
  const outer = rngPick(rng, accents);
  const inner = rngPick(rng, accents);
  const core = rngPick(rng, accents);
  const vein = blendHex(colors[0], 0.35, outer);
  const children = [
    h('path', { d: scallopRingPath(fold * 2, r * 0.95, r * 0.045), fill: 'none', stroke: blendHex(outer, 0.55, colors[0]), 'stroke-width': round(size * 0.01) }),
    ...ring(fold, 0, () => petal(r * 0.5, r * 0.3, r * 0.42, outer, vein)),
    h('path', { d: scallopRingPath(fold, r * 0.32, r * 0.035), fill: 'none', stroke: blendHex(inner, 0.6, colors[0]), 'stroke-width': round(size * 0.009) }),
    // Inner ring was 95%-transparent — pre-blend against background.
    ...ring(fold, 180 / fold, () => petal(r * 0.38, r * 0.24, r * 0.22, blendHex(inner, 0.95, colors[0]))),
    ...ring(fold, 0, () => h('circle', { cx: 0, cy: round(-r * 0.14), r: round(r * 0.028), fill: core })),
    h('circle', { cx: 0, cy: 0, r: round(r * 0.16), fill: core }),
    h('circle', { cx: 0, cy: 0, r: round(r * 0.07), fill: colors[0] }),
  ];
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const dotMedallion: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const fold = rngInt(rng, 8, 12);
  const ringColor = rngPick(rng, accents);
  const dotColor = rngPick(rng, accents);
  const coreColor = rngPick(rng, accents);
  const children = [
    h('path', { d: scallopRingPath(fold, r * 0.72, r * 0.03), fill: 'none', stroke: blendHex(ringColor, 0.6, colors[0]), 'stroke-width': round(size * 0.008) }),
    h('circle', { cx: 0, cy: 0, r: round(r * 0.55), fill: 'none', stroke: ringColor, 'stroke-width': round(size * 0.04) }),
    ...ring(fold, 0, () => h('circle', { cx: 0, cy: round(-r * 0.8), r: round(r * 0.09), fill: dotColor })),
    ...spokeTicks(fold, r * 0.6, r * 0.68, blendHex(ringColor, 0.4, colors[0]), size * 0.01),
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
    ...ring(fold, 180 / fold, () => h('circle', { cx: 0, cy: round(-r * 0.58), r: round(r * 0.025), fill: blendHex(rayColor, 0.5, colors[0]) })),
    h('circle', { cx: 0, cy: 0, r: round(r * 0.48), fill: diskColor }),
    h('path', { d: scallopRingPath(fold, r * 0.36, r * 0.03), fill: 'none', stroke: colors[0], 'stroke-width': round(size * 0.018) }),
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
  const innerColor = rngPick(rng, accents);
  const outerVein = blendHex(colors[0], 0.4, outer);
  const midVein = blendHex(colors[0], 0.4, mid);
  const children = [
    // Three petal tiers (large/medium/small) instead of one-and-a-half —
    // real lotus mandalas layer petals like this, not a single flat ring.
    ...ring(fold, 0, () => petal(r * 0.62, r * 0.42, r * 0.3, outer, outerVein)),
    h('path', { d: scallopRingPath(fold, r * 0.42, r * 0.025), fill: 'none', stroke: blendHex(mid, 0.55, colors[0]), 'stroke-width': round(size * 0.009) }),
    // Mid ring was 92%-transparent — pre-blend against background.
    ...ring(fold, 180 / fold, () => petal(r * 0.45, r * 0.3, r * 0.18, blendHex(mid, 0.92, colors[0]), midVein)),
    ...ring(fold * 2, 0, () => petal(r * 0.22, r * 0.14, r * 0.08, blendHex(innerColor, 0.85, colors[0]))),
    h('circle', { cx: 0, cy: 0, r: round(r * 0.12), fill: innerColor }),
    h('circle', { cx: 0, cy: 0, r: round(r * 0.05), fill: colors[0] }),
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
