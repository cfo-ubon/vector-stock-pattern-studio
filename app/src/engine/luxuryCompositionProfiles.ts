import type { Rng } from './types';
import { rngPick } from './rng';

// Build 025 (Luxury Floral Composition & Stability Engine), Phase 2.
//
// BUILD_025_AUDIT.md's failure-seed audit found `luxuryFloral`'s
// fragmentedSilhouette defect is not (primarily) about any single cluster's
// own internal geometry -- `clusterEngine.ts`'s `generateCluster` already
// produces a cohesive bouquet shape -- it's about WHERE cluster anchors land
// relative to each other. `clusterEngine.ts`'s `placeClusterAnchors` scatters
// anchors across a whole composition zone with only an average-based
// minimum-distance rule; nothing about that placement guarantees any two
// anchors end up close enough, in a consistent enough direction, for the
// tile to read as "one arrangement" rather than "several unrelated bouquets
// sharing a canvas". A named composition profile fixes that: instead of one
// generic anchor strategy, each profile commits to a real, distinct
// skeleton -- one dominant mass (or two, deliberately connected) per
// bouquet UNIT, a bounded reach for every supporting anchor within that
// unit, and an explicit silhouette a 128px thumbnail should read as.
//
// A profile describes ONE bouquet unit's own internal topology, not the
// whole tile: a Luxury Floral tile is a REPEATING pattern, so (like every
// other cluster-based layout in this codebase) it tiles several such units
// across the canvas via the existing zone-scatter anchor placement
// (`clusterEngine.ts`'s `placeClusterAnchors`, reused unchanged) — each
// scattered anchor becomes one unit's own primary hero, and this profile's
// fields govern that unit's secondaries/scale/spine. An earlier version of
// this module gave each profile a single fixed tile-fraction anchor point
// (one arrangement for the WHOLE tile) -- measured to collapse
// `largestEmptyRegion`/`occupancyRatio`/`quadrantBalance` and trigger a
// `crowdedAreas` regression, because a single composition has nowhere near
// enough scale to cover a full repeating tile. Fixed by tiling instead.

export type LuxuryCompositionProfileId =
  | 'dominantCentral'
  | 'offsetEditorial'
  | 'diagonalLuxury'
  | 'crescentPremium'
  | 'asymmetricCascading'
  | 'dualMassConnected';

export type LuxurySpineShape = 'straight' | 'arc' | 'crescent' | 'diagonal' | 'cascade' | 'dual';

export interface LuxuryCompositionProfile {
  id: LuxuryCompositionProfileId;
  label: string;
  /** How many secondary (non-hero) cluster anchors surround the primary
   * (and, if present, the secondary hub) -- fewer/larger anchors read as one
   * arrangement; too many independently-scattered anchors is exactly the
   * defect this profile system replaces. */
  secondaryAnchorCount: [number, number];
  /** Every secondary anchor is placed within this many `baseRadius` units
   * of its governing mass (primary or hub) -- the guarantee that makes
   * placement topology-aware BY CONSTRUCTION rather than "close by chance"
   * (see `topologyPlacement.ts`). */
  maxSecondaryDistanceMul: number;
  /** Minimum reach for a secondary anchor -- prevents secondary anchors from
   * collapsing directly onto the primary mass (which would just enlarge the
   * primary blob rather than reading as its own supporting cluster). */
  minSecondaryDistanceMul: number;
  primaryMassRadiusMul: number;
  secondaryMassRadiusMul: number;
  /** 1 for every single-mass profile; 2 for `dualMassConnected` (one hero
   * per connected mass). */
  heroCount: 1 | 2;
  /** Hero Dominance Engine (Phase 3): the floor every primary hero anchor's
   * `sizeMul` is raised to, and the ceiling every non-hero anchor's
   * `sizeMul` is capped at -- see `heroDominanceEngine.ts`. */
  heroScaleFloor: number;
  secondaryScaleCeiling: number;
  spineShape: LuxurySpineShape;
  /** Max satellite (far-flung, deliberately small) anchors this profile
   * tolerates -- never zero (real bouquets have a stray sprig or two) but
   * always small relative to `secondaryAnchorCount`. */
  allowedSatellites: number;
  edgeParticipation: 'none' | 'partial' | 'full';
  negativeSpaceCorridor: 'none' | 'single' | 'dual';
  thumbnailSilhouetteTarget: 'singleMass' | 'twoMass' | 'diagonalSweep' | 'crescentArc';
}

