import type { Placement, Rng } from './types';
import type { ProductUseId } from '../collection/productTargets';
import type { CompositionZone } from './compositionZones';
import { generateCluster, evaluateCluster, clusterBaseRadius, placeClusterAnchors } from './clusterEngine';
import { createAngleFamily } from './rotationFamilies';
import { wrapCoord } from '../layouts/shared';
import { rngRange } from './rng';
import { pickLuxuryCompositionProfile, type LuxuryCompositionProfile } from './luxuryCompositionProfiles';
import { buildLuxuryUnit, type LuxuryAnchor } from './topologyPlacement';
import { applyHeroDominance, type HeroDominanceDiagnostics } from './heroDominanceEngine';
import { scoreConnectorCandidate, filterConnectorCandidates, type ConnectorCandidate } from './connectorQuality';

// Build 025 (Luxury Floral Composition & Stability Engine) — orchestrator.
// Wires Phases 2-5 (composition profiles, hero dominance, topology-aware
// placement, connector quality) into one drop-in alternative to
// `clusterEngine.ts`'s `buildClusterPlacements` for the `bouquet` layout,
// used only when a style opts in (`params.luxuryComposition`, set solely by
// the `luxuryFloral` Style DNA preset). Deliberately REUSES
// `clusterEngine.ts`'s own `placeClusterAnchors` (the same whole-tile,
// composition-zone-aware scatter every other cluster layout already uses)
// to decide WHERE each bouquet unit sits and how big it is, and its
// `generateCluster`/`evaluateCluster` for each individual cluster's
// internal member geometry (never reimplements or duplicates that
// anatomy) — only each unit's own SECONDARY-anchor topology, hero scale,
// and inter-anchor connectors are new.
//
// Named `luxuryFloralCompositionEngine.ts` (not `luxuryComposition.ts`) to
// avoid colliding with Build 009's existing `engine/luxuryComposition.ts`
// (the unrelated `computeLuxuryCompositionScore` metric aggregator).

export interface LuxuryCompositionOptions {
  tileSize: number;
  motifSize: number;
  density: number;
  rotationJitter: number;
  scaleJitter: number;
  archetypes: import('./clusterEngine').ClusterArchetype[];
  productTarget?: ProductUseId;
  zone?: CompositionZone;
}

export interface LuxuryCompositionResult {
  placements: Placement[];
  profileId: string;
  /** clusterId (== flattened anchor index) of each bouquet unit's own
   * primary hero — Repair Engine V2 groups by this, one unit at a time. */
  primaryClusterIds: number[];
  heroDominance: HeroDominanceDiagnostics;
  connectorCandidates: ConnectorCandidate[];
}

/** Build 025, Phase 8 (Product-Target-Specific Luxury Floral). Adjusts a
 * chosen profile's own numeric fields per product target — never invents a
 * new profile, only tunes the selected one's spacing/edge/density fields
 * within its own already-sane ranges. `apparel` has no dedicated
 * `ProductUseId` in this codebase (`textile` is the closest existing id,
 * the same honest proxy convention Build 012 used for `greetingCard`), so
 * `textile` doubles for it here. */
export function applyLuxuryProductAdjustment(profile: LuxuryCompositionProfile, productTarget?: ProductUseId): LuxuryCompositionProfile {
  switch (productTarget) {
    case 'fabric':
    case 'textile':
      // Smoother continuity, less isolated blocking, stronger edge flow.
      return { ...profile, maxSecondaryDistanceMul: profile.maxSecondaryDistanceMul * 0.9, edgeParticipation: 'full', allowedSatellites: Math.max(0, profile.allowedSatellites - 1) };
    case 'wallpaper':
      // Broader silhouette, slower rhythm, reduced congestion.
      return { ...profile, primaryMassRadiusMul: profile.primaryMassRadiusMul * 1.15, secondaryAnchorCount: [Math.max(1, profile.secondaryAnchorCount[0] - 1), Math.max(2, profile.secondaryAnchorCount[1] - 1)] };
    case 'wrappingPaper':
    case 'giftWrap':
      // Clearer rhythm, medium-scale readability, balanced spacing.
      return { ...profile, edgeParticipation: 'partial', maxSecondaryDistanceMul: profile.maxSecondaryDistanceMul * 1.05 };
    case 'packaging':
      // Crop resilience, stronger central identity, lower edge dependency.
      return { ...profile, edgeParticipation: 'none', heroScaleFloor: profile.heroScaleFloor * 1.08 };
    case 'stationery':
    case 'greetingCard':
      // Refined negative space, reduced density, clear elegance.
      return { ...profile, secondaryAnchorCount: [Math.max(1, profile.secondaryAnchorCount[0] - 1), Math.max(2, profile.secondaryAnchorCount[1] - 1)], negativeSpaceCorridor: 'dual' };
    default:
      return profile;
  }
}

