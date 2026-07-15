import type { TileData } from '../engine/types';
import { extractInstances, gridCoverage, type MotifInstance } from '../engine/svgGeometry';
import { computeHeroVisibilityScore, type CompositionMetrics } from '../engine/scoring';

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
//
// Composition Intelligence Foundation V2 (Build 001) — Section 9,
// "Silhouette Check" — adds an 11th detector, Fragmented Silhouette,
// answering a genuinely different question than any of the above: not
// "is any one region crowded/empty/mechanical" but "does the pattern's own
// ink read as one (or a few) cohesive shape(s) from a distance, or as many
// disconnected islands". Built on `engine/svgGeometry.ts`'s `gridCoverage`
// (reused, not duplicated — the same occupancy grid `engine/scoring.ts`'s
// dead-space check already builds), flood-filling connected *occupied*
// cells rather than empty ones.
//
// Build 001.1 — Sections 5 and 9 add 3 more detectors: `lowHeroVisibility`
// (Section 5's new composite Hero Visibility Score, reused rather than
// recomputed — see `engine/scoring.ts`'s `computeHeroVisibilityScore`),
// `weakHierarchy` (a direct re-labeling of the existing `hierarchy` metric,
// the same pattern `weakHero`/`deadSpace`/etc. below already use), and
// `tooManyFillers` (genuinely new: no existing metric measures "what
// fraction of instances are fillers", so this counts roles directly off
// the same per-instance data `crowdedAreas`/`repeatedRotation` already use).

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
  | 'weakFlow'
  | 'fragmentedSilhouette'
  | 'lowHeroVisibility'
  | 'weakHierarchy'
  | 'tooManyFillers';

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

const FRAGMENTED_ISOLATED_FRACTION_THRESHOLD = 0.45;
const FRAGMENTED_LARGEST_BLOB_CEILING = 0.5;
const SILHOUETTE_GRID_MIN = 4;
const SILHOUETTE_GRID_MAX = 40;
/** How many motif-widths make up one grid cell — tuned so a single motif's
 * own footprint occupies roughly one cell, the same reasoning
 * `engine/clusterEngine.ts`'s `clusterBaseRadius` uses for its own spacing
 * math (never a fixed pixel constant, always relative to the pattern's own
 * real motif size). A *fixed* cell count (as `engine/scoring.ts`'s dead-
 * space check uses) works for "how big is the largest hole" but produces a
 * false "always one connected blob" reading here: this pattern's toroidal
 * wrap means a fixed coarse grid's cells are almost always touching
 * regardless of how sparse the real placements are. */
const SILHOUETTE_CELL_TO_MOTIF_RATIO = 1.6;

/** Flood-fills an occupancy grid sized to the pattern's own real motif
 * footprint (via `engine/svgGeometry.ts`'s `gridCoverage`, reused rather
 * than duplicated) to find connected components of *occupied* cells — the
 * inverse concept of "largest empty region". A pattern with one dominant
 * blob (or a few large ones) reads as a cohesive surface from a distance;
 * a pattern with many small, mostly single-cell islands and no single
 * blob claiming a real share of the ink reads as fragmented confetti. */
function detectFragmentedSilhouette(tile: TileData, instances: MotifInstance[]): VisualIssue {
  if (instances.length < 3) {
    return { id: 'fragmentedSilhouette', label: 'Fragmented Silhouette', detected: false, evidence: 'Too few instances to assess overall silhouette.' };
  }
  const tileSize = tile.params.tileSize;
  const motifSize = tile.params.motifSize;
  const silhouetteGridSize = Math.max(
    SILHOUETTE_GRID_MIN,
    Math.min(SILHOUETTE_GRID_MAX, Math.round(tileSize / (motifSize * SILHOUETTE_CELL_TO_MOTIF_RATIO))),
  );
  const { gridN, counts } = gridCoverage(instances, tileSize, silhouetteGridSize);
  const totalCells = gridN * gridN;
  const visited = new Array(totalCells).fill(false);
  const componentSizes: number[] = [];
  for (let start = 0; start < totalCells; start++) {
    if (visited[start] || counts[start] === 0) continue;
    let size = 0;
    const queue = [start];
    visited[start] = true;
    while (queue.length > 0) {
      const idx = queue.pop()!;
      size++;
      const gx = idx % gridN;
      const gy = Math.floor(idx / gridN);
      const neighbors = [
        gy * gridN + ((gx + 1) % gridN),
        gy * gridN + ((gx - 1 + gridN) % gridN),
        ((gy + 1) % gridN) * gridN + gx,
        ((gy - 1 + gridN) % gridN) * gridN + gx,
      ];
      for (const n of neighbors) {
        if (!visited[n] && counts[n] > 0) {
          visited[n] = true;
          queue.push(n);
        }
      }
    }
    componentSizes.push(size);
  }
  const totalOccupied = componentSizes.reduce((a, b) => a + b, 0);
  if (totalOccupied === 0 || componentSizes.length <= 1) {
    return {
      id: 'fragmentedSilhouette',
      label: 'Fragmented Silhouette',
      detected: false,
      evidence: totalOccupied === 0 ? 'No occupied cells.' : 'The pattern occupies a single connected region.',
    };
  }
  const isolatedCount = componentSizes.filter((s) => s === 1).length;
  const isolatedFraction = isolatedCount / componentSizes.length;
  const largestFraction = Math.max(...componentSizes) / totalOccupied;
  const detected = isolatedFraction > FRAGMENTED_ISOLATED_FRACTION_THRESHOLD && largestFraction < FRAGMENTED_LARGEST_BLOB_CEILING;
  return {
    id: 'fragmentedSilhouette',
    label: 'Fragmented Silhouette',
    detected,
    evidence: `${componentSizes.length} separate ink region(s) on the ${gridN}x${gridN} grid, ${isolatedCount} single-cell island(s) (${Math.round(isolatedFraction * 100)}%), largest region holds ${Math.round(largestFraction * 100)}% of occupied cells.`,
  };
}

