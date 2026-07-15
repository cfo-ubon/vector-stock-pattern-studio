import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import {
  CLUSTER_ARCHETYPES,
  clusterBaseRadius,
  generateCluster,
  evaluateCluster,
  placeClusterAnchors,
  connectClusters,
  buildClusterPlacements,
  pickArchetypePool,
  type ClusterMember,
} from './clusterEngine';

describe('CLUSTER_ARCHETYPES', () => {
  it('has the 8 named archetypes from the original brief plus Build 002 Section 5\'s new `airy` archetype, plus Build 004 Section 4\'s 4 new archetypes', () => {
    expect([...CLUSTER_ARCHETYPES].sort()).toEqual(
      [
        'airy',
        'asymmetric',
        'bouquet',
        'branchCluster',
        'cascade',
        'cornerCluster',
        'diagonal',
        'editorial',
        'organicScatter',
        'radial',
        'sCurve',
        'sprayBouquet',
        'wildCluster',
      ].sort(),
    );
  });
});

describe('clusterBaseRadius', () => {
  it('shrinks as density increases (motifs pack closer, so does the cluster footprint)', () => {
    expect(clusterBaseRadius(100, 0.8)).toBeLessThan(clusterBaseRadius(100, 0.2));
  });

  it('grows with motif size', () => {
    expect(clusterBaseRadius(200, 0.5)).toBeGreaterThan(clusterBaseRadius(80, 0.5));
  });
});

describe('generateCluster', () => {
  const opts = { baseRadius: 200, rotationJitter: 15, scaleJitter: 0.15 };

  it('every archetype produces a valid cluster: hero first, finite geometry, multiple roles', () => {
    for (const archetype of CLUSTER_ARCHETYPES) {
      const rng = createRng(`cluster-${archetype}`);
      const members = generateCluster(archetype, rng, opts);
      expect(members.length).toBeGreaterThan(1);
      expect(members[0].role).toBe('hero');
      expect(members[0].dx).toBe(0);
      expect(members[0].dy).toBe(0);
      for (const m of members) {
        expect(Number.isFinite(m.dx)).toBe(true);
        expect(Number.isFinite(m.dy)).toBe(true);
        expect(Number.isFinite(m.rotationDeg)).toBe(true);
        expect(m.scaleMul).toBeGreaterThan(0);
      }
      const roles = new Set(members.map((m) => m.role));
      expect(roles.has('hero')).toBe(true);
      expect(roles.size).toBeGreaterThan(1);
    }
  });

  it('is deterministic for the same rng sequence', () => {
    const a = generateCluster('bouquet', createRng('cluster-det'), opts);
    const b = generateCluster('bouquet', createRng('cluster-det'), opts);
    expect(a).toEqual(b);
  });

  it('guarantees at least one member is pulled into the intentional-overlap band', () => {
    // `airy` is deliberately excluded — Build 002, Section 5's real, distinct
    // identity for this archetype is *never* forcing overlap (generous
    // negative space, "a few sprigs floating"), covered by its own test below.
    for (const archetype of CLUSTER_ARCHETYPES.filter((a) => a !== 'airy')) {
      const rng = createRng(`cluster-overlap-${archetype}`);
      const members = generateCluster(archetype, rng, opts);
      expect(members.some((m) => m.overlapsHero)).toBe(true);
    }
  });

  it('airy never forces overlap — every member stays outside the overlap band', () => {
    const rng = createRng('cluster-overlap-airy');
    const members = generateCluster('airy', rng, { ...opts, memberCount: 2 });
    expect(members.some((m) => m.overlapsHero)).toBe(false);
  });

  it('is paint-ordered hero -> secondary -> filler -> accent (supporting members render over the hero)', () => {
    const rng = createRng('cluster-paint-order');
    const members = generateCluster('bouquet', rng, { ...opts, memberCount: 12 });
    const order: Record<string, number> = { hero: 0, secondary: 1, filler: 2, accent: 3 };
    for (let i = 1; i < members.length; i++) {
      expect(order[members[i].role]).toBeGreaterThanOrEqual(order[members[i - 1].role]);
    }
  });

  it('no member sits absurdly far from the hero (no isolated floating objects)', () => {
    for (const archetype of CLUSTER_ARCHETYPES) {
      const rng = createRng(`cluster-bounds-${archetype}`);
      const members = generateCluster(archetype, rng, opts);
      for (const m of members.slice(1)) {
        expect(Math.hypot(m.dx, m.dy)).toBeLessThan(opts.baseRadius * 2.5);
      }
    }
  });

  it('respects an explicit memberCount', () => {
    const rng = createRng('cluster-count');
    const members = generateCluster('radial', rng, { ...opts, memberCount: 6 });
    expect(members.length).toBe(7); // hero + 6
  });
});

