import type { LuxuryAnchor } from './topologyPlacement';

// Build 025, Phase 5 (Connector Quality Engine). `clusterEngine.ts`'s
// existing `connectClusters` accepts a bridge between any sufficiently
// close anchor pair with a bare `rng() > 0.35` coin flip -- no botanical or
// visual reasoning at all, so it accepts bare tangent-length connectors as
// readily as genuinely useful ones. This module replaces that coin flip
// with a real, inspectable score built from the pair's own geometry
// (distance, mass role, tile scale), so a connector is accepted only when
// it plausibly reads as a real branch/stem, not decoration for its own
// sake.

export type ConnectorType =
  | 'curvedFoliageBranch'
  | 'eucalyptusStem'
  | 'oliveBranch'
  | 'berryStem'
  | 'smallFlowerBranch'
  | 'foregroundBridge'
  | 'rearBridge';

export interface ConnectorCandidate {
  aIndex: number;
  bIndex: number;
  type: ConnectorType;
  /** 0-100. Built from checkable geometric criteria (see below) — never a
   * flat coin flip. */
  score: number;
  accepted: boolean;
  reasons: string[];
}

const ACCEPT_THRESHOLD = 55;

/** Picks the connector archetype a pair's own distance/role most plausibly
 * reads as. `rearBridge` is reserved for a bridge whose midpoint the
 * Depth-Layering Engine (`depthLayers.ts`, Build 024) would place on a
 * background plane — this module operates on flat, pre-depth-reorder
 * placements, so it never emits `rearBridge` itself; `foregroundBridge`
 * covers every hero-to-hero connection here, honestly disclosed rather
 * than fabricating a foreground/rear distinction this geometry model
 * doesn't actually have. */
function classifyConnectorType(a: LuxuryAnchor, b: LuxuryAnchor, dist: number, baseRadius: number): ConnectorType {
  const bothHero = (a.massRole === 'primaryHero' || a.massRole === 'secondaryHero') && (b.massRole === 'primaryHero' || b.massRole === 'secondaryHero');
  if (bothHero) return 'foregroundBridge';
  if (a.massRole === 'satellite' || b.massRole === 'satellite') return 'smallFlowerBranch';
  if (dist > baseRadius * 2.2) return 'eucalyptusStem';
  if (dist > baseRadius * 1.4) return 'curvedFoliageBranch';
  if (dist > baseRadius * 0.9) return 'oliveBranch';
  return 'berryStem';
}

/** Scores one candidate anchor pair against 5 intrinsic-geometry criteria
 * (botanical plausibility of reach, overlap/tangent avoidance, thumbnail
 * visibility, and — via `classifyConnectorType`'s own role check — spine
 * alignment for hero-to-hero bridges specifically). The remaining 3 named
 * criteria (clutter risk, bare-stem risk, focal obstruction risk) depend on
 * the FULL candidate set and hero footprint, not one isolated pair, so
 * `filterConnectorCandidates` below applies those across the whole
 * accepted set after this per-pair score. */
export function scoreConnectorCandidate(a: LuxuryAnchor, b: LuxuryAnchor, aIndex: number, bIndex: number, dist: number, baseRadius: number, tileSize: number): ConnectorCandidate {
  const reasons: string[] = [];
  let score = 100;

  const reachLo = baseRadius * 0.55;
  const reachHi = baseRadius * 3.4;
  if (dist < reachLo) {
    score -= 25;
    reasons.push('too short for plausible botanical reach (near-overlap)');
  }
  if (dist > reachHi) {
    score -= 35;
    reasons.push('too long for plausible botanical reach');
  }
  if (dist < baseRadius * 0.35) {
    score -= 20;
    reasons.push('creates a tangent rather than a genuine connection');
  }
  if (dist < tileSize * 0.015) {
    score -= 15;
    reasons.push('too short to read at 128px thumbnail scale');
  }
  // Spine alignment proxy: a bridge between the two named hero masses is
  // the tile's own spine and always earns real credit for existing at all
  // (Phase 7's wrap-cohesion module separately checks whether it actually
  // reads as connected across the tile seam).
  const bothHero = (a.massRole === 'primaryHero' || a.massRole === 'secondaryHero') && (b.massRole === 'primaryHero' || b.massRole === 'secondaryHero');
  if (bothHero) score += 10;

  score = Math.max(0, Math.min(100, score));
  return { aIndex, bIndex, type: classifyConnectorType(a, b, dist, baseRadius), score, accepted: score >= ACCEPT_THRESHOLD, reasons };
}

/** Applies the 3 set-level criteria the per-pair score above can't see on
 * its own: clutter risk (too many accepted connectors sharing one anchor
 * reads as tangled, not composed), bare-stem risk (a connector with no
 * anchor anywhere near its own midpoint reads as a line drawn across empty
 * space, not a branch), and focal obstruction risk (a non-hero connector
 * whose midpoint cuts through the primary hero's own footprint). Mutates
 * `accepted`/`reasons` in place on the array this function returns (a
 * fresh copy, the input array itself is never mutated). */
export function filterConnectorCandidates(candidates: ConnectorCandidate[], anchors: LuxuryAnchor[], baseRadius: number, tileSize: number): ConnectorCandidate[] {
  const MAX_PER_ANCHOR = 2;
  const perAnchorCount = new Map<number, number>();
  const wrapMid = (a: number, b: number, tileSize: number): number => {
    let d = b - a;
    if (d > tileSize / 2) d -= tileSize;
    if (d < -tileSize / 2) d += tileSize;
    return (((a + d / 2) % tileSize) + tileSize) % tileSize;
  };

  return candidates
    .filter((c) => c.accepted)
    .sort((a, b) => b.score - a.score)
    .map((c) => {
      const reasons = [...c.reasons];
      let accepted = true;

      const aCount = perAnchorCount.get(c.aIndex) ?? 0;
      const bCount = perAnchorCount.get(c.bIndex) ?? 0;
      if (aCount >= MAX_PER_ANCHOR || bCount >= MAX_PER_ANCHOR) {
        accepted = false;
        reasons.push('clutter risk: this anchor already has enough accepted connectors');
      }

      if (accepted) {
        const a = anchors[c.aIndex];
        const b = anchors[c.bIndex];
        const mx = wrapMid(a.x, b.x, tileSize);
        const my = wrapMid(a.y, b.y, tileSize);
        const nearMidpoint = anchors.some((other, i) => i !== c.aIndex && i !== c.bIndex && Math.hypot(other.x - mx, other.y - my) < baseRadius * 1.1);
        if (!nearMidpoint && !(a.massRole === 'primaryHero' || a.massRole === 'secondaryHero' || b.massRole === 'primaryHero' || b.massRole === 'secondaryHero')) {
          accepted = false;
          reasons.push('bare-stem risk: no supporting anchor near this connector\'s midpoint');
        }

        const primary = anchors.find((x) => x.massRole === 'primaryHero');
        if (accepted && primary && a.massRole !== 'primaryHero' && b.massRole !== 'primaryHero') {
          const heroFootprint = baseRadius * primary.sizeMul * 0.9;
          if (Math.hypot(mx - primary.x, my - primary.y) < heroFootprint) {
            accepted = false;
            reasons.push('focal obstruction risk: connector cuts through the primary hero\'s own footprint');
          }
        }
      }

      if (accepted) {
        perAnchorCount.set(c.aIndex, aCount + 1);
        perAnchorCount.set(c.bIndex, bCount + 1);
      }

      return { ...c, accepted, reasons };
    });
}
