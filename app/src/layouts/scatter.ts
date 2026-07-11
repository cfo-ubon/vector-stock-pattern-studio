import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { buildClusterPlacements, pickArchetypePool } from '../engine/clusterEngine';

/** Random Scatter — Project Phoenix V2, Section 1: previously placed
 * individual motifs completely independently (a plain Poisson-disc point
 * scatter, one motif per point, no relationship between neighbors), which
 * is the exact "scattered individual motifs" failure mode the brief names.
 * Now routes through the Cluster Composition Engine instead: motifs are
 * grouped into small organic clusters (hero + supporting members, real
 * overlap, non-uniform spacing) which are then themselves scattered across
 * the tile — "random" now describes which cluster archetype and how the
 * clusters land, not each individual motif's isolation from every other
 * one. Same `PatternLayout` interface, same id/label, so nothing about how
 * this layout is selected or configured in the UI changes. */
export const scatterLayout: PatternLayout = {
  id: 'scatter',
  label: 'Random Scatter',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const archetypes = pickArchetypePool(rng, ['organicScatter', 'bouquet', 'asymmetric']);
    return buildClusterPlacements(
      {
        tileSize: params.tileSize,
        motifSize: params.motifSize,
        density: params.density,
        rotationJitter: params.rotationJitter,
        scaleJitter: params.scaleJitter,
        archetypes,
      },
      rng,
    );
  },
};
