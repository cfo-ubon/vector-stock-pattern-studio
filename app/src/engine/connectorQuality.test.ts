import { describe, it, expect } from 'vitest';
import { scoreConnectorCandidate, filterConnectorCandidates } from './connectorQuality';
import type { LuxuryAnchor } from './topologyPlacement';

const tileSize = 1200;
const baseRadius = 100;

function anchor(x: number, y: number, massRole: LuxuryAnchor['massRole'], sizeMul = 1): LuxuryAnchor {
  return { x, y, sizeMul, massRole, unitIndex: 0 };
}

describe('scoreConnectorCandidate', () => {
  it('rejects a near-overlap (too-short) pair', () => {
    const a = anchor(0, 0, 'primaryHero');
    const b = anchor(10, 0, 'secondary');
    const c = scoreConnectorCandidate(a, b, 0, 1, 10, baseRadius, tileSize);
    expect(c.accepted).toBe(false);
  });

  it('penalizes (but does not necessarily reject on its own) a pair far beyond plausible botanical reach', () => {
    const a = anchor(0, 0, 'primaryHero');
    const b = anchor(500, 0, 'secondary');
    const c = scoreConnectorCandidate(a, b, 0, 1, 500, baseRadius, tileSize);
    expect(c.score).toBeLessThan(100);
    expect(c.reasons.some((r) => r.includes('too long for plausible botanical reach'))).toBe(true);
    expect(c.type).toBe('eucalyptusStem');
  });

  it('accepts a reasonable mid-reach pair and classifies a real connector type', () => {
    const a = anchor(0, 0, 'primaryHero');
    const b = anchor(120, 0, 'secondary');
    const c = scoreConnectorCandidate(a, b, 0, 1, 120, baseRadius, tileSize);
    expect(c.accepted).toBe(true);
    expect(['curvedFoliageBranch', 'eucalyptusStem', 'oliveBranch', 'berryStem', 'smallFlowerBranch', 'foregroundBridge']).toContain(c.type);
  });

  it('classifies a hero-to-hero bridge as foregroundBridge', () => {
    const a = anchor(0, 0, 'primaryHero');
    const b = anchor(150, 0, 'secondaryHero');
    const c = scoreConnectorCandidate(a, b, 0, 1, 150, baseRadius, tileSize);
    expect(c.type).toBe('foregroundBridge');
  });
});

describe('filterConnectorCandidates', () => {
  it('rejects a connector whose midpoint cuts through the primary hero footprint', () => {
    const anchors: LuxuryAnchor[] = [
      anchor(0, 0, 'primaryHero', 2), // big hero footprint at origin
      anchor(-140, 0, 'secondary'),
      anchor(140, 0, 'secondary'),
    ];
    const raw = [
      scoreConnectorCandidate(anchors[1], anchors[2], 1, 2, 280, baseRadius, tileSize),
    ];
    const filtered = filterConnectorCandidates(raw, anchors, baseRadius, tileSize);
    expect(filtered[0].accepted).toBe(false);
    expect(filtered[0].reasons.some((r) => r.includes('focal obstruction'))).toBe(true);
  });

  it('caps accepted connectors per anchor (clutter risk)', () => {
    const anchors: LuxuryAnchor[] = [
      anchor(0, 0, 'primaryHero'),
      anchor(120, 0, 'secondary'),
      anchor(0, 120, 'secondary'),
      anchor(-120, 0, 'secondary'),
      anchor(0, -120, 'secondary'),
    ];
    const raw = [
      scoreConnectorCandidate(anchors[0], anchors[1], 0, 1, 120, baseRadius, tileSize),
      scoreConnectorCandidate(anchors[0], anchors[2], 0, 2, 120, baseRadius, tileSize),
      scoreConnectorCandidate(anchors[0], anchors[3], 0, 3, 120, baseRadius, tileSize),
      scoreConnectorCandidate(anchors[0], anchors[4], 0, 4, 120, baseRadius, tileSize),
    ];
    const filtered = filterConnectorCandidates(raw, anchors, baseRadius, tileSize);
    const acceptedTouchingHero = filtered.filter((c) => c.accepted && (c.aIndex === 0 || c.bIndex === 0));
    expect(acceptedTouchingHero.length).toBeLessThanOrEqual(2);
  });
});
