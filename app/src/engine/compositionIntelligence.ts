import type { Placement } from './types';
import { periodicDist, periodicOffset } from './svgGeometry';
import { applyAttraction } from './patternPhysics';
import type { FlowProfile } from './styleDna';
import { applyEyeFlow, type EyeFlowPath } from './eyeFlowEngine';

// Composition Intelligence Engine (Roadmap Phase 2; extended to V2 by
// Composition Intelligence Foundation V2, Build 001) — where the Scoring
// Engine only *measures* composition quality after a tile is built, this
// module *acts* on the raw placement list before it's turned into SVG: a
// deterministic, geometry-only refinement pipeline. V1 shipped balance
// correction (Section 1/6) and rhythm smoothing; V2 adds a real Flow Engine
// pass (Section 5 — `flowProfile` previously only nudged rotation jitter,
// never placement), a finer-grained Negative Space pass (Section 6 — the
// same weighted-redistribution mechanism balance correction uses, reused at
// a finer grid resolution rather than duplicated), and Pattern Physics
// (Section 8, `engine/patternPhysics.ts`). Every pass here stays pure and
// rng-free — it only ever reshapes the placements the layout/hierarchy
// stage already produced, never adds/removes any or consumes additional
// random draws, so it never disturbs seed determinism upstream.

export interface CompositionIntelligenceParams {
  /** 0 = no quadrant-balance correction, 1 = strongest correction. */
  balanceStrength: number;
  /** 0 = no spacing-rhythm smoothing, 1 = strongest smoothing. */
  rhythmStrength: number;
  /** Section 8, Pattern Physics — 0 = no role-attraction, 1 = strongest.
   * Undefined behaves as 0 (no-op), matching every other optional field
   * here so patterns saved before this field existed are unaffected. */
  attractionStrength?: number;
  /** Section 6, Negative Space Engine — a finer-grained (8x8, vs.
   * balanceStrength's 2x2) pass over the same weighted-cell redistribution
   * mechanism, catching localized empty holes a coarse quadrant split
   * averages away. 0/undefined = no-op. */
  negativeSpaceStrength?: number;
  /** Section 5, Flow Engine — which directional field placements are
   * biased toward. Undefined/'calm' = no bias regardless of
   * flowBiasStrength (an even, non-directional field is what "calm"
   * means). */
  flowProfile?: FlowProfile;
  /** 0 = no flow bias, 1 = strongest. 0/undefined = no-op. */
  flowBiasStrength?: number;
  /** Build 009, Section 2 (Eye Flow Engine) — a third, additive eye-path
   * mechanism alongside `flowProfile` (see `engine/eyeFlowEngine.ts`'s own
   * doc comment for why this isn't a unification of the two pre-existing
   * systems). Undefined = no-op, same convention as every other optional
   * field here. */
  eyeFlowPath?: EyeFlowPath;
  /** 0 = no eye-flow pull, 1 = strongest. 0/undefined = no-op. */
  eyeFlowStrength?: number;
  /** Build 009, Section 5 (Natural Asymmetry Engine) — which side the
   * deliberate, bounded mass nudge favors (see `applyControlledAsymmetry`'s
   * own doc comment). Undefined = no-op. */
  asymmetryDirection?: AsymmetryDirection;
  /** 0 = no asymmetry nudge, 1 = strongest (still bounded/subtle by
   * design). 0/undefined = no-op. */
  asymmetryStrength?: number;
}

export const DEFAULT_COMPOSITION_INTELLIGENCE: CompositionIntelligenceParams = {
  balanceStrength: 0.5,
  rhythmStrength: 0.35,
  attractionStrength: 0.4,
  negativeSpaceStrength: 0.35,
  flowProfile: 'directional',
  flowBiasStrength: 0.25,
};

/** A hero motif reads as visually heavier than its raw area alone would
 * suggest (it's the piece the eye is meant to land on first) — a small,
 * documented perceptual bump on top of the scale^2 area proxy, not an
 * arbitrary hardcoded score. */
const ROLE_WEIGHT: Record<string, number> = { hero: 1.5, secondary: 1.15, filler: 0.85, accent: 0.6 };

export function computeWeight(p: Placement): number {
  const bump = p.role ? (ROLE_WEIGHT[p.role] ?? 1) : 1;
  return p.scale * p.scale * bump;
}