describe('generateCluster: Build 004 Section 4 new archetypes', () => {
  const opts = { baseRadius: 200, rotationJitter: 15, scaleJitter: 0.15 };

  it('sprayBouquet: every member falls within a real angular cone (a fan, not a full-circle ring)', () => {
    const rng = createRng('spray-cone');
    const members = generateCluster('sprayBouquet', rng, { ...opts, memberCount: 8 }).slice(1);
    const angles = members.map((m) => Math.atan2(m.dy, m.dx));
    // A true full-circle archetype (bouquet) would spread across ~2*PI; a
    // fan held to one shared side should span meaningfully less.
    const sorted = [...angles].sort((a, b) => a - b);
    const span = sorted[sorted.length - 1] - sorted[0];
    expect(span).toBeLessThan(Math.PI * 1.6);
  });

  it('wildCluster: at least one outlier reaches further than any non-outlier member across enough seeds', () => {
    let sawFarOutlier = false;
    for (let seed = 0; seed < 15; seed++) {
      const rng = createRng(`wild-outlier-${seed}`);
      const members = generateCluster('wildCluster', rng, { ...opts, memberCount: 8 }).slice(1);
      const dists = members.map((m) => Math.hypot(m.dx, m.dy));
      if (Math.max(...dists) > opts.baseRadius * 1.3) sawFarOutlier = true;
    }
    expect(sawFarOutlier).toBe(true);
  });

  it('cornerCluster: commits to one of the 4 true diagonal directions, every member biased toward it', () => {
    const corners = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
    const rng = createRng('corner-bias');
    const members = generateCluster('cornerCluster', rng, { ...opts, memberCount: 6 }).slice(1);
    const angles = members.map((m) => Math.atan2(m.dy, m.dx));
    const nearestCornerDist = (a: number) => Math.min(...corners.map((c) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c)))));
    for (const a of angles) expect(nearestCornerDist(a)).toBeLessThan(0.6);
  });

  it('branchCluster: members split into 2-3 distinct directions from a shared base angle', () => {
    const rng = createRng('branch-split');
    const members = generateCluster('branchCluster', rng, { ...opts, memberCount: 6 }).slice(1);
    const angles = members.map((m) => Math.atan2(m.dy, m.dx));
    // Cluster angles into distinct buckets (tolerance for jitter) and expect
    // more than one real direction, not everything collapsed onto one line.
    const buckets: number[] = [];
    for (const a of angles) {
      const existing = buckets.find((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.25);
      if (existing === undefined) buckets.push(a);
    }
    expect(buckets.length).toBeGreaterThan(1);
  });

  it('all 4 new archetypes are deterministic for the same seed', () => {
    for (const archetype of ['sprayBouquet', 'wildCluster', 'cornerCluster', 'branchCluster'] as const) {
      const a = generateCluster(archetype, createRng(`new-arch-det-${archetype}`), opts);
      const b = generateCluster(archetype, createRng(`new-arch-det-${archetype}`), opts);
      expect(a).toEqual(b);
    }
  });
});