/** Builds one Luxury Floral tile's cluster placements. Scatters bouquet-unit
 * primary anchors across the WHOLE tile the same way every other
 * cluster-based layout does (`clusterEngine.ts`'s `placeClusterAnchors`,
 * unchanged), then for each unit: generates ONE real bouquet cluster at the
 * primary (unmodified `generateCluster`, same mechanism/quality-gated retry
 * `buildClusterPlacements` already uses) and adds the topology-guaranteed
 * secondary/satellite anchors (Phase 4) as SINGLE additional motifs tagged
 * with the SAME `clusterId` as their own unit's primary -- never as
 * independent sub-clusters. An earlier version called `generateCluster`
 * once PER anchor (primary AND every secondary AND every satellite),
 * multiplying the tile's distinct `clusterId` count several-fold past the
 * original system's; `tile.ts`'s Section-10 node-budget thinning discards
 * ~90% of raw placements regardless, so far more distinct clusters means
 * far less thinning-survivor budget per cluster — measured to push
 * `fragmentedSilhouette` to 100% (worse than the 60% baseline this build
 * exists to improve). Keeping one `clusterId` per UNIT restores the
 * survivor-budget dynamics BUILD_023_AUDIT.md already tuned, while still
 * placing extra motifs at guaranteed-connected positions and applying
 * Hero Dominance scale (Phase 3) and scored connectors (Phase 5). */
