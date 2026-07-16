import type { Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { blendHex } from '../palettes/palettes';
import { rngRange } from '../engine/rng';

/** Pinnate venation: one midrib plus branching side-vein pairs — every
 * vein is a solid pre-blended stroke (no SVG opacity), EPS-safe by
 * construction like the rest of the app. Shared by every leaf-bearing
 * generator (Botanical, Tropical) so venation reads consistently. */
export function pinnateVeins(
  length: number,
  width: number,
  veinColor: string,
  fillColor: string,
  pairs = 3,
): ReturnType<typeof h>[] {
  const half = length / 2;
  const stroke = blendHex(veinColor, 0.55, fillColor);
  const veins: ReturnType<typeof h>[] = [
    h('path', {
      d: `M 0 ${round(-half * 0.85)} L 0 ${round(half * 0.8)}`,
      fill: 'none',
      stroke,
      'stroke-width': round(length * 0.022),
      'stroke-linecap': 'round',
    }),
  ];
  for (let i = 1; i <= pairs; i++) {
    const t = i / (pairs + 1);
    const y = -half * 0.55 + length * 0.72 * t;
    const armLen = (width / 2) * (0.72 - 0.12 * i);
    for (const side of [-1, 1] as const) {
      veins.push(
        h('path', {
          d: `M 0 ${round(y)} Q ${round((side * armLen) / 2)} ${round(y - length * 0.05)} ${round(side * armLen)} ${round(y - length * 0.14)}`,
          fill: 'none',
          stroke,
          'stroke-width': round(length * 0.013),
          'stroke-linecap': 'round',
        }),
      );
    }
  }
  return veins;
}

/** Build 005, Section 3 (Premium SVG Illustration Engine): a real Calyx
 * Generator -- the small ring of pointed green sepals every real flower
 * has directly beneath its petals, where the bloom meets the stem. No
 * variant in this codebase drew one before (`botanical.ts`'s flowers went
 * straight from petals to stem with nothing between them); a genuine gap
 * the brief calls out by name, not a cosmetic add-on. Drawn as a fan of
 * narrow pointed shapes at the base of a bloom, sized relative to the
 * flower it sits under, with a small seeded angle/length jitter per sepal
 * so it reads as grown rather than stamped. Shared (like `pinnateVeins`)
 * so any hero-flower assembly can add one without duplicating the shape. */
export function calyxBase(rng: Rng, opts: { color: string; flowerRadius: number; sepalCount?: number }): ReturnType<typeof h> {
  const { color, flowerRadius: r, sepalCount = 5 } = opts;
  const sepals: ReturnType<typeof h>[] = [];
  const len = r * 0.32;
  const width = r * 0.16;
  for (let i = 0; i < sepalCount; i++) {
    const angle = (360 / sepalCount) * i + rngRange(rng, -6, 6);
    const sepalLen = len * rngRange(rng, 0.85, 1.1);
    const w = width / 2;
    const d = `M 0 0 Q ${round(w)} ${round(sepalLen * 0.55)} 0 ${round(sepalLen)} Q ${round(-w)} ${round(sepalLen * 0.55)} 0 0 Z`;
    sepals.push(h('g', { transform: `rotate(${round(angle)})` }, [h('path', { d, fill: color })]));
  }
  return h('g', { 'data-part': 'calyx' }, sepals);
}

/** Build 006, Section 7 (Premium SVG Detail): a real Flower Center Generator
 * -- the stamens/anthers/pistil disc every real bloom has at its own
 * center, another gap no prior variant drew (blooms went straight from
 * petals to nothing, with an empty center). A small fan of thin stamen
 * filaments, each tipped with a tiny anther dot, plus one small center
 * disc -- sized relative to the flower, seeded jitter per filament so it
 * reads as grown rather than stamped, same convention as `calyxBase`.
 * Deliberately cheap (`filamentCount` defaults to 6, ~13 nodes total) --
 * reserved for hero-scale blooms only (see `premiumHero.ts`), the same
 * node-budget discipline `calyxBase` already established. */
export function flowerCenterDetail(
  rng: Rng,
  opts: { filamentColor: string; discColor: string; flowerRadius: number; filamentCount?: number },
): ReturnType<typeof h> {
  const { filamentColor, discColor, flowerRadius: r, filamentCount = 6 } = opts;
  const filamentLen = r * 0.22;
  const parts: ReturnType<typeof h>[] = [];
  for (let i = 0; i < filamentCount; i++) {
    const angle = (360 / filamentCount) * i + rngRange(rng, -10, 10);
    const len = filamentLen * rngRange(rng, 0.8, 1.15);
    parts.push(
      h('g', { transform: `rotate(${round(angle)})` }, [
        h('path', { d: `M 0 0 L 0 ${round(-len)}`, fill: 'none', stroke: filamentColor, 'stroke-width': round(r * 0.02), 'stroke-linecap': 'round' }),
        h('circle', { cx: 0, cy: round(-len), r: round(r * 0.035), fill: filamentColor }),
      ]),
    );
  }
  parts.push(h('circle', { cx: 0, cy: 0, r: round(r * 0.12), fill: discColor }));
  return h('g', { 'data-part': 'flower-center' }, parts);
}
