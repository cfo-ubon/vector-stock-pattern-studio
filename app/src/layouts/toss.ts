import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { buildClusterPlacements, pickArchetypePool } from '../engine/clusterEngine';

/** Toss Pattern — Project Phoenix V2, Section 1: the classic "tossed
 * all-over" look, now built from directional Cluster Composition Engine
 * archetypes (diagonal / cascade / S-curve — all read as motifs "thrown"
 * along a casual axis) instead of one motif jittered independently inside
 * each cell of a regular grid. Same `PatternLayout` interface/id/label. */
export const tossLayout: PatternLayout = {
  id: 'toss',
  label: 'Toss Pattern',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const archetypes = pickArchetypePool(rng, ['diagonal', 'cascade', 'sCurve']);
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
