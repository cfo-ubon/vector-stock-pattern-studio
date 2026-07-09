import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { jitter, rngRange, rngInt } from '../engine/rng';
import { spacingForDensity, wrapCoord } from './shared';

/** S-Curve Botanical: motifs strung along repeating serpentine (sine-wave)
 * paths — the classic "vining" placement used for botanical/floral
 * fabrics. The wave's spatial frequency is an integer number of cycles
 * per tile width, which makes `y(0) === y(tileSize)` and the slope match
 * too — so the curve itself continues smoothly across the tile seam, not
 * just the individual motifs (which the engine's wrap-clone already
 * guarantees regardless). Motif rotation follows the curve's tangent
 * direction, like leaves/flowers along a stem. */
export const sCurveLayout: PatternLayout = {
  id: 'sCurve',
  label: 'S-Curve Botanical',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const { tileSize } = params;
    const spacing = spacingForDensity(params.motifSize, params.density);
    const curveCount = rngInt(rng, 2, 3);
    const freq = 1; // whole cycles per tile width — keeps the curve periodic
    const amplitude = tileSize * rngRange(rng, 0.12, 0.2);
    const pointsPerCurve = Math.max(4, Math.round(tileSize / spacing));
    const placements: Placement[] = [];
    let colorSeed = 0;

    for (let curve = 0; curve < curveCount; curve++) {
      const baseY = ((curve + 0.5) * tileSize) / curveCount;
      const phase = rngRange(rng, 0, Math.PI * 2);
      for (let i = 0; i < pointsPerCurve; i++) {
        const t = i / pointsPerCurve;
        const x = t * tileSize;
        const angle = (2 * Math.PI * freq * t) + phase;
        const y = baseY + amplitude * Math.sin(angle);
        // Tangent direction dy/dx, converted to degrees for rotation.
        const slope = amplitude * ((2 * Math.PI * freq) / tileSize) * Math.cos(angle);
        const tangentDeg = (Math.atan2(slope * (tileSize / pointsPerCurve), tileSize / pointsPerCurve) * 180) / Math.PI;
        const onCurve = i % 3 !== 2; // occasional off-curve motif for variety
        const offset = onCurve ? 0 : rngRange(rng, -amplitude * 0.5, amplitude * 0.5);
        placements.push({
          x: wrapCoord(x, tileSize),
          y: wrapCoord(y + offset, tileSize),
          rotationDeg: jitter(rng, tangentDeg, params.rotationJitter * 0.5 + 8),
          scale: Math.max(0.35, (onCurve ? 1 : 0.7) * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
          colorSeed: colorSeed++,
        });
      }
    }
    return placements;
  },
};
