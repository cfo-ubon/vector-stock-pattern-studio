import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { jitter, rngRange, rngInt } from '../engine/rng';
import { spacingForDensity, wrapCoord } from './shared';
import { generateCluster, clusterBaseRadius } from '../engine/clusterEngine';
import { sineFlowPosition, sineFlowTangentDeg, type SineFlowPath } from '../engine/flowArchitecture';

/** S-Curve Botanical — Build 002, Section 5 (Semantic Cluster Engine
 * coverage): motifs now cluster along the serpentine path instead of one
 * motif per curve point, using the Cluster Engine's `sCurve` archetype
 * (previously dormant — no layout used it) rotated to the path's own local
 * tangent at each anchor (the same "rotate the cluster's own offsets by the
 * anchor's real direction" technique `heroFlow.ts` already uses), so each
 * anchor's real hero/secondary/filler/accent tiering reads as "belonging to
 * this stretch of the vine" rather than a flat sequence of same-weight
 * motifs. The wave's spatial frequency is still a whole number of cycles
 * per tile width, so the curve itself (not just the wrap-clone) continues
 * smoothly across the tile seam. Distinct from `heroFlow` (a small number
 * of large hero motifs on one diagonal-ish path with a much sparser ambient
 * layer): sCurve keeps its original denser, more continuous "vining"
 * identity — smaller clusters, closer together, following an actual sine
 * wave rather than a single gentle diagonal. */
export const sCurveLayout: PatternLayout = {
  id: 'sCurve',
  label: 'S-Curve Botanical',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const { tileSize } = params;
    const spacing = spacingForDensity(params.motifSize, params.density);
    const curveCount = rngInt(rng, 2, 3);
    const freq = 1; // whole cycles per tile width — keeps the curve periodic
    const amplitude = tileSize * rngRange(rng, 0.12, 0.2);
    // Cluster anchors along the curve, spaced further apart than the old
    // one-motif-per-point sampling since each anchor now contributes several
    // members via its own cluster.
    const anchorSpacing = spacing * 2.4;
    const anchorsPerCurve = Math.max(3, Math.round(tileSize / anchorSpacing));
    const clusterRadius = clusterBaseRadius(params.motifSize, params.density) * 0.5;
    const placements: Placement[] = [];
    let colorSeed = 0;

    for (let curve = 0; curve < curveCount; curve++) {
      const baseY = ((curve + 0.5) * tileSize) / curveCount;
      const phase = rngRange(rng, 0, Math.PI * 2);
      // Build 002, Section 9 (Flow Architecture Prototype): `heroFlow.ts`
      // computed this exact same periodic-sine-wave position/tangent math
      // under different variable names — this path object plus
      // `sineFlowPosition`/`sineFlowTangentDeg` (`engine/flowArchitecture.ts`)
      // is that shared math, extracted once both were compared and found
      // identical. `amplitude`/`phase` are still generated here (not via
      // the module's `createSineFlowPath` factory) so this curve loop's
      // real rng-consumption order — one amplitude for all curves, a
      // fresh phase per curve — stays exactly as it always was.
      const path: SineFlowPath = { tileSize, centerY: baseY, amplitude, freq, phase };
      for (let i = 0; i < anchorsPerCurve; i++) {
        const t = i / anchorsPerCurve;
        const x = t * tileSize;
        const y = sineFlowPosition(path, t);
        const tangentDeg = sineFlowTangentDeg(path, t);
        const theta = (tangentDeg * Math.PI) / 180;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);

        const members = generateCluster('sCurve', rng, {
          baseRadius: clusterRadius,
          rotationJitter: params.rotationJitter * 0.5 + 8,
          scaleJitter: params.scaleJitter,
          memberCount: rngInt(rng, 3, 5),
        });
        for (const m of members) {
          const rx = m.dx * cos - m.dy * sin;
          const ry = m.dx * sin + m.dy * cos;
          placements.push({
            x: wrapCoord(x + rx, tileSize),
            y: wrapCoord(y + ry, tileSize),
            rotationDeg: jitter(rng, tangentDeg, params.rotationJitter * 0.5 + 8),
            scale: Math.max(0.2, m.scaleMul),
            colorSeed: colorSeed++,
            role: m.role,
          });
        }
      }
    }
    return placements;
  },
};
