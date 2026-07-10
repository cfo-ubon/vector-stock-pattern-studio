import { h, round } from '../engine/svgAst';
import { blendHex } from '../palettes/palettes';

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