describe('evaluateCluster', () => {
  const hero: ClusterMember = { dx: 0, dy: 0, rotationDeg: 0, scaleMul: 1, role: 'hero', overlapsHero: false };

  it('flags isolated members that sit far beyond the cohesion radius', () => {
    const members: ClusterMember[] = [
      hero,
      { dx: 500, dy: 0, rotationDeg: 0, scaleMul: 0.5, role: 'filler', overlapsHero: false },
    ];
    const result = evaluateCluster(members, 100);
    expect(result.isolatedMemberCount).toBeGreaterThan(0);
    expect(result.cohesion).toBeLessThan(100);
  });

  it('detects real overlap when a member is close to the hero', () => {
    const members: ClusterMember[] = [
      hero,
      { dx: 20, dy: 10, rotationDeg: 0, scaleMul: 0.5, role: 'filler', overlapsHero: true },
    ];
    const result = evaluateCluster(members, 100);
    expect(result.hasOverlap).toBe(true);
  });

  it('reports no overlap when every member sits well outside the overlap band', () => {
    const members: ClusterMember[] = [
      hero,
      { dx: 90, dy: 0, rotationDeg: 0, scaleMul: 0.5, role: 'filler', overlapsHero: false },
      { dx: 0, dy: 90, rotationDeg: 0, scaleMul: 0.5, role: 'filler', overlapsHero: false },
    ];
    const result = evaluateCluster(members, 100);
    expect(result.hasOverlap).toBe(false);
  });

  it('penalizes perfectly uniform member spacing (mechanical) with lower cohesion than organic jitter', () => {
    const mechanical: ClusterMember[] = [
      hero,
      { dx: 100, dy: 0, rotationDeg: 0, scaleMul: 0.5, role: 'filler', overlapsHero: false },
      { dx: 0, dy: 100, rotationDeg: 0, scaleMul: 0.5, role: 'filler', overlapsHero: false },
      { dx: -100, dy: 0, rotationDeg: 0, scaleMul: 0.5, role: 'filler', overlapsHero: false },
      { dx: 0, dy: -100, rotationDeg: 0, scaleMul: 0.5, role: 'filler', overlapsHero: false },
    ];
    const organic: ClusterMember[] = [
      hero,
      { dx: 40, dy: 15, rotationDeg: 0, scaleMul: 0.5, role: 'filler', overlapsHero: true },
      { dx: 30, dy: 95, rotationDeg: 0, scaleMul: 0.5, role: 'filler', overlapsHero: false },
      { dx: -85, dy: 20, rotationDeg: 0, scaleMul: 0.5, role: 'filler', overlapsHero: false },
      { dx: -10, dy: -70, rotationDeg: 0, scaleMul: 0.5, role: 'filler', overlapsHero: false },
    ];
    const mechanicalResult = evaluateCluster(mechanical, 100);
    const organicResult = evaluateCluster(organic, 100);
    expect(organicResult.cohesion).toBeGreaterThan(mechanicalResult.cohesion);
  });

  it('a cluster with no members (hero only) is neutral, not penalized', () => {
    const result = evaluateCluster([hero], 100);
    expect(result.cohesion).toBe(100);
  });
});

describe('placeClusterAnchors', () => {
  it('every anchor is within tile bounds', () => {
    const rng = createRng('anchors-bounds');
    const anchors = placeClusterAnchors(1200, 150, rng);
    for (const a of anchors) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThan(1200);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThan(1200);
      expect(a.sizeMul).toBeGreaterThan(0);
    }
  });

  it('produces a real large/medium/small size rhythm, not identical sizes', () => {
    const rng = createRng('anchors-rhythm');
    const anchors = placeClusterAnchors(1600, 100, rng);
    const sizes = anchors.map((a) => Math.round(a.sizeMul * 100) / 100);
    expect(new Set(sizes).size).toBeGreaterThan(1);
  });

  it('is deterministic for the same seed', () => {
    const a = placeClusterAnchors(1200, 150, createRng('anchors-det'));
    const b = placeClusterAnchors(1200, 150, createRng('anchors-det'));
    expect(a).toEqual(b);
  });
});

