import type { Placement } from './types';
import { periodicOffset } from './svgGeometry';
import type { CompositionZone } from './compositionZones';

// Build 009, Section 2 (Eye Flow Engine). The audit (docs/build_reports/
// BUILD_009_AUDIT.md) found two pre-existing, never-unified "eye path"
// systems: `styleDna.ts`'s `FlowProfile` (3 crude profiles, applied as a
// per-placement velocity field by `compositionIntelligence.ts`'s
// `applyFlowBias`) and `compositionZones.ts`'s 10 named zones (real
// skeleton geometry, but only used to bias *cluster anchor sampling*, never
// a universal per-placement bias). Unifying them is out of scope for this
// build (`FlowProfile` is a closed union read by dozens of call sites) — so
// this is a third, small, additive, opt-in mechanism: 6 named eye-flow
// paths, each a real geometric skeleton (reusing the exact wave/diagonal/
// row/spiral formulas `compositionZones.ts` already proved out) sampled
// into a dense point set once per call, with every placement pulled a
// bounded fraction toward its own nearest skeleton point — the same
// "pull toward the nearest thing" idiom `applyRhythmSmoothing` already
// uses in this file's sibling module, just aimed at a fixed skeleton
// instead of each placement's nearest neighbor. Pure and rng-free (a
// function of placement position and tileSize only), so it composes
// safely into the pipeline without shifting any other pass's random
// stream.
export type EyeFlowPath = 'sCurve' | 'diagonal' | 'editorial' | 'spiral' | 'asymmetrical' | 'wallpaper';

export const EYE_FLOW_PATHS: EyeFlowPath[] = ['sCurve', 'diagonal', 'editorial', 'spiral', 'asymmetrical', 'wallpaper'];

const SKELETON_SAMPLES = 24;

/** Dense sample of each path's real geometric skeleton, in tile-normalized
 * (0..1) coordinates before the caller scales to `tileSize`.
 *
 * `sCurve`/`diagonal`/`editorial`/`spiral` reuse the exact real formulas
 * `compositionZones.ts`'s `fieldDensity`/`sequenceCandidate` already use for
 * cluster-anchor sampling (the sine wave, the diagonal band, the row
 * offsets, the golden-angle spiral) — sampled deterministically along the
 * curve itself rather than scored as a density field, since a placement
 * bias needs a concrete nearest point to pull toward, not a probability.
 *
 * `asymmetrical` and `wallpaper` have no analog in `compositionZones.ts` —
 * they're genuinely new: `asymmetrical` is a single deliberate off-center
 * focal point at a real golden-ratio coordinate (0.618, 0.382), pulling the
 * whole field toward one side on purpose (controlled imbalance, not a
 * centered flow). `wallpaper` returns no skeleton points at all: a repeat
 * print should not direct the eye down one path, so this path is an
 * intentional near-zero (`applyEyeFlow` short-circuits it below rather
 * than pulling toward a fabricated "neutral" skeleton). */
function skeletonPoints(path: EyeFlowPath): Array<[number, number]> {
  switch (path) {
    case 'sCurve': {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < SKELETON_SAMPLES; i++) {
        const nx = i / SKELETON_SAMPLES;
        const ny = 0.5 + 0.28 * Math.sin(2 * Math.PI * nx);
        pts.push([nx, ((ny % 1) + 1) % 1]);
      }
      return pts;
    }
    case 'diagonal': {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < SKELETON_SAMPLES; i++) {
        const t = i / SKELETON_SAMPLES;
        pts.push([t, t]);
      }
      return pts;
    }
    case 'editorial': {
      const rows = 3;
      const perRow = Math.max(1, Math.floor(SKELETON_SAMPLES / rows));
      const pts: Array<[number, number]> = [];
      for (let row = 0; row < rows; row++) {
        const rowY = (row + 0.5) / rows;
        for (let i = 0; i < perRow; i++) {
          pts.push([i / perRow, rowY]);
        }
      }
      return pts;
    }
    case 'spiral': {
      // Same golden-angle spiral math as compositionZones.ts's
      // `sequenceCandidate('goldenRatio', ...)`, sampled without rng jitter
      // (this pass stays pure) and without a caller-supplied expected
      // count (a fixed dense sample serves any placement count here).
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const normalizer = SKELETON_SAMPLES * 1.6;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < SKELETON_SAMPLES; i++) {
        const theta = i * goldenAngle;
        const r = Math.sqrt((i + 1) / normalizer) * 0.5;
        const nx = 0.5 + r * Math.cos(theta);
        const ny = 0.5 + r * Math.sin(theta);
        pts.push([((nx % 1) + 1) % 1, ((ny % 1) + 1) % 1]);
      }
      return pts;
    }
    case 'asymmetrical':
      return [[0.618, 0.382]];
    case 'wallpaper':
      return [];
  }
}

/** Pulls every placement a bounded fraction toward its own nearest point on
 * `path`'s real skeleton (wrap-aware, via `periodicOffset`) — the Eye Flow
 * Engine's placement-level bias. `wallpaper` and a non-positive `strength`
 * are both strict no-ops (return `placements` unchanged, same array
 * reference), matching every other optional Composition Intelligence pass:
 * a params object that never sets `eyeFlowPath`/`eyeFlowStrength`
 * reproduces prior output byte-for-byte. */
export function applyEyeFlow(placements: Placement[], tileSize: number, path: EyeFlowPath, strength: number): Placement[] {
  if (strength <= 0 || path === 'wallpaper' || placements.length === 0) return placements;
  const anchors = skeletonPoints(path).map(([nx, ny]) => ({ x: nx * tileSize, y: ny * tileSize }));
  if (anchors.length === 0) return placements;

  const pullFrac = 0.22 * Math.min(1, strength);
  return placements.map((p) => {
    let bestDist = Infinity;
    let bestDx = 0;
    let bestDy = 0;
    for (const anchor of anchors) {
      const { dx, dy } = periodicOffset(p, anchor, tileSize);
      const d = Math.hypot(dx, dy);
      if (d < bestDist) {
        bestDist = d;
        bestDx = dx;
        bestDy = dy;
      }
    }
    return { ...p, x: p.x + bestDx * pullFrac, y: p.y + bestDy * pullFrac };
  });
}

/** Style DNA (`engine/styleDna.ts`) already resolves a real per-generation
 * `CompositionZone` for presets that declare `preferredZones` — this maps
 * that same zone to its direct Eye Flow analog so those presets exercise
 * the new placement-level bias too, honestly limited to the 4 zones that
 * genuinely share underlying skeleton math with an Eye Flow path
 * (`sCurve`, `diagonal`, `editorial`, `goldenRatio` -> `spiral`). The other
 * 6 zones (`zFlow`, `centerFocus`, `cornerFlow`, `radial`, `wave`, `offset`)
 * have no honest 1:1 analog among the 6 Eye Flow paths and are left
 * unmapped (`undefined`, a no-op) rather than forcing an arbitrary guess. */
export function mapCompositionZoneToEyeFlow(zone: CompositionZone): EyeFlowPath | undefined {
  switch (zone) {
    case 'sCurve':
      return 'sCurve';
    case 'diagonal':
      return 'diagonal';
    case 'editorial':
      return 'editorial';
    case 'goldenRatio':
      return 'spiral';
    default:
      return undefined;
  }
}
