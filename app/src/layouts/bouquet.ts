import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { buildClusterPlacements } from '../engine/clusterEngine';

/** Bouquet Layout — Project Phoenix V2: this layout was the original,
 * bespoke single-archetype precedent the shared Cluster Composition Engine
 * (`engine/clusterEngine.ts`) generalized into 8 named archetypes; it now
 * calls that shared engine with the `'bouquet'` archetype instead of
 * duplicating its own copy of the same "hero at the center, tumbled
 * smaller motifs around it" math. This also fixes a real gap: `bouquet` is
 * hierarchy-exempt (`HIERARCHY_EXEMPT_LAYOUTS`, since it already builds its
 * own tiers) but its old bespoke placements never set `Placement.role` at
 * all — every motif silently had no hierarchy tag, exported SVG with no
 * `data-role`, and no Hero Motif Complexity (Section 3) or hierarchy-aware
 * scoring could ever recognize a bouquet's own hero. The Cluster Engine
 * tags every member's role by construction, so that gap is closed for
 * every bouquet pattern generated from here on. */
export const bouquetLayout: PatternLayout = {
  id: 'bouquet',
  label: 'Bouquet',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    return buildClusterPlacements(
      {
        tileSize: params.tileSize,
        motifSize: params.motifSize,
        density: params.density,
        rotationJitter: params.rotationJitter,
        scaleJitter: params.scaleJitter,
        archetypes: ['bouquet'],
      },
      rng,
    );
  },
};
