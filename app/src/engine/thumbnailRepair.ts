import type { Placement } from './types';
import { computeThumbnailLegibility } from './thumbnailLegibility';

// Build 024, Phase 8: Thumbnail-Aware Repair. Deterministic, bounded,
// max-3-iteration repair over the SAME `Placement[]` the Thumbnail
// Legibility Engine (Phase 7) just scored at 128px — the same "measure,
// bounded nudge, re-measure, stop at a fixed point or the iteration cap"
// shape `engine/repairPass.ts` already established for bouquet cohesion.
//
// Scoped to ONE repair action: enlarging the hero. This module originally
// also nudged crowding neighbors away from the hero ("increase hero-
// background separation") — that action was removed after an empirical
// regression it caused: `engine/tile.ts`'s Section-10 node-budget thinning
// (`stratifiedSelect`) chooses which non-hero placements survive based on
// their SPATIAL DISTRIBUTION, and repositioning many of them pre-thinning
// (this repair necessarily runs before thinning — see `engine/tile.ts`'s
// wiring comment) changed which subset of grown/complex instances survived,
// measurably DROPPING `botanicalBeautyMetrics.ts`'s `botanicalComplexity`
// score for a premiumHero tile (100 -> 89 on the exact seed
// `botanicalBeautyMetrics.test.ts`'s own "premium-hero-enabled tile scores
// higher" regression test uses) even though the repair never touched hero
// or motif count. Enlarging the hero alone has no such risk: the hero is
// unconditionally protected from thinning (`protectedIndices` in
// `engine/tile.ts`) and never enters `stratifiedSelect`'s spatial
// distribution at all, so changing only its own scale cannot ripple into
// which OTHER placements survive. Count-reducing actions (the brief's
// "reduce filler count", "reduce dark mass") are intentionally NOT
// implemented here either — see BUILD_024_REPORT.md's honest scope note —
// for the same "don't disturb thinning's own selection" reason.
//
// Only invoked (see `engine/tile.ts`) for styles whose resolved
// `artDirectionModel.thumbnailIntent === 'heroMustDominate'` — the
// premiumHero/heroFocus styles that most need it — keeping blast radius
// small and independently testable rather than risking every preset's
// existing measured scores in one pass.

const MAX_ITERATIONS = 3;
const LEGIBILITY_FLOOR = 55;
/** Per-iteration hero scale bump; bounded total across all 3 iterations. */
const HERO_ENLARGE_STEP = 0.06;
const MAX_HERO_ENLARGE_TOTAL = 0.18;

export interface ThumbnailRepairResult {
  placements: Placement[];
  actionsApplied: string[];
  iterationsUsed: number;
}

function enlargeHero(placements: Placement[], heroEnlargeSoFar: number): { placements: Placement[]; applied: boolean } {
  if (heroEnlargeSoFar >= MAX_HERO_ENLARGE_TOTAL) return { placements, applied: false };
  let applied = false;
  const next = placements.map((p) => {
    if (p.role !== 'hero') return p;
    applied = true;
    return { ...p, scale: p.scale * (1 + HERO_ENLARGE_STEP) };
  });
  return { placements: next, applied };
}

/** Runs up to `MAX_ITERATIONS` bounded repair passes, re-measuring 128px
 * legibility after each, stopping as soon as the floor is cleared or no
 * action changed anything (a natural fixed point). A tile already at/above
 * the floor is a strict no-op — zero iterations, zero applied actions, same
 * placements reference. */
export function applyThumbnailAwareRepair(placements: Placement[], tileSize: number, motifSize: number): ThumbnailRepairResult {
  let current = placements;
  const actionsApplied: string[] = [];
  let iterationsUsed = 0;
  let heroEnlargeSoFar = 0;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const legibility = computeThumbnailLegibility(current, tileSize, motifSize);
    const worst = legibility.scales.find((s) => s.scale === 128)!;
    if (worst.legibilityScore >= LEGIBILITY_FLOOR) break;

    let changed = false;
    if (legibility.repairRecommendations.includes('enlargeHero')) {
      const result = enlargeHero(current, heroEnlargeSoFar);
      if (result.applied) {
        current = result.placements;
        heroEnlargeSoFar += HERO_ENLARGE_STEP;
        actionsApplied.push(`enlargeHero(iter ${iter + 1})`);
        changed = true;
      }
    }
    iterationsUsed++;
    if (!changed) break;
  }

  return { placements: current, actionsApplied, iterationsUsed };
}