/** Which cell of an `gridN` x `gridN` grid (x-major, wrap-aware) a point
 * falls in — `quadrantOf`'s old 2x2-only logic generalized to any grid
 * resolution, so the same weighted-redistribution mechanism below serves
 * both the coarse "balance" pass (gridN=2) and the finer "negative space"
 * pass (gridN=8) without two copies of the partitioning logic. */
function cellOf(x: number, y: number, tileSize: number, gridN: number): number {
  const px = ((x % tileSize) + tileSize) % tileSize;
  const py = ((y % tileSize) + tileSize) % tileSize;
  const cx = Math.min(gridN - 1, Math.floor((px / tileSize) * gridN));
  const cy = Math.min(gridN - 1, Math.floor((py / tileSize) * gridN));
  return cy * gridN + cx;
}

/** Moves a point into `targetCell`, preserving its fractional position
 * within its own current cell so the relocation reads as "the same local
 * arrangement, shifted to a different region" rather than snapping to one
 * fixed spot — generalizes `reflectIntoQuadrant`'s old mirror-only trick
 * (which only worked for exactly 2 divisions per axis) to any grid
 * resolution and any pair of cells, adjacent or not. */
function moveIntoCell(p: { x: number; y: number }, tileSize: number, gridN: number, targetCell: number): { x: number; y: number } {
  const cellSize = tileSize / gridN;
  const px = ((p.x % tileSize) + tileSize) % tileSize;
  const py = ((p.y % tileSize) + tileSize) % tileSize;
  const fracX = (px % cellSize) / cellSize;
  const fracY = (py % cellSize) / cellSize;
  const tcx = targetCell % gridN;
  const tcy = Math.floor(targetCell / gridN);
  return { x: (tcx + fracX) * cellSize, y: (tcy + fracY) * cellSize };
}

/** Redistributes a bounded number of the lightest placements out of the
 * heaviest grid cell into the lightest one, blending most (never all) of
 * the way to the target cell rather than snapping — only fires when the
 * imbalance is severe (mild unevenness reads as designed, not machine-
 * stamped). Shared by `applyBalanceCorrection` (gridN=2, macro composition
 * weight) and `applyNegativeSpaceCorrection` (gridN=8, catches localized
 * holes a 2x2 split averages away) — one mechanism, two resolutions,
 * rather than duplicated logic for what the brief treats as two named
 * concepts. */
export function applyGridBalanceCorrection(placements: Placement[], tileSize: number, gridN: number, strength: number): Placement[] {
  if (strength <= 0 || placements.length < 4) return placements;

  const weights = placements.map(computeWeight);
  const numCells = gridN * gridN;
  const cellWeights = new Array(numCells).fill(0);
  const cellIndex = placements.map((p, i) => {
    const c = cellOf(p.x, p.y, tileSize, gridN);
    cellWeights[c] += weights[i];
    return c;
  });
  const totalWeight = cellWeights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return placements;

  const meanWeight = totalWeight / numCells;
  const heaviest = cellWeights.indexOf(Math.max(...cellWeights));
  const lightest = cellWeights.indexOf(Math.min(...cellWeights));
  const imbalance = (cellWeights[heaviest] - cellWeights[lightest]) / (meanWeight || 1);
  if (heaviest === lightest || imbalance < 0.5) return placements;

  const movable = placements
    .map((_, i) => ({ i, w: weights[i] }))
    .filter((e) => cellIndex[e.i] === heaviest)
    // Move the lightest placements out first — relieves crowding without
    // disturbing the cell's own anchor/hero motifs.
    .sort((a, b) => a.w - b.w);

  const excessWeight = (cellWeights[heaviest] - meanWeight) * strength;
  const maxMoves = Math.max(1, Math.floor(placements.length * 0.15));
  const pullFrac = 0.5 + 0.45 * strength;

  const result = placements.slice();
  let movedWeight = 0;
  let moved = 0;
  for (const entry of movable) {
    if (moved >= maxMoves || movedWeight >= excessWeight) break;
    const p = result[entry.i];
    const target = moveIntoCell(p, tileSize, gridN, lightest);
    result[entry.i] = {
      ...p,
      x: p.x + (target.x - p.x) * pullFrac,
      y: p.y + (target.y - p.y) * pullFrac,
    };
    movedWeight += entry.w;
    moved++;
  }
  return result;
}

