// Build 023 (Premium Bouquet Silhouette & Visual Cohesion Upgrade):
// Premium Visual Richness Budget. `engine/repairPass.ts`'s bounded repair
// could, in principle, nudge every isolated cluster member all the way
// toward its anchor until nothing reads as fragmented anymore — but a
// bouquet where every bloom is pulled tight against its neighbor stops
// looking like a natural arrangement and starts looking like a single
// blob, which is exactly the "homogenize every style" outcome the
// brief's own non-negotiable rules forbid. This module is the one place
// that decides how much repair a style is allowed, so that decision is
// visible and testable rather than a magic number buried in the repair
// pass itself.

export interface RichnessBudget {
  /** Upper bound on the fraction of a single cluster's non-hero members
   * `applyBouquetRepairPass` may reposition, in total across every
   * iteration. Never 1.0 — some natural looseness/variation is always
   * preserved, even for the most aggressively-fragmented premium preset. */
  maxRepairFraction: number;
}

const PREMIUM_HERO_MAX_REPAIR_FRACTION = 0.75;
const DEFAULT_MAX_REPAIR_FRACTION = 0.6;

/** `premiumHero` styles (Build 004/010's multi-part bouquet heroes) cost
 * far more of the tile's SVG node budget per instance than a simple
 * single-shape motif (see `tile.ts`'s Section-10 thinning comment on
 * per-role cost), which is *why* their thinnable budget is tight enough to
 * strand most cluster members in the first place (BUILD_023_AUDIT.md
 * Finding 2) — so they're allowed a higher repair ceiling to compensate,
 * while every other style keeps a more conservative one. */
export function computeRichnessBudget(premiumHero: boolean): RichnessBudget {
  return { maxRepairFraction: premiumHero ? PREMIUM_HERO_MAX_REPAIR_FRACTION : DEFAULT_MAX_REPAIR_FRACTION };
}