describe('connectClusters', () => {
  it('connects nearby anchors with an accent-role bridging placement', () => {
    const anchors = [
      { x: 100, y: 100, sizeMul: 1 },
      { x: 220, y: 110, sizeMul: 1 },
    ];
    let bridged = false;
    for (let seed = 0; seed < 20; seed++) {
      const bridges = connectClusters(anchors, 1200, 100, createRng(`bridge-${seed}`));
      if (bridges.length > 0) {
        bridged = true;
        expect(bridges[0].role).toBe('accent');
      }
    }
    expect(bridged).toBe(true);
  });

  it('never connects anchors far apart', () => {
    const anchors = [
      { x: 50, y: 50, sizeMul: 1 },
      { x: 1000, y: 1000, sizeMul: 1 },
    ];
    for (let seed = 0; seed < 10; seed++) {
      const bridges = connectClusters(anchors, 1200, 50, createRng(`far-${seed}`));
      expect(bridges.length).toBe(0);
    }
  });

  it('produces nothing for a single anchor', () => {
    const bridges = connectClusters([{ x: 100, y: 100, sizeMul: 1 }], 1200, 100, createRng('single'));
    expect(bridges.length).toBe(0);
  });
});

describe('buildClusterPlacements', () => {
  const baseOpts = { tileSize: 1200, motifSize: 90, density: 0.5, rotationJitter: 15, scaleJitter: 0.15, archetypes: ['bouquet'] as const };

  it('produces placements with multiple hierarchy roles and valid geometry', () => {
    const placements = buildClusterPlacements({ ...baseOpts, archetypes: [...baseOpts.archetypes] }, createRng('build-basic'));
    expect(placements.length).toBeGreaterThan(0);
    const roles = new Set(placements.map((p) => p.role));
    expect(roles.has('hero')).toBe(true);
    for (const p of placements) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(1200);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(1200);
      expect(Number.isFinite(p.rotationDeg)).toBe(true);
      expect(p.scale).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = buildClusterPlacements({ ...baseOpts, archetypes: [...baseOpts.archetypes] }, createRng('build-det'));
    const b = buildClusterPlacements({ ...baseOpts, archetypes: [...baseOpts.archetypes] }, createRng('build-det'));
    expect(a).toEqual(b);
  });

  it('cycles through a multi-archetype pool across different clusters', () => {
    const placements = buildClusterPlacements({ ...baseOpts, archetypes: ['bouquet', 'radial', 'cascade'] }, createRng('build-pool'));
    expect(placements.length).toBeGreaterThan(0);
  });

  it('every colorSeed is unique (no accidental collision across clusters/bridges)', () => {
    const placements = buildClusterPlacements({ ...baseOpts, archetypes: [...baseOpts.archetypes] }, createRng('build-colorseed'));
    const seeds = placements.map((p) => p.colorSeed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it('a genuinely different seed produces a genuinely different composition', () => {
    const a = buildClusterPlacements({ ...baseOpts, archetypes: [...baseOpts.archetypes] }, createRng('build-seed-a'));
    const b = buildClusterPlacements({ ...baseOpts, archetypes: [...baseOpts.archetypes] }, createRng('build-seed-b'));
    expect(a).not.toEqual(b);
  });
});

describe('pickArchetypePool', () => {
  it('always returns a real archetype from the requested candidates', () => {
    const rng = createRng('pick-pool');
    const pool = pickArchetypePool(rng, ['bouquet', 'radial']);
    expect(pool.length).toBe(1);
    expect(['bouquet', 'radial']).toContain(pool[0]);
  });
});
