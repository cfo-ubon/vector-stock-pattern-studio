import type { Rng } from '../engine/types';
import { rngPick, rngBool, jitter } from '../engine/rng';
import { HIERARCHY_PRESETS } from '../engine/hierarchy';
import type { DesignSpecification } from '../trend/designSpecTypes';
import { diffJson } from '../workbench/jsonDiff';
import type { MutationType, AppliedMutation } from './types';

// Design Evolution Engine (Phase 8) — Section 2 "Mutation Engine". Every
// operator below patches one real `DesignSpecification` field (or, for
// `overlap`, the closest real field that actually drives it) — never a
// fabricated one, and `styleDnaId` is never touched by any operator here,
// satisfying the brief's "Maintain Style DNA" instruction by construction
// rather than by a runtime check. Bounds are computed from real data
// (`HIERARCHY_PRESETS`) rather than hand-picked magic numbers wherever a
// real reference range exists.

const CLAMP_MIN = 0.05;
const CLAMP_MAX = 0.95;

function clamp01(value: number): number {
  return Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, value));
}

/** Real observed min/max for each hierarchy scale field across every
 * built-in preset (`engine/hierarchy.ts`) — computed once from that real
 * data so mutated scale values never wander into a range the app's own
 * presets never use. */
const SCALE_FIELDS = ['heroScale', 'secondaryScale', 'fillerScale', 'accentScale'] as const;
type ScaleField = (typeof SCALE_FIELDS)[number];

function scaleFieldBounds(field: ScaleField): { min: number; max: number } {
  const values = Object.values(HIERARCHY_PRESETS).map((p) => p.value[field]);
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** Section 2, "Adjust cluster density" — jitters `density` (the real lever
 * the Candidate Engine uses for how tightly motifs pack a tile). */
export function mutateClusterDensity(spec: DesignSpecification, rng: Rng): DesignSpecification {
  return { ...spec, density: clamp01(jitter(rng, spec.density, 0.15)) };
}

/** Section 2, "Adjust motif scale" — jitters one randomly chosen
 * hierarchy role's scale multiplier, clamped to the real range every
 * built-in Hierarchy Preset uses for that role. */
export function mutateMotifScale(spec: DesignSpecification, rng: Rng): DesignSpecification {
  const field = rngPick(rng, SCALE_FIELDS);
  const { min, max } = scaleFieldBounds(field);
  const spread = (max - min) * 0.25;
  const next = Math.min(max, Math.max(min, jitter(rng, spec.hierarchy[field], spread)));
  return { ...spec, hierarchy: { ...spec.hierarchy, [field]: next } };
}

/** Section 2, "Adjust overlap" — `DesignSpecification` has no direct
 * "overlap" field; overlap is an emergent property of how much surface
 * area motifs claim relative to the space they're packed into. `density`
 * is that real lever (the same one Section 4's Design Critic measures
 * `overlapQuality` against), so this operator jitters density in the
 * overlap-relevant direction — the same honesty discipline Phase 7's Art
 * Direction Engine used for indirect recommendation levers. Distinct from
 * `mutateClusterDensity` only in the jitter amount (a sharper nudge, since
 * this operator is specifically hunting for an overlap change, not a
 * general density change). */
export function mutateOverlap(spec: DesignSpecification, rng: Rng): DesignSpecification {
  return { ...spec, density: clamp01(jitter(rng, spec.density, 0.25)) };
}

/** Section 2, "Adjust hierarchy" — swaps to a different real Hierarchy
 * Preset (`engine/hierarchy.ts`'s `HIERARCHY_PRESETS`) rather than
 * randomizing the 8 hierarchy fields independently, so the result is
 * always an internally-consistent, already-validated hierarchy. */
export function mutateHierarchy(spec: DesignSpecification, rng: Rng): DesignSpecification {
  const presets = Object.values(HIERARCHY_PRESETS);
  const alternatives = presets.filter((p) => JSON.stringify(p.value) !== JSON.stringify(spec.hierarchy));
  const pool = alternatives.length > 0 ? alternatives : presets;
  return { ...spec, hierarchy: { ...rngPick(rng, pool).value } };
}

/** Section 2, "Adjust palette weighting" — reassigns which of the
 * palette's own already-approved colors plays which named role
 * (background/primary/secondary/accent), rather than switching to a
 * different palette entirely. This keeps both `styleDnaId` and
 * `palette.id` untouched, the most literal reading of "maintain Style
 * DNA": the mutation changes emphasis among real, already-chosen colors,
 * not the palette identity itself. */
export function mutatePaletteWeighting(spec: DesignSpecification, rng: Rng): DesignSpecification {
  const roles = ['background', 'primary', 'secondary', 'accent'] as const;
  const a = rngPick(rng, roles);
  const remaining = roles.filter((r) => r !== a);
  const b = rngPick(rng, remaining);
  const nextColorRoles = { ...spec.colorRoles, [a]: spec.colorRoles[b], [b]: spec.colorRoles[a] };
  return { ...spec, colorRoles: nextColorRoles };
}

/** Section 2, "Adjust negative space" — jitters `negativeSpace` directly. */
export function mutateNegativeSpace(spec: DesignSpecification, rng: Rng): DesignSpecification {
  return { ...spec, negativeSpace: clamp01(jitter(rng, spec.negativeSpace, 0.15)) };
}

export const MUTATION_OPERATORS: Record<MutationType, (spec: DesignSpecification, rng: Rng) => DesignSpecification> = {
  clusterDensity: mutateClusterDensity,
  motifScale: mutateMotifScale,
  overlap: mutateOverlap,
  hierarchy: mutateHierarchy,
  paletteWeighting: mutatePaletteWeighting,
  negativeSpace: mutateNegativeSpace,
};

export const MUTATION_TYPES = Object.keys(MUTATION_OPERATORS) as MutationType[];

/** Applies one named mutation and captures its real effect via
 * `diffJson` — never a hand-written description of what changed. */
export function applyMutation(spec: DesignSpecification, type: MutationType, rng: Rng): { spec: DesignSpecification; mutation: AppliedMutation } {
  const mutated = MUTATION_OPERATORS[type](spec, rng);
  return { spec: mutated, mutation: { type, diff: diffJson(spec, mutated) } };
}

export function applyRandomMutation(spec: DesignSpecification, rng: Rng): { spec: DesignSpecification; mutation: AppliedMutation } {
  return applyMutation(spec, rngPick(rng, MUTATION_TYPES), rng);
}

/** Applies 1 mutation, then keeps layering on additional *distinct*
 * mutation types with probability `extraMutationChance` each time — used
 * by the evolution loop's `mutationRate` config so a single candidate can
 * plausibly combine e.g. a density change with a hierarchy swap. */
export function applyRandomMutations(spec: DesignSpecification, rng: Rng, extraMutationChance = 0): { spec: DesignSpecification; mutations: AppliedMutation[] } {
  const usedTypes = new Set<MutationType>();
  let current = spec;
  const mutations: AppliedMutation[] = [];

  const first = applyRandomMutation(current, rng);
  current = first.spec;
  mutations.push(first.mutation);
  usedTypes.add(first.mutation.type);

  while (usedTypes.size < MUTATION_TYPES.length && rngBool(rng, extraMutationChance)) {
    const remaining = MUTATION_TYPES.filter((t) => !usedTypes.has(t));
    const type = rngPick(rng, remaining);
    const applied = applyMutation(current, type, rng);
    current = applied.spec;
    mutations.push(applied.mutation);
    usedTypes.add(type);
  }

  return { spec: current, mutations };
}