export function buildLuxuryCompositionPlacements(opts: LuxuryCompositionOptions, rng: Rng): LuxuryCompositionResult {
  const { tileSize, motifSize, density, rotationJitter, scaleJitter, archetypes } = opts;
  const baseRadius = clusterBaseRadius(motifSize, density);
  const rawProfile = pickLuxuryCompositionProfile(rng);
  const profile = applyLuxuryProductAdjustment(rawProfile, opts.productTarget);

  // Same whole-tile anchor scatter every other premium bouquet layout uses
  // (2.6x spacing for premiumHero styles -- Build 023's own empirical
  // sweep found wider anchor spacing raises the thinning survivor-per-
  // cluster ratio, the real lever behind that build's fragmentation
  // improvement) -- this is what makes the pattern actually REPEAT several
  // bouquet units across the canvas instead of building one composition
  // for the whole tile.
  const unitPrimaries = placeClusterAnchors(tileSize, baseRadius * 2.6, rng, opts.zone);

  const angleFamily = createAngleFamily(rng);
  const allAnchors: LuxuryAnchor[] = [];
  const unitTopologyAnchors: LuxuryAnchor[][] = [];
  for (let unitIndex = 0; unitIndex < unitPrimaries.length; unitIndex++) {
    const unitAnchors = buildLuxuryUnit(unitPrimaries[unitIndex], unitIndex, profile, tileSize, baseRadius, rng);
    unitTopologyAnchors.push(unitAnchors);
    allAnchors.push(...unitAnchors);
  }
  const { anchors, diagnostics } = applyHeroDominance(allAnchors, profile, rng);

  const placements: Placement[] = [];
  let colorSeed = 0;
  const primaryClusterIds: number[] = [];

  let anchorCursor = 0;
  for (let unitIndex = 0; unitIndex < unitPrimaries.length; unitIndex++) {
    const unitAnchorCount = unitTopologyAnchors[unitIndex].length;
    const unitAnchors = anchors.slice(anchorCursor, anchorCursor + unitAnchorCount);
    anchorCursor += unitAnchorCount;
    const primary = unitAnchors.find((a) => a.massRole === 'primaryHero')!;
    primaryClusterIds.push(unitIndex);

    const archetype = archetypes[unitIndex % archetypes.length];
    let best: ReturnType<typeof generateCluster> | null = null;
    let bestCohesion = -1;
    for (let attempt = 0; attempt < 3; attempt++) {
      const candidate = generateCluster(archetype, rng, {
        baseRadius: baseRadius * primary.sizeMul,
        rotationJitter,
        scaleJitter,
        angleFamily,
      });
      const { cohesion } = evaluateCluster(candidate, baseRadius * primary.sizeMul);
      if (cohesion > bestCohesion) {
        best = candidate;
        bestCohesion = cohesion;
      }
      if (cohesion >= 70) break;
    }
    for (const member of best!) {
      const isHero = member.role === 'hero';
      placements.push({
        x: wrapCoord(primary.x + member.dx, tileSize),
        y: wrapCoord(primary.y + member.dy, tileSize),
        rotationDeg: member.rotationDeg,
        // `generateCluster`'s own hero member always renders near 1.0
        // scale regardless of `baseRadius` (baseRadius only spreads
        // member DISTANCES, never their own rendered size). The whole
        // point of Hero Dominance (Phase 3) is a bigger-rendering primary
        // hero, so only the HERO member is scaled by the unit's own
        // designated `primary.sizeMul` here -- the cluster's own internal
        // secondary/filler/accent members keep `generateCluster`'s
        // already-tuned ROLE_SCALE_RANGE untouched (that internal
        // hierarchy is not what Build 025 is meant to change).
        scale: Math.max(0.08, isHero ? member.scaleMul * primary.sizeMul : member.scaleMul),
        colorSeed: colorSeed++,
        role: member.role,
        clusterId: unitIndex,
        clusterAnchorX: primary.x,
        clusterAnchorY: primary.y,
        isPrimaryCluster: true,
      });
    }

    // The topology-guaranteed secondary/satellite/secondaryHero anchors
    // (Phase 4) are SINGLE additional motifs at their bounded-reach
    // positions, tagged with this SAME unit's `clusterId` -- extra
    // supporting flowers at real, connected positions, not independent
    // sub-clusters competing for their own thinning budget.
    for (const extra of unitAnchors) {
      if (extra.massRole === 'primaryHero') continue;
      const role = extra.massRole === 'secondaryHero' ? 'secondary' : extra.massRole === 'satellite' ? 'accent' : 'filler';
      placements.push({
        x: extra.x,
        y: extra.y,
        rotationDeg: rngRange(rng, 0, 360),
        scale: Math.max(0.08, extra.sizeMul),
        colorSeed: colorSeed++,
        role,
        clusterId: unitIndex,
        clusterAnchorX: primary.x,
        clusterAnchorY: primary.y,
      });
    }
  }

  // Phase 5: score every unit-primary pair within plausible bridging reach
  // (same convention `clusterEngine.ts`'s own `connectClusters` already
  // uses for the whole-tile anchor scatter) and keep only the ones that
  // pass both the per-pair and set-level checks, instead of a bare coin
  // flip.
  const primaryAnchors = anchors.filter((a) => a.massRole === 'primaryHero');
  const rawCandidates: ConnectorCandidate[] = [];
  for (let i = 0; i < primaryAnchors.length; i++) {
    for (let j = i + 1; j < primaryAnchors.length; j++) {
      let dx = primaryAnchors[j].x - primaryAnchors[i].x;
      let dy = primaryAnchors[j].y - primaryAnchors[i].y;
      if (Math.abs(dx) > tileSize / 2) dx -= Math.sign(dx) * tileSize;
      if (Math.abs(dy) > tileSize / 2) dy -= Math.sign(dy) * tileSize;
      const dist = Math.hypot(dx, dy);
      if (dist > baseRadius * 3.4) continue;
      rawCandidates.push(scoreConnectorCandidate(primaryAnchors[i], primaryAnchors[j], i, j, dist, baseRadius, tileSize));
    }
  }
  const connectorCandidates = filterConnectorCandidates(rawCandidates, primaryAnchors, baseRadius, tileSize);
  for (const c of connectorCandidates.filter((cc) => cc.accepted)) {
    const a = primaryAnchors[c.aIndex];
    const b = primaryAnchors[c.bIndex];
    const mx = wrapCoord((a.x + b.x) / 2, tileSize);
    const my = wrapCoord((a.y + b.y) / 2, tileSize);
    placements.push({
      x: mx,
      y: my,
      rotationDeg: rngRange(rng, 0, 360),
      scale: rngRange(rng, 0.14, 0.24),
      colorSeed: colorSeed++,
      role: 'accent',
    });
  }

  return { placements, profileId: profile.id, primaryClusterIds, heroDominance: diagnostics, connectorCandidates };
}
