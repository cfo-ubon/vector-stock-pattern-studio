import type { TileData } from '../engine/types';
import { extractInstances, type MotifInstance } from '../engine/svgGeometry';
import type { CompositionMetrics } from '../engine/scoring';

// Design Critic & Art Direction Engine (Phase 7) — Section 2 "Visual
// Analysis". The brief names 10 discrete, labeled issues to detect. An
// audit of the existing engine found real, already-computed signals for
// 7 of them (Weak Hero, Dead Space, Mechanical Spacing, Grid Appearance,
// Weak Clusters, Low Detail, Weak Flow — each reused below from
// `engine/scoring.ts`'s `CompositionMetrics`, never recomputed) but no
// discrete per-instance detector for the remaining 3 (Crowded Areas,
// Repeated Rotation, Repeated Scale) — `rotationDiversity`/`scaleDiversity`
// on `CompositionMetrics` are aggregate diversity scores, not "which
// instances repeat" detectors. Those 3 are genuinely new here, built
// directly on `engine/svgGeometry.ts`'s real per-instance `MotifInstance`
// data (never re-deriving geometry that engine already extracts).

export type VisualIssueId =
  | 'weakHero'
  | 'crowdedAreas'
  | 'deadSpace'
  | 'mechanicalSpacing'
  | 'gridAppearance'
  | 'weakClusters'
  | 'lowDetail'
  | 'repeatedRotation'
  | 'repeatedScale'
  | 'weakFlow';

export interface VisualIssue {
  id: VisualIssueId;
  label: string;
  detected: boolean;
  /** A real, computed fact backing the detection — never generic text. */
  evidence: string;
}

const CROWDED_GRID_SIZE = 6;
const CROWDED_FRACTION_THRESHOLD = 0.3;

/** Divides the tile into a CROWDED_GRID_SIZE × CROWDED_GRID_SIZE grid and
 * flags "crowded" when any single cell holds more than
 * CROWDED_FRACTION_THRESHOLD of every instance on the tile — a real local-
 * density measurement, distinct from `densityVariance` (which measures
 * spread, not a specific offending region) and from `largestEmptyRegion`
 * (its exact inverse concept — dead space, not crowding). */
function detectCrowdedAreas(tile: TileData, instances: MotifInstance[]): VisualIssue {
  if (instances.length === 0) {
    return { id: 'crowdedAreas', label: 'Crowded Areas', detected: false, evidence: 'No motif instances placed.' };
  }
  const tileSize = tile.params.tileSize;
  const cellCounts = new Array(CROWDED_GRID_SIZE * CROWDED_GRID_SIZE).fill(0);
  for (const inst of instances) {
    const cx = Math.min(CROWDED_GRID_SIZE - 1, Math.max(0, Math.floor((inst.x / tileSize) * CROWDED_GRID_SIZE)));
    const cy = Math.min(CROWDED_GRID_SIZE - 1, Math.max(0, Math.floor((inst.y / tileSize) * CROWDED_GRID_SIZE)));
    cellCounts[cy * CROWDED_GRID_SIZE + cx]++;
  }
  const maxCount = Math.max(...cellCounts);
  const fraction = maxCount / instances.length;
  return {
    id: 'crowdedAreas',
    label: 'Crowded Areas',
    detected: fraction > CROWDED_FRACTION_THRESHOLD,
    evidence: `Densest ${CROWDED_GRID_SIZE}×${CROWDED_GRID_SIZE} grid cell holds ${maxCount}/${instances.length} instances (${Math.round(fraction * 100)}%).`,
  };
}

const ROTATION_BUCKET_COUNT = 12; // 30° buckets across 0-360°
const ROTATION_REPEAT_THRESHOLD = 0.4;

/** Buckets every instance's rotation into 30° slices and flags "repeated"
 * when one bucket holds more than ROTATION_REPEAT_THRESHOLD of all
 * instances — a real per-instance-pair concept (unlike `rotationDiversity`,
 * which only reports how many distinct buckets are used in aggregate, not
 * whether one specific angle dominates). */
function detectRepeatedRotation(instances: MotifInstance[]): VisualIssue {
  if (instances.length === 0) {
    return { id: 'repeatedRotation', label: 'Repeated Rotation', detected: false, evidence: 'No motif instances placed.' };
  }
  const counts = new Array(ROTATION_BUCKET_COUNT).fill(0);
  for (const inst of instances) {
    const normalized = ((inst.rot % 360) + 360) % 360;
    const bucket = Math.min(ROTATION_BUCKET_COUNT - 1, Math.floor((normalized / 360) * ROTATION_BUCKET_COUNT));
    counts[bucket]++;
  }
  const maxCount = Math.max(...counts);
  const fraction = maxCount / instances.length;
  return {
    id: 'repeatedRotation',
    label: 'Repeated Rotation',
    detected: fraction > ROTATION_REPEAT_THRESHOLD,
    evidence: `${maxCount}/${instances.length} instances (${Math.round(fraction * 100)}%) share the same ~30° rotation band.`,
  };
}

