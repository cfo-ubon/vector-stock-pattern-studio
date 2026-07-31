import { COLLECTION_PATTERN_TYPE_VALUES, type CollectionPatternType, type PatternTypeCounts } from '../design-director/domain/collectionPlan';
import { defaultPatternTypeRatios } from '../design-director/planner/collectionPlanner';
import type { CollectionRolePlanEntry } from './domain/designPlan';

// Build 029, Module 5 — Autonomous Collection Planner. Reuses
// `design-director/planner/collectionPlanner.ts`'s own `defaultPatternTypeRatios`
// (Build 028B) for the actual size-splitting arithmetic (rounding, remainder
// distribution) — this module's only real job is choosing WHICH ratio to
// hand it, adapted to marketplace/product target/production goal/collection
// size, instead of always the one fixed default ratio a manual Collection
// Plan starts from.

export type AutopilotProductionGoal = 'auto' | 'single' | 'collection' | 'portfolioExpansion' | 'seasonal';

export interface RoleRatioContext {
  marketplace: string;
  productionGoal: AutopilotProductionGoal;
  totalSize: number;
}

/** A single pattern's ratio table — every weight sums to 1 by construction
 * (each entry below is `remaining / COUNT_LEFT` at the point it's set, then
 * the whole map is renormalized), never edited freely. */
function ratioFromWeights(weights: Record<CollectionPatternType, number>): Record<CollectionPatternType, number> {
  const total = COLLECTION_PATTERN_TYPE_VALUES.reduce((sum, t) => sum + weights[t], 0);
  const ratio = {} as Record<CollectionPatternType, number>;
  for (const t of COLLECTION_PATTERN_TYPE_VALUES) ratio[t] = total > 0 ? weights[t] / total : 1 / COLLECTION_PATTERN_TYPE_VALUES.length;
  return ratio;
}

const HERO_ONLY_WEIGHTS: Record<CollectionPatternType, number> = {
  hero: 1, secondary: 0, blender: 0, stripe: 0, border: 0, coordinate: 0, miniPattern: 0, texture: 0,
};

/** Broad, evenly-diversified default — every role represented, matching
 * `defaultPatternTypeRatios`'s own `DEFAULT_RATIO` shape but expressed as
 * weights so it composes with the marketplace/goal adjustments below. */
const BALANCED_WEIGHTS: Record<CollectionPatternType, number> = {
  hero: 0.15, secondary: 0.2, blender: 0.2, stripe: 0.1, border: 0.1, coordinate: 0.15, miniPattern: 0.05, texture: 0.05,
};

/** Stock-marketplace collections (Shutterstock/Adobe Stock/Freepik/Getty)
 * are judged on breadth and coordinate variety more than a single hero
 * print, so this shifts weight toward coordinate/blender. Etsy/print-on-
 * demand collections lean on a strong hero + close secondary supporting
 * cast (what a buyer actually browses a shop page for). */
function marketplaceWeightAdjustment(marketplace: string): Partial<Record<CollectionPatternType, number>> {
  const m = marketplace.toLowerCase();
  if (m.includes('shutterstock') || m.includes('adobe') || m.includes('freepik') || m.includes('getty') || m.includes('istock')) {
    return { coordinate: 0.22, blender: 0.24, texture: 0.08 };
  }
  if (m.includes('etsy')) {
    return { hero: 0.2, secondary: 0.24, border: 0.12 };
  }
  return {};
}

/** Chooses and returns the real ratio (not counts) for this run's context —
 * the one function `buildAutonomousDesignPlan` calls before handing the
 * result to `defaultPatternTypeRatios` for the actual arithmetic. */
export function resolveCollectionRoleRatio(context: RoleRatioContext): Record<CollectionPatternType, number> {
  if (context.productionGoal === 'single' || context.totalSize <= 1) {
    return ratioFromWeights(HERO_ONLY_WEIGHTS);
  }
  const adjustment = marketplaceWeightAdjustment(context.marketplace);
  const weights = { ...BALANCED_WEIGHTS, ...adjustment };
  return ratioFromWeights(weights);
}

/** The full role plan (Module 5's own output shape) — real counts per role,
 * summing exactly to `context.totalSize`, plus diversity guidance the
 * generation orchestrator (Module 6) uses so it never repeats the same
 * composition/scale/density across items sharing a role. */
export function buildCollectionRolePlan(context: RoleRatioContext): { counts: PatternTypeCounts; entries: CollectionRolePlanEntry[] } {
  const ratio = resolveCollectionRoleRatio(context);
  const counts = defaultPatternTypeRatios(context.totalSize, ratio);
  const entries: CollectionRolePlanEntry[] = COLLECTION_PATTERN_TYPE_VALUES.filter((role) => counts[role] > 0).map((role) => ({ role, count: counts[role] }));
  return { counts, entries };
}

/** Per-role composition/density/scale diversity presets — Module 5's
 * "diversity across Hero Motif / composition / pattern role / scale /
 * density / negative space" requirement, expressed as real, distinct
 * generator-facing values per role rather than one flat config repeated
 * for every item. */
export interface RoleVisualProfile {
  composition: string;
  density: number;
  scale: 'small' | 'medium' | 'large';
  complexity: 'simple' | 'moderate' | 'intricate';
}

const ROLE_VISUAL_PROFILES: Record<CollectionPatternType, RoleVisualProfile> = {
  hero: { composition: 'layered-cluster', density: 0.55, scale: 'large', complexity: 'intricate' },
  secondary: { composition: 'balanced-toss', density: 0.5, scale: 'medium', complexity: 'moderate' },
  blender: { composition: 'grid', density: 0.4, scale: 'small', complexity: 'simple' },
  stripe: { composition: 'grid', density: 0.6, scale: 'medium', complexity: 'simple' },
  border: { composition: 'grid', density: 0.35, scale: 'medium', complexity: 'moderate' },
  coordinate: { composition: 'balanced-toss', density: 0.45, scale: 'small', complexity: 'moderate' },
  miniPattern: { composition: 'grid', density: 0.3, scale: 'small', complexity: 'simple' },
  texture: { composition: 'grid', density: 0.65, scale: 'small', complexity: 'simple' },
};

export function roleVisualProfile(role: CollectionPatternType): RoleVisualProfile {
  return ROLE_VISUAL_PROFILES[role];
}