/** Macro-level composition-weight balance across a 2x2 split of the tile —
 * unchanged behavior from Composition Intelligence Engine V1, now a thin
 * wrapper over the shared `applyGridBalanceCorrection`. */
export function applyBalanceCorrection(placements: Placement[], tileSize: number, strength: number): Placement[] {
  return applyGridBalanceCorrection(placements, tileSize, 2, strength);
}

/** Section 6, Negative Space Engine — the same weighted-redistribution
 * mechanism as `applyBalanceCorrection`, at a finer 8x8 grid resolution.
 * A large empty hole is, in this model, nothing more than a cell whose
 * weight is far below the mean — genuinely catching localized holes a
 * coarse 2x2 quadrant split would average into "roughly even" and miss.
 *
 * Build 001.1, Known Issue #1: this was gridN=4 in Build 001. Empirical
 * investigation found that `engine/scoring.ts`'s `largestEmptyRegion` — the
 * metric this pass exists to improve, and what `deadSpace` in
 * critic/visualAnalysis.ts is thresholded on — is measured via
 * `gridCoverage(instances, tileSize, 8)`, an 8x8 grid, not 4x4. A 4x4 cell
 * can read as "roughly average weight" while one of its four 8x8
 * sub-cells is a real hole the detector flags, so the correction pass was
 * structurally unable to see the same holes the detector penalizes.
 * Matching the grid resolution to the detector's own is what makes this
 * pass address the thing it's actually scored against, rather than a
 * coarser proxy for it. (Two rejected fixes were tried first — reordering
 * Attraction and Negative Space Correction relative to each other, in both
 * directions — see git history / BUILD_REPORT.md for the empirical data;
 * neither moved the metric and one introduced a new `fragmentedSilhouette`
 * regression, so the pipeline order below is unchanged from Build 001.) */
export function applyNegativeSpaceCorrection(placements: Placement[], tileSize: number, strength: number): Placement[] {
  return applyGridBalanceCorrection(placements, tileSize, 8, strength);
}

export type FlowBiasProfile = FlowProfile;

/** Section 5, Flow Engine — makes `flowProfile` actually steer *placement*,
 * not just each motif's own spin (see engine/styleDna.ts's
 * `FLOW_ROTATION_JITTER`, which only ever fed rotationJitter). `calm` is a
 * deliberate no-op: an even, non-directional field is what "calm" means.
 * `directional` nudges every placement a bounded distance toward the
 * tile's own main diagonal, reading as one confident sweep across the
 * surface. `dynamic` applies a two-axis sinusoidal drift — a genuinely
 * flowing wave rather than a single straight line, matching "dynamic"
 * reading as more energetic than a calm directional sweep. Pure and
 * deterministic (a function of each placement's own position, never rng),
 * so it composes safely with every other pass here regardless of order.
 *
 * Build 001.1, Section 3 (Flow Optimization): Build 001 measured a small
 * `flowCoherence` regression (70.0 -> 69.3). The Known Issue #1 grid-
 * resolution fix above (`applyNegativeSpaceCorrection`, gridN 4 -> 8)
 * recovered this as a side effect (69.3 -> 69.6 in the same 30-scenario
 * empirical suite) without touching this function. Beyond that, several
 * direct strengthenings of this pass were tried and measured, not
 * assumed: raising `pull`'s coefficient, running this pass a second time
 * after rhythm smoothing (to undo whatever later passes displaced),
 * replacing the diagonal-convergence field with a pure shear, and blends
 * of the two at several weights. Every variant that moved flowCoherence
 * up by more than ~0.2 did so by trading away `fragmentedSilhouette`
 * (6/30 -> 7-9/30) or `largestEmptyRegion`/overall score in the opposite
 * direction — this pass's own bounded, small-`pull` design is already
 * near the achievable balance point for this mechanism, not an
 * oversight. A materially higher flowCoherence would need a genuinely
 * different mechanism (e.g. per-layout flow paths informed by each
 * layout's own generation, rather than a single post-hoc global field
 * applied after the fact) — out of scope for a refinement build against
 * working architecture. */