const SCALE_BUCKET_COUNT = 8;
const SCALE_REPEAT_THRESHOLD = 0.5;

/** Buckets every instance's scale into 8 evenly-spaced bands across the
 * observed min-max range and flags "repeated" when one band holds more
 * than SCALE_REPEAT_THRESHOLD of all instances — same per-instance-pair
 * concept as rotation, distinct from the aggregate `scaleDiversity` score. */
function detectRepeatedScale(instances: MotifInstance[]): VisualIssue {
  if (instances.length < 2) {
    return { id: 'repeatedScale', label: 'Repeated Scale', detected: false, evidence: 'Not enough instances to compare scale.' };
  }
  const scales = instances.map((i) => i.scale);
  const min = Math.min(...scales);
  const max = Math.max(...scales);
  const span = max - min || 1;
  const counts = new Array(SCALE_BUCKET_COUNT).fill(0);
  for (const s of scales) {
    const bucket = Math.min(SCALE_BUCKET_COUNT - 1, Math.max(0, Math.floor(((s - min) / span) * SCALE_BUCKET_COUNT)));
    counts[bucket]++;
  }
  const maxCount = Math.max(...counts);
  const fraction = maxCount / scales.length;
  return {
    id: 'repeatedScale',
    label: 'Repeated Scale',
    detected: fraction > SCALE_REPEAT_THRESHOLD,
    evidence: `${maxCount}/${scales.length} instances (${Math.round(fraction * 100)}%) share nearly the same scale.`,
  };
}

const WEAK_THRESHOLD = 50;
const LOW_DETAIL_NODE_THRESHOLD = 12;

/** Detects the remaining 7 issues by re-labeling real, already-computed
 * `CompositionMetrics` signals — see each entry's own threshold, borrowed
 * directly from `engine/scoring.ts`'s `SOFT_PENALTY_RULES` where a
 * matching rule already exists (Weak Hero/Dead Space/Mechanical Spacing/
 * Grid Appearance/Weak Clusters/Weak Flow), so a tile that already
 * triggers a soft penalty and a tile flagged here always agree. */
function detectFromMetrics(m: CompositionMetrics, instances: MotifInstance[]): VisualIssue[] {
  const avgNodeCount = instances.length > 0 ? instances.reduce((sum, i) => sum + i.nodeCount, 0) / instances.length : 0;
  return [
    {
      id: 'weakHero',
      label: 'Weak Hero',
      detected: m.heroDetailRatio < 45 || m.heroSeparation < 40,
      evidence: `Hero detail ratio ${Math.round(m.heroDetailRatio)}/100, hero separation ${Math.round(m.heroSeparation)}/100.`,
    },
    {
      id: 'deadSpace',
      label: 'Dead Space',
      detected: m.largestEmptyRegion < 40,
      evidence: `Largest empty region score ${Math.round(m.largestEmptyRegion)}/100 (lower = a bigger empty hole).`,
    },
    {
      id: 'mechanicalSpacing',
      label: 'Mechanical Spacing',
      detected: m.spacingUniformity < 35,
      evidence: `Spacing uniformity ${Math.round(m.spacingUniformity)}/100 — nearest-neighbor gaps read as suspiciously even.`,
    },
    {
      id: 'gridAppearance',
      label: 'Grid Appearance',
      detected: m.gridAppearanceScore < 40,
      evidence: `Grid appearance score ${Math.round(m.gridAppearanceScore)}/100 — neighbor directions concentrate on the axes.`,
    },
    {
      id: 'weakClusters',
      label: 'Weak Clusters',
      detected: m.clusterCohesion < 40,
      evidence: `Cluster cohesion ${Math.round(m.clusterCohesion)}/100 — hero motifs have little real supporting company nearby.`,
    },
    {
      id: 'lowDetail',
      label: 'Low Detail',
      detected: avgNodeCount > 0 && avgNodeCount < LOW_DETAIL_NODE_THRESHOLD,
      evidence: `Average ${Math.round(avgNodeCount)} SVG nodes per motif instance (below the ${LOW_DETAIL_NODE_THRESHOLD}-node floor this check uses).`,
    },
    {
      id: 'weakFlow',
      label: 'Weak Flow',
      detected: m.flowCoherence < WEAK_THRESHOLD,
      evidence: `Flow coherence ${Math.round(m.flowCoherence)}/100 — placement doesn't read as a deliberate directional sweep.`,
    },
  ];
}

/** Runs all 10 named Section 2 detectors against one rendered tile.
 * Deterministic — same tile always produces the same issue list. */
export function detectVisualIssues(tile: TileData, metrics: CompositionMetrics): VisualIssue[] {
  const instances = extractInstances(tile);
  return [
    ...detectFromMetrics(metrics, instances),
    detectCrowdedAreas(tile, instances),
    detectRepeatedRotation(instances),
    detectRepeatedScale(instances),
  ];
}