const HERO_VISIBILITY_THRESHOLD = 55;
const WEAK_HIERARCHY_THRESHOLD = 45;
const TOO_MANY_FILLERS_FRACTION_THRESHOLD = 0.72;

/** Build 001.1, Section 5: re-labels `computeHeroVisibilityScore` (itself a
 * weighted read of existing metrics — see its own doc comment) as a
 * discrete pass/fail issue, the same "reuse the real number, don't
 * recompute" pattern every entry in `detectFromMetrics` already follows. */
function detectLowHeroVisibility(metrics: CompositionMetrics): VisualIssue {
  const score = computeHeroVisibilityScore(metrics);
  return {
    id: 'lowHeroVisibility',
    label: 'Low Hero Visibility',
    detected: score < HERO_VISIBILITY_THRESHOLD,
    evidence: `Hero Visibility Score ${Math.round(score)}/100 (detail + separation + hierarchy + palette contrast, weighted).`,
  };
}

/** Build 001.1, Section 9: `hierarchy` on its own is already a real,
 * deliberate-tiering measurement (see `computeHierarchyAndScaleDiversity`
 * in `engine/scoring.ts`) — this just gives it a named threshold and
 * recommendation the way `weakHero`/`deadSpace` already give their own
 * source metrics one. */
function detectWeakHierarchy(metrics: CompositionMetrics): VisualIssue {
  return {
    id: 'weakHierarchy',
    label: 'Weak Hierarchy',
    detected: metrics.hierarchy < WEAK_HIERARCHY_THRESHOLD,
    evidence: `Hierarchy score ${Math.round(metrics.hierarchy)}/100 — scale tiering between roles doesn't read as deliberate.`,
  };
}

/** Build 001.1, Section 9: counts filler-role instances directly (no
 * existing `CompositionMetrics` field measures role mix) — flags when
 * fillers so heavily outnumber every other role that they compete with,
 * rather than support, the hero. Only meaningful when the tile actually
 * assigns roles at all (an unroled/no-hierarchy tile isn't "too many
 * fillers", it's simply not using roles). */
function detectTooManyFillers(instances: MotifInstance[]): VisualIssue {
  const roled = instances.filter((i) => i.role);
  if (roled.length === 0) {
    return { id: 'tooManyFillers', label: 'Too Many Fillers', detected: false, evidence: 'This tile does not assign hierarchy roles.' };
  }
  const fillerCount = roled.filter((i) => i.role === 'filler').length;
  const fraction = fillerCount / roled.length;
  return {
    id: 'tooManyFillers',
    label: 'Too Many Fillers',
    detected: fraction > TOO_MANY_FILLERS_FRACTION_THRESHOLD,
    evidence: `${fillerCount}/${roled.length} role-assigned instances (${Math.round(fraction * 100)}%) are fillers.`,
  };
}

/** Runs all 14 named Section 2/9/5 detectors against one rendered tile.
 * Deterministic — same tile always produces the same issue list. */
export function detectVisualIssues(tile: TileData, metrics: CompositionMetrics): VisualIssue[] {
  const instances = extractInstances(tile);
  return [
    ...detectFromMetrics(metrics, instances),
    detectCrowdedAreas(tile, instances),
    detectRepeatedRotation(instances),
    detectRepeatedScale(instances),
    detectFragmentedSilhouette(tile, instances),
    detectLowHeroVisibility(metrics),
    detectWeakHierarchy(metrics),
    detectTooManyFillers(instances),
  ];
}
