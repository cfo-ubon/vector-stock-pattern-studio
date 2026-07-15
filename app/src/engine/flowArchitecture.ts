import type { Rng } from './types';
import { rngRange } from './rng';

/** Flow Architecture Prototype — Build 002, Section 9. `layouts/sCurve.ts`
 * and `layouts/heroFlow.ts` each independently hand-rolled the identical
 * periodic-sine-wave path math (position + local tangent angle, with a
 * whole-number wave frequency so the path continues smoothly across the
 * tile seam) under different variable names. This module is that shared
 * math, extracted once both layouts were compared side-by-side and found
 * to compute the exact same formula (`heroFlow`'s tangent used
 * `atan2(slope / tileSize, 1)`; `sCurve`'s used `atan2(slope * k, k)` for
 * a k that cancels out to the same ratio) — a genuine, low-risk
 * consolidation, not a new visual behavior. Both call sites were verified
 * to produce identical placements before/after this extraction (same
 * seeds, same scores against the frozen Build 002 baselines).
 *
 * Deliberately narrow: only the one path shape (`sine`) both layouts
 * actually use is implemented. A spiral/arc/zigzag path was considered
 * but rejected for this build — no current layout needs one, and adding
 * shapes nothing consumes would be exactly the kind of speculative
 * abstraction this codebase's conventions warn against. */
export interface SineFlowPath {
  tileSize: number;
  /** Vertical center the wave oscillates around. */
  centerY: number;
  /** Wave amplitude in px. */
  amplitude: number;
  /** Whole-number cycles per tile width — keeps the path periodic so it
   * continues smoothly across the tile's wrap seam. */
  freq: number;
  phase: number;
}

/** Builds a randomized sine flow path — the common "diagonal-ish wave
 * across the tile, seeded amplitude/phase" pattern both `sCurve` and
 * `heroFlow` already used. `freq` defaults to 1 (both layouts always used
 * exactly one cycle); left overridable rather than hardcoded in case a
 * future layout wants more. */
export function createSineFlowPath(rng: Rng, tileSize: number, ampRange: [number, number], centerY = tileSize * 0.5, freq = 1): SineFlowPath {
  return {
    tileSize,
    centerY,
    amplitude: tileSize * rngRange(rng, ampRange[0], ampRange[1]),
    freq,
    phase: rngRange(rng, 0, Math.PI * 2),
  };
}

/** The path's y position at parameter `t` (0..1 across the tile width). */
export function sineFlowPosition(path: SineFlowPath, t: number): number {
  return path.centerY + path.amplitude * Math.sin(2 * Math.PI * path.freq * t + path.phase);
}

/** The path's local tangent direction at `t`, in degrees — for rotating a
 * placement (or a whole cluster's offsets) to align with "this stretch of
 * the path" instead of a fixed angle. */
export function sineFlowTangentDeg(path: SineFlowPath, t: number): number {
  const slope = path.amplitude * (2 * Math.PI * path.freq) * Math.cos(2 * Math.PI * path.freq * t + path.phase);
  return (Math.atan2(slope / path.tileSize, 1) * 180) / Math.PI;
}