export const LUXURY_COMPOSITION_PROFILES: Record<LuxuryCompositionProfileId, LuxuryCompositionProfile> = {
  dominantCentral: {
    id: 'dominantCentral',
    label: 'Dominant Central Bouquet',
    secondaryAnchorCount: [2, 4],
    maxSecondaryDistanceMul: 2.0,
    minSecondaryDistanceMul: 0.9,
    primaryMassRadiusMul: 1.3,
    secondaryMassRadiusMul: 0.65,
    heroCount: 1,
    heroScaleFloor: 1.7,
    secondaryScaleCeiling: 0.85,
    spineShape: 'straight',
    allowedSatellites: 1,
    edgeParticipation: 'partial',
    negativeSpaceCorridor: 'single',
    thumbnailSilhouetteTarget: 'singleMass',
  },
  offsetEditorial: {
    id: 'offsetEditorial',
    label: 'Offset Editorial Bouquet',
    secondaryAnchorCount: [2, 3],
    maxSecondaryDistanceMul: 2.2,
    minSecondaryDistanceMul: 1.0,
    primaryMassRadiusMul: 1.2,
    secondaryMassRadiusMul: 0.6,
    heroCount: 1,
    heroScaleFloor: 1.65,
    secondaryScaleCeiling: 0.8,
    spineShape: 'arc',
    allowedSatellites: 1,
    edgeParticipation: 'none',
    negativeSpaceCorridor: 'single',
    thumbnailSilhouetteTarget: 'singleMass',
  },
  diagonalLuxury: {
    id: 'diagonalLuxury',
    label: 'Diagonal Luxury Bouquet',
    secondaryAnchorCount: [3, 5],
    maxSecondaryDistanceMul: 2.6,
    minSecondaryDistanceMul: 1.0,
    primaryMassRadiusMul: 1.25,
    secondaryMassRadiusMul: 0.6,
    heroCount: 1,
    heroScaleFloor: 1.6,
    secondaryScaleCeiling: 0.82,
    spineShape: 'diagonal',
    allowedSatellites: 2,
    edgeParticipation: 'partial',
    negativeSpaceCorridor: 'dual',
    thumbnailSilhouetteTarget: 'diagonalSweep',
  },
  crescentPremium: {
    id: 'crescentPremium',
    label: 'Crescent Premium Bouquet',
    secondaryAnchorCount: [3, 5],
    maxSecondaryDistanceMul: 2.1,
    minSecondaryDistanceMul: 1.1,
    primaryMassRadiusMul: 1.15,
    secondaryMassRadiusMul: 0.6,
    heroCount: 1,
    heroScaleFloor: 1.6,
    secondaryScaleCeiling: 0.8,
    spineShape: 'crescent',
    allowedSatellites: 1,
    edgeParticipation: 'partial',
    negativeSpaceCorridor: 'single',
    thumbnailSilhouetteTarget: 'crescentArc',
  },
  asymmetricCascading: {
    id: 'asymmetricCascading',
    label: 'Asymmetric Cascading Bouquet',
    secondaryAnchorCount: [3, 5],
    maxSecondaryDistanceMul: 2.8,
    minSecondaryDistanceMul: 1.0,
    primaryMassRadiusMul: 1.2,
    secondaryMassRadiusMul: 0.55,
    heroCount: 1,
    heroScaleFloor: 1.6,
    secondaryScaleCeiling: 0.78,
    spineShape: 'cascade',
    allowedSatellites: 2,
    edgeParticipation: 'partial',
    negativeSpaceCorridor: 'single',
    thumbnailSilhouetteTarget: 'diagonalSweep',
  },
  dualMassConnected: {
    id: 'dualMassConnected',
    label: 'Dual-Mass Connected Bouquet',
    secondaryAnchorCount: [2, 3],
    maxSecondaryDistanceMul: 1.9,
    minSecondaryDistanceMul: 0.9,
    primaryMassRadiusMul: 1.1,
    secondaryMassRadiusMul: 0.95,
    heroCount: 2,
    heroScaleFloor: 1.5,
    secondaryScaleCeiling: 0.8,
    spineShape: 'dual',
    allowedSatellites: 1,
    edgeParticipation: 'none',
    negativeSpaceCorridor: 'dual',
    thumbnailSilhouetteTarget: 'twoMass',
  },
};

export const LUXURY_COMPOSITION_PROFILE_IDS: LuxuryCompositionProfileId[] = [
  'dominantCentral', 'offsetEditorial', 'diagonalLuxury', 'crescentPremium', 'asymmetricCascading', 'dualMassConnected',
];

/** Deterministically picks one profile per tile (the same "commit to one
 * real skeleton, don't blend everything" convention `pickCompositionZone`/
 * `pickArchetypePool` already established in `clusterEngine.ts`) -- every
 * bouquet unit `topologyPlacement.ts` builds across this tile uses the
 * SAME profile, so the whole pattern reads as one consistent composition
 * language repeated, not a mix of unrelated skeletons. */
export function pickLuxuryCompositionProfile(rng: Rng, candidates: LuxuryCompositionProfileId[] = LUXURY_COMPOSITION_PROFILE_IDS): LuxuryCompositionProfile {
  const id = rngPick(rng, candidates);
  return LUXURY_COMPOSITION_PROFILES[id];
}