export function applyFlowBias(placements: Placement[], tileSize: number, profile: FlowBiasProfile, strength: number): Placement[] {
  if (strength <= 0 || profile === 'calm' || placements.length === 0) return placements;
  const pull = 0.18 * strength;
  return placements.map((p) => {
    const px = ((p.x % tileSize) + tileSize) % tileSize;
    const py = ((p.y % tileSize) + tileSize) % tileSize;
    if (profile === 'directional') {
      const t = (px + py) / 2;
      return { ...p, x: p.x + (t - px) * pull, y: p.y + (t - py) * pull };
    }
    const waveY = Math.sin((px / tileSize) * Math.PI * 2) * tileSize * 0.12;
    const waveX = Math.cos((py / tileSize) * Math.PI * 2) * tileSize * 0.06;
    return { ...p, x: p.x + waveX * pull, y: p.y + waveY * pull };
  });
}

export type AsymmetryDirection = 'left' | 'right' | 'top' | 'bottom' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

const ASYMMETRY_DIRECTION_VECTOR: Record<AsymmetryDirection, [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  top: [0, -1],
  bottom: [0, 1],
  topLeft: [-Math.SQRT1_2, -Math.SQRT1_2],
  topRight: [Math.SQRT1_2, -Math.SQRT1_2],
  bottomLeft: [-Math.SQRT1_2, Math.SQRT1_2],
  bottomRight: [Math.SQRT1_2, Math.SQRT1_2],
};

export const ASYMMETRY_DIRECTIONS: AsymmetryDirection[] = ['left', 'right', 'top', 'bottom', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

/** Build 009, Section 5 (Natural Asymmetry Engine): `applyBalanceCorrection`
 * only ever corrects *severe* quadrant imbalance (>0.5) -- everything below
 * that threshold is left to whatever the layout/hierarchy stage happened to
 * roll, so "mild asymmetry" is really "unintentional asymmetry", not a
 * deliberate design choice. This is the opposite move: a real, bounded,
 * one-sided mass nudge applied on purpose, so the tile's own visual weight
 * genuinely leans a chosen direction rather than reading as either
 * perfectly even or accidentally lopsided.
 *
 * Deliberately restricted to filler/accent-role placements (and unroled
 * ones, weighted like filler) -- hero/secondary positions, already the
 * tile's primary visual-hierarchy decision, are never touched, so the
 * imbalance this creates is a genuine "supporting texture leans one way"
 * read, never "the hero got shoved off-center." Pure and rng-free (a
 * function of each placement's own role/position and the caller-supplied
 * `direction`), so it composes safely into the pipeline without shifting
 * any other pass's random stream -- `direction` itself is picked once,
 * deterministically, per Style DNA (see `styleDna.ts`'s own hash-based
 * `pickPreferred`), not re-rolled here. */
export function applyControlledAsymmetry(placements: Placement[], tileSize: number, direction: AsymmetryDirection, strength: number): Placement[] {
  if (strength <= 0 || placements.length === 0) return placements;
  const [vx, vy] = ASYMMETRY_DIRECTION_VECTOR[direction];
  // Bounded on purpose -- a deliberate, subtle lean, never a severe shove
  // (that's what `applyBalanceCorrection` already guards against on the
  // opposite side).
  const pull = tileSize * 0.05 * Math.min(1, strength);
  return placements.map((p) => {
    const weight = p.role === 'hero' || p.role === 'secondary' ? 0 : p.role === 'filler' ? 0.6 : 1;
    if (weight <= 0) return p;
    return { ...p, x: p.x + vx * pull * weight, y: p.y + vy * pull * weight };
  });
}

/** Pulls placements that sit unusually far from their nearest neighbor
 * (isolated outliers that break the pattern's spacing rhythm) a bounded
 * fraction of the way toward that neighbor. Placements whose spacing is
 * already within a normal range are left untouched. */
export function applyRhythmSmoothing(placements: Placement[], tileSize: number, strength: number): Placement[] {
  if (strength <= 0 || placements.length < 3) return placements;

  const nearest = placements.map((p, i) => {
    let best = Infinity;
    let other: Placement | null = null;
    placements.forEach((o, j) => {
      if (i === j) return;
      const d = periodicDist(p, o, tileSize);
      if (d < best) {
        best = d;
        other = o;
      }
    });
    return { distance: best, other };
  });

  const finite = nearest.map((n) => n.distance).filter((d) => Number.isFinite(d));
  if (finite.length === 0) return placements;
  const mean = finite.reduce((a, b) => a + b, 0) / finite.length;
  const variance = finite.reduce((a, d) => a + (d - mean) ** 2, 0) / finite.length;
  const stdev = Math.sqrt(variance);
  if (stdev <= 0) return placements;
  const threshold = mean + stdev * 1.25;

  const result = placements.slice();
  const maxMoves = Math.max(1, Math.floor(placements.length * 0.2));
  const pullFrac = 0.3 * strength;
  let moved = 0;
  for (let i = 0; i < placements.length && moved < maxMoves; i++) {
    const { distance, other } = nearest[i];
    if (!Number.isFinite(distance) || distance <= threshold || !other) continue;
    const p = result[i];
    const { dx, dy } = periodicOffset(p, other, tileSize);
    result[i] = { ...p, x: p.x + dx * pullFrac, y: p.y + dy * pullFrac };
    moved++;
  }
  return result;
}

/** Orchestrator: flow bias first (a broad directional character for the
 * whole field), then Build 009's Eye Flow Engine pull (`applyEyeFlow` — a
 * second, independent directional pass, see `engine/eyeFlowEngine.ts`'s own
 * doc comment for why this composes alongside `flowProfile` rather than
 * replacing it), then the Natural Asymmetry Engine's deliberate one-sided
 * nudge (`applyControlledAsymmetry`, filler/accent-only), then balance
 * correction (macro, region-level — still the backstop against genuinely
 * severe imbalance), negative space correction (meso, localized holes),
 * pattern physics (micro, role-to-role attraction), and finally rhythm
 * smoothing (fine, neighbor-level polish) — each stage progressively
 * finer-grained than the last.
 * Undefined params is a strict no-op, returning the exact same array
 * reference, so old saved patterns that predate this field reproduce
 * identically; each new V2 field is independently optional so a params
 * object carrying only the original two V1 fields runs exactly the V1
 * pipeline (balance -> rhythm), byte-for-byte unchanged.
 *
 * Build 001.1 (Known Issue #1 fix): see `applyNegativeSpaceCorrection`'s
 * doc comment for the real root cause (a grid-resolution mismatch against
 * the `largestEmptyRegion`/`deadSpace` detector) and why that, not pass
 * ordering, was the actual fix. Two reordering variants were tried and
 * empirically rejected first (see `docs/DESIGN_DECISIONS.md`): running
 * Attraction before Negative Space Correction (in either position) left
 * `deadSpace` unchanged (2/30 scenarios) and made `fragmentedSilhouette`
 * measurably worse (6/30 -> 8/30) — the Build 001 pipeline order below is
 * unchanged from what shipped. A targeted "protect Negative Space
 * Correction's moved placements from Attraction" variant was also tried
 * and measured to have no effect once isolated from the grid-resolution
 * fix (identical metrics with or without it), so it was dropped rather
 * than kept as unexercised complexity. */
export function applyCompositionIntelligence(
  placements: Placement[],
  tileSize: number,
  params?: CompositionIntelligenceParams,
): Placement[] {
  if (!params) return placements;
  const flowed =
    params.flowProfile && params.flowBiasStrength
      ? applyFlowBias(placements, tileSize, params.flowProfile, params.flowBiasStrength)
      : placements;
  const eyeFlowed =
    params.eyeFlowPath && params.eyeFlowStrength
      ? applyEyeFlow(flowed, tileSize, params.eyeFlowPath, params.eyeFlowStrength)
      : flowed;
  // Build 009, Section 5 (Natural Asymmetry Engine): applied before balance
  // correction so a genuinely severe imbalance the nudge happens to create
  // is still caught by that pass's own >0.5 threshold -- "controlled"
  // imbalance stays controlled, not just relabeled.
  const asymmetric =
    params.asymmetryDirection && params.asymmetryStrength
      ? applyControlledAsymmetry(eyeFlowed, tileSize, params.asymmetryDirection, params.asymmetryStrength)
      : eyeFlowed;
  const balanced = applyBalanceCorrection(asymmetric, tileSize, params.balanceStrength);
  const spaced = params.negativeSpaceStrength
    ? applyNegativeSpaceCorrection(balanced, tileSize, params.negativeSpaceStrength)
    : balanced;
  const attracted = params.attractionStrength
    ? applyAttraction(spaced, tileSize, params.attractionStrength)
    : spaced;
  return applyRhythmSmoothing(attracted, tileSize, params.rhythmStrength);
}
