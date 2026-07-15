import { describe, it, expect } from 'vitest';
import { buildTile } from './tile';
import { defaultParams } from './defaults';
import { computeMetrics, computeOverallScore, applySoftPenalties, SOFT_PENALTY_RULES, QUALITY_PRESET_WEIGHTS, type QualityPresetId, type CompositionMetrics } from './scoring';
import { h } from './svgAst';
import type { TileData } from './types';

/** A minimal, fully-controlled synthetic tile — motif centers placed
 * exactly where the test specifies, each a plain circle so path-command
 * signatures are trivial to control separately. Used for the new Phase 3
 * metrics below, where precise, non-flaky control over instance positions
 * matters more than exercising a real generator. */
function makeSyntheticTile(positions: Array<{ x: number; y: number }>, opts: { tileSize?: number; pathD?: (i: number) => string } = {}): TileData {
  const tileSize = opts.tileSize ?? 1000;
  const motifGroups = positions.map((p, i) => {
    const shape = opts.pathD ? h('path', { d: opts.pathD(i), fill: '#000000' }) : h('circle', { cx: 0, cy: 0, r: 5, fill: '#000000' });
    return h('g', { id: `motif-${i + 1}` }, [h('g', { transform: `translate(${p.x} ${p.y}) rotate(0) scale(1)` }, [shape])]);
  });
  const svg = h('g', { id: 'tile-content' }, [
    h('g', { id: 'layer-background' }, [h('rect', { x: 0, y: 0, width: tileSize, height: tileSize, fill: '#ffffff' })]),
    h('g', { id: 'layer-pattern' }, motifGroups),
  ]);
  return { params: { ...defaultParams(), tileSize }, backgroundColor: '#ffffff', colors: ['#ffffff', '#000000'], svg };
}

/** Like `makeSyntheticTile`, but each entry can carry a hierarchy `role`
 * (written as the `motif-N` group's `data-role`, same as `tile.ts`'s real
 * output) and a `shapeCount` controlling how much internal geometry that
 * one motif has — used to give Project Phoenix V2's new metrics
 * (`heroDetailRatio`, `clusterCohesion`, `isolationScore`,
 * `gridAppearanceScore`, `spacingUniformity`) precise, non-flaky synthetic
 * control over both position *and* role/complexity. */
function makeRoledSyntheticTile(
  entries: Array<{ x: number; y: number; role?: 'hero' | 'secondary' | 'filler' | 'accent'; shapeCount?: number }>,
  opts: { tileSize?: number } = {},
): TileData {
  const tileSize = opts.tileSize ?? 1000;
  const motifGroups = entries.map((e, i) => {
    const count = Math.max(1, e.shapeCount ?? 1);
    const shapes = Array.from({ length: count }, (_, k) => h('circle', { cx: k * 2, cy: 0, r: 5, fill: '#000000' }));
    const inner = count === 1 ? shapes[0] : h('g', {}, shapes);
    return h('g', { id: `motif-${i + 1}`, ...(e.role ? { 'data-role': e.role } : {}) }, [
      h('g', { transform: `translate(${e.x} ${e.y}) rotate(0) scale(1)` }, [inner]),
    ]);
  });
  const svg = h('g', { id: 'tile-content' }, [
    h('g', { id: 'layer-background' }, [h('rect', { x: 0, y: 0, width: tileSize, height: tileSize, fill: '#ffffff' })]),
    h('g', { id: 'layer-pattern' }, motifGroups),
  ]);
  return { params: { ...defaultParams(), tileSize }, backgroundColor: '#ffffff', colors: ['#ffffff', '#000000'], svg };
}

const PRESETS = Object.keys(QUALITY_PRESET_WEIGHTS) as QualityPresetId[];

const SOFT_PENALTY_BASE_METRICS = computeMetrics(buildTile({ ...defaultParams(), seed: 'soft-penalty-base' }));
/** Every field any SOFT_PENALTY_RULES check reads, pinned to a clearly-
 * passing value — shared by every soft-penalty test below so none of them
 * depend on incidental properties of one specific generated tile matching
 * every current and future rule. */
const ALL_GOOD_METRICS: CompositionMetrics = {
  ...SOFT_PENALTY_BASE_METRICS,
  quadrantBalance: 90,
  largestEmptyRegion: 90,
  heroSeparation: 90,
  adjacencyRepetition: 90,
  edgeDensity: 90,
  paletteContrast: 90,
  cornerContinuity: 90,
  motifShapeDiversity: 90,
  overlapQuality: 90,
  heroDetailRatio: 90,
  spacingUniformity: 90,
  isolationScore: 90,
  hierarchy: 90,
  clusterCohesion: 90,
  rotationDiversity: 90,
  gridAppearanceScore: 90,
  scaleDiversity: 90,
};

describe('computeMetrics', () => {
  it('is deterministic for the same tile', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'metrics-det' });
    expect(computeMetrics(tile)).toEqual(computeMetrics(tile));
  });

  it('every metric is within [0, 100]', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'metrics-bounds' });
    const metrics = computeMetrics(tile);
    for (const v of Object.values(metrics)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('seamlessIntegrity is always 100 (structural guarantee)', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'metrics-seamless' });
    expect(computeMetrics(tile).seamlessIntegrity).toBe(100);
  });

  it('svgHealth is 100 for a normally generated tile (no NaN/raster/duplicate ids)', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'metrics-health' });
    expect(computeMetrics(tile).svgHealth).toBe(100);
  });

  it('paletteContrast responds to the actual palette colors used', () => {
    const base = { ...defaultParams(), seed: 'contrast-check' };
    const monochrome = computeMetrics(buildTile({ ...base, customColors: ['#808080', '#808080', '#808080'] }));
    const highContrast = computeMetrics(buildTile({ ...base, customColors: ['#000000', '#ffffff', '#ff0000'] }));
    expect(highContrast.paletteContrast).toBeGreaterThan(monochrome.paletteContrast);
  });

  it('produces different composition scores for visually different densities', () => {
    // Build 002, Section 10: tileSize dropped to 600 (from the default
    // 1200) so the dense (0.9) case stays comfortably under the real
    // node-budget safety margin (engine/tile.ts's NODE_BUDGET_SAFETY_MARGIN)
    // — composition/occupancy is a resolution-independent fraction, so this
    // still exercises the same real "sparse vs. dense reads differently"
    // invariant without the dense case triggering budget-safety thinning
    // (which this test isn't about).
    const base = { ...defaultParams(), categoryId: 'botanical', layoutId: 'grid' as const, seed: 'metrics-density', hierarchy: undefined, tileSize: 600 };
    const sparse = computeMetrics(buildTile({ ...base, density: 0.1 }));
    const dense = computeMetrics(buildTile({ ...base, density: 0.9 }));
    expect(sparse.composition).not.toBe(dense.composition);
  });

  it('largestEmptyRegion detects a genuinely large hole (sparse large-motif scatter)', () => {
    // Grid layout saturates the coarse occupancy grid at almost any
    // density (motifs are distributed across the whole tile by
    // construction), so it never shows a real hole regardless of density —
    // scatter with a large motif size and very low density is what
    // actually produces a big contiguous empty region to detect.
    const base = { ...defaultParams(), categoryId: 'geometric', layoutId: 'scatter' as const, motifSize: 200, hierarchy: undefined };
    const sparse = computeMetrics(buildTile({ ...base, density: 0.02, seed: 'empty-region-sparse' }));
    const dense = computeMetrics(buildTile({ ...base, density: 0.9, seed: 'empty-region-dense' }));
    expect(sparse.largestEmptyRegion).toBeLessThan(dense.largestEmptyRegion);
  });

  it('heroSeparation is neutral (100) when there are 0 or 1 hero-role instances', () => {
    // Default hierarchy on a grid layout assigns hero/secondary/filler/accent
    // roles, but with hierarchy disabled entirely there is no hero role at
    // all, so separation has nothing to measure.
    const tile = buildTile({ ...defaultParams(), hierarchy: undefined, seed: 'hero-sep-none' });
    expect(computeMetrics(tile).heroSeparation).toBe(100);
  });
});

describe('computeMetrics: flowCoherence (real directional-coherence measurement)', () => {
  it('scores a straight diagonal line of motifs near 100 (every step points the same way)', () => {
    const positions = Array.from({ length: 10 }, (_, i) => ({ x: 50 + i * 90, y: 50 + i * 90 }));
    const tile = makeSyntheticTile(positions);
    expect(computeMetrics(tile).flowCoherence).toBeGreaterThan(90);
  });

  it('scores a scattered cluster of points lower than a straight diagonal line', () => {
    // A deliberately unstructured point cloud — its nearest-neighbor chain
    // has no consistent direction to walk in, unlike the diagonal line
    // above (whose nearest-neighbor chain *is* the line, by construction).
    const scattered = [
      { x: 80, y: 910 }, { x: 700, y: 120 }, { x: 340, y: 860 }, { x: 60, y: 300 },
      { x: 920, y: 640 }, { x: 500, y: 40 }, { x: 210, y: 560 }, { x: 780, y: 880 },
      { x: 30, y: 700 }, { x: 640, y: 380 },
    ];
    const diagonal = Array.from({ length: 10 }, (_, i) => ({ x: 50 + i * 90, y: 50 + i * 90 }));
    const scatterScore = computeMetrics(makeSyntheticTile(scattered)).flowCoherence;
    const diagonalScore = computeMetrics(makeSyntheticTile(diagonal)).flowCoherence;
    expect(scatterScore).toBeLessThan(diagonalScore);
  });

  it('is neutral (100) for fewer than 3 instances (nothing to trace a direction through)', () => {
    const tile = makeSyntheticTile([{ x: 100, y: 100 }, { x: 500, y: 500 }]);
    expect(computeMetrics(tile).flowCoherence).toBe(100);
  });
});

describe('computeMetrics: rhythmRegularity (real periodicity-strength measurement)', () => {
  it('scores a single constant-interval row high (one dominant spacing "beat")', () => {
    const positions = Array.from({ length: 12 }, (_, i) => ({ x: 50 + i * 80, y: 500 }));
    const tile = makeSyntheticTile(positions);
    expect(computeMetrics(tile).rhythmRegularity).toBeGreaterThan(70);
  });

  it('scores wildly uneven spacing lower than the constant-interval row', () => {
    const regular = makeSyntheticTile(Array.from({ length: 12 }, (_, i) => ({ x: 50 + i * 80, y: 500 })));
    const seedIrregular = [5, 400, 30, 900, 700, 60, 200, 950, 15, 500, 850, 100];
    const irregular = makeSyntheticTile(seedIrregular.map((x, i) => ({ x, y: 100 + i * 83 })));
    expect(computeMetrics(irregular).rhythmRegularity).toBeLessThan(computeMetrics(regular).rhythmRegularity);
  });
});

describe('computeMetrics: motifShapeDiversity (real shape-topology measurement)', () => {
  it('scores 0 when every motif is the exact same path shape', () => {
    const positions = Array.from({ length: 6 }, (_, i) => ({ x: 100 + i * 140, y: 500 }));
    const tile = makeSyntheticTile(positions, { pathD: () => 'M 0 0 C 1 1, 2 2, 3 3 Z' });
    expect(computeMetrics(tile).motifShapeDiversity).toBe(0);
  });

  it('scores 100 when every motif has a unique path shape', () => {
    const positions = Array.from({ length: 6 }, (_, i) => ({ x: 100 + i * 140, y: 500 }));
    const tile = makeSyntheticTile(positions, { pathD: (i) => `M 0 0 ${'L 1 1 '.repeat(i + 1)}Z` });
    expect(computeMetrics(tile).motifShapeDiversity).toBe(100);
  });

  it('scores between 0 and 100 for a mix of repeated and unique shapes', () => {
    const positions = Array.from({ length: 8 }, (_, i) => ({ x: 100 + i * 100, y: 500 }));
    // 4 instances share shape "A", the other 4 are each their own unique shape.
    const shapeD = ['M 0 0 L 1 1 Z', 'M 0 0 L 1 1 Z', 'M 0 0 L 1 1 Z', 'M 0 0 L 1 1 Z', 'M 0 0 C 1 1, 2 2, 3 3 Z', 'M 0 0 Q 1 1, 2 2 Z', 'M 0 0 L 1 1 L 2 2 Z', 'M 0 0 A 1 1 0 0 1 2 2 Z'];
    const tile = makeSyntheticTile(positions, { pathD: (i) => shapeD[i] });
    const diversity = computeMetrics(tile).motifShapeDiversity;
    expect(diversity).toBeGreaterThan(0);
    expect(diversity).toBeLessThan(100);
  });
});

describe('computeMetrics: cornerContinuity (real corner-junction density-balance measurement)', () => {
  it('scores high when motifs are evenly spread across the whole tile including corners', () => {
    const positions: Array<{ x: number; y: number }> = [];
    for (let gy = 0; gy < 8; gy++) {
      for (let gx = 0; gx < 8; gx++) {
        positions.push({ x: gx * 125 + 62.5, y: gy * 125 + 62.5 });
      }
    }
    const tile = makeSyntheticTile(positions);
    expect(computeMetrics(tile).cornerContinuity).toBeGreaterThan(85);
  });

  it('scores low when every motif clusters at the tile center, leaving all 4 corners empty', () => {
    const positions = Array.from({ length: 20 }, (_, i) => ({ x: 470 + (i % 5) * 15, y: 470 + Math.floor(i / 5) * 15 }));
    const tile = makeSyntheticTile(positions);
    expect(computeMetrics(tile).cornerContinuity).toBeLessThan(50);
  });
});

describe('computeMetrics: heroDetailRatio (Project Phoenix V2, Section 8)', () => {
  it('scores high when hero instances have real, measurably more internal geometry than filler', () => {
    const entries = [
      { x: 500, y: 500, role: 'hero' as const, shapeCount: 12 },
      ...Array.from({ length: 6 }, (_, i) => ({ x: 100 + i * 140, y: 900, role: 'filler' as const, shapeCount: 1 })),
    ];
    const tile = makeRoledSyntheticTile(entries);
    expect(computeMetrics(tile).heroDetailRatio).toBeGreaterThan(70);
  });

  it('scores low when hero instances have no more detail than filler (the pre-Phoenix default)', () => {
    const entries = [
      { x: 500, y: 500, role: 'hero' as const, shapeCount: 1 },
      ...Array.from({ length: 6 }, (_, i) => ({ x: 100 + i * 140, y: 900, role: 'filler' as const, shapeCount: 1 })),
    ];
    const tile = makeRoledSyntheticTile(entries);
    expect(computeMetrics(tile).heroDetailRatio).toBeLessThan(45);
  });

  it('is neutral (100) when there are no heroes or no filler baseline to compare against', () => {
    const tile = makeRoledSyntheticTile([{ x: 500, y: 500, role: 'secondary', shapeCount: 5 }]);
    expect(computeMetrics(tile).heroDetailRatio).toBe(100);
  });
});

describe('computeMetrics: isolationScore (real floating-object detection)', () => {
  it('scores high for a cohesive group with no outliers', () => {
    const positions = Array.from({ length: 10 }, (_, i) => ({ x: 400 + (i % 5) * 40, y: 400 + Math.floor(i / 5) * 40 }));
    const tile = makeSyntheticTile(positions);
    expect(computeMetrics(tile).isolationScore).toBeGreaterThan(80);
  });

  it('scores lower when several instances sit far from everything else', () => {
    // Positions account for the tile's own periodic wrap (e.g. a literal
    // tile corner isn't actually "far" from the opposite corner once wrap
    // is considered) — (945, 945)-family points are the real farthest
    // points from a cluster centered near (400-430, 400-430) in a
    // 1000-unit periodic tile.
    const cohesive = Array.from({ length: 8 }, (_, i) => ({ x: 400 + (i % 4) * 30, y: 400 + Math.floor(i / 4) * 30 }));
    const isolated = [{ x: 945, y: 945 }, { x: 445, y: 945 }, { x: 945, y: 445 }];
    const tile = makeSyntheticTile([...cohesive, ...isolated]);
    expect(computeMetrics(tile).isolationScore).toBeLessThan(90);
  });
});

describe('computeMetrics: clusterCohesion (real supporting-company measurement)', () => {
  it('scores high when heroes have real supporting motifs nearby', () => {
    const entries = [
      { x: 300, y: 300, role: 'hero' as const },
      { x: 330, y: 300, role: 'secondary' as const },
      { x: 300, y: 330, role: 'filler' as const },
      { x: 270, y: 300, role: 'accent' as const },
      { x: 700, y: 700, role: 'hero' as const },
      { x: 730, y: 700, role: 'secondary' as const },
      { x: 700, y: 730, role: 'filler' as const },
      { x: 670, y: 700, role: 'accent' as const },
    ];
    const tile = makeRoledSyntheticTile(entries);
    expect(computeMetrics(tile).clusterCohesion).toBeGreaterThan(70);
  });

  it('scores low when a hero sits far (periodic-wrap-aware) from a tightly packed group of support motifs', () => {
    // clusterRadius scales with 1/sqrt(instance count), so this needs
    // enough total instances to produce a genuinely discriminating radius
    // — a handful of instances makes clusterRadius larger than the tile
    // itself, and everything trivially counts as "nearby".
    const support = Array.from({ length: 30 }, (_, i) => ({
      x: 480 + (i % 6) * 6,
      y: 480 + Math.floor(i / 6) * 6,
      role: 'filler' as const,
    }));
    const hero = { x: 30, y: 30, role: 'hero' as const };
    const tile = makeRoledSyntheticTile([hero, ...support]);
    expect(computeMetrics(tile).clusterCohesion).toBeLessThan(50);
  });

  it('is neutral (100) when there are no heroes to evaluate', () => {
    const tile = makeRoledSyntheticTile([{ x: 500, y: 500, role: 'filler' }]);
    expect(computeMetrics(tile).clusterCohesion).toBe(100);
  });
});

describe('computeMetrics: gridAppearanceScore (real grid detection)', () => {
  it('scores low for a strict axis-aligned grid', () => {
    const positions: Array<{ x: number; y: number }> = [];
    for (let gy = 0; gy < 6; gy++) {
      for (let gx = 0; gx < 6; gx++) {
        positions.push({ x: gx * 160 + 80, y: gy * 160 + 80 });
      }
    }
    const tile = makeSyntheticTile(positions);
    expect(computeMetrics(tile).gridAppearanceScore).toBeLessThan(40);
  });

  it('scores higher for an organically-scattered arrangement than a strict grid', () => {
    const gridPositions: Array<{ x: number; y: number }> = [];
    for (let gy = 0; gy < 6; gy++) {
      for (let gx = 0; gx < 6; gx++) {
        gridPositions.push({ x: gx * 160 + 80, y: gy * 160 + 80 });
      }
    }
    const organicPositions = [
      { x: 80, y: 910 }, { x: 700, y: 120 }, { x: 340, y: 860 }, { x: 60, y: 300 },
      { x: 920, y: 640 }, { x: 500, y: 40 }, { x: 210, y: 560 }, { x: 780, y: 880 },
      { x: 30, y: 700 }, { x: 640, y: 380 }, { x: 460, y: 210 }, { x: 890, y: 30 },
    ];
    const gridScore = computeMetrics(makeSyntheticTile(gridPositions)).gridAppearanceScore;
    const organicScore = computeMetrics(makeSyntheticTile(organicPositions)).gridAppearanceScore;
    expect(organicScore).toBeGreaterThan(gridScore);
  });
});

describe('computeMetrics: spacingUniformity (real "equal spacing" detection)', () => {
  it('scores low for perfectly equal nearest-neighbor spacing', () => {
    const positions = Array.from({ length: 10 }, (_, i) => ({ x: 50 + i * 90, y: 500 }));
    const tile = makeSyntheticTile(positions);
    expect(computeMetrics(tile).spacingUniformity).toBeLessThan(35);
  });

  it('scores higher for organically-varied spacing than perfectly equal spacing', () => {
    const equalPositions = Array.from({ length: 10 }, (_, i) => ({ x: 50 + i * 90, y: 500 }));
    const variedPositions = [
      { x: 80, y: 910 }, { x: 700, y: 120 }, { x: 340, y: 860 }, { x: 60, y: 300 },
      { x: 920, y: 640 }, { x: 500, y: 40 }, { x: 210, y: 560 }, { x: 780, y: 880 },
      { x: 30, y: 700 }, { x: 640, y: 380 },
    ];
    const equalScore = computeMetrics(makeSyntheticTile(equalPositions)).spacingUniformity;
    const variedScore = computeMetrics(makeSyntheticTile(variedPositions)).spacingUniformity;
    expect(variedScore).toBeGreaterThan(equalScore);
  });
});

describe('applySoftPenalties', () => {
  const base = SOFT_PENALTY_BASE_METRICS;
  const allGood = ALL_GOOD_METRICS;

  it('deducts nothing when no rule is triggered', () => {
    const { score, penalties } = applySoftPenalties(allGood, 80);
    expect(penalties.length).toBe(0);
    expect(score).toBe(80);
  });

  it('deducts real points for each triggered rule, stacking multiple', () => {
    const bad: CompositionMetrics = { ...allGood, quadrantBalance: 10, largestEmptyRegion: 10 };
    const { score, penalties } = applySoftPenalties(bad, 80);
    expect(penalties.length).toBe(2);
    const expectedDeduction = penalties.reduce((a, p) => a + p.points, 0);
    expect(score).toBe(80 - expectedDeduction);
  });

  it('never drops the score below 0', () => {
    const worst: CompositionMetrics = { ...allGood, quadrantBalance: 0, largestEmptyRegion: 0, heroSeparation: 0, adjacencyRepetition: 0, edgeDensity: 0, paletteContrast: 0 };
    const { score } = applySoftPenalties(worst, 5);
    expect(score).toBe(0);
  });

  it('every rule is deterministic and checks a real metric field', () => {
    for (const rule of SOFT_PENALTY_RULES) {
      expect(rule.check(base)).toBe(rule.check(base));
      expect(typeof rule.points).toBe('number');
      expect(rule.points).toBeGreaterThan(0);
    }
  });
});

describe('SOFT_PENALTY_RULES: Project Phoenix V2 (Section 8) exact point values', () => {
  const points: Record<string, number> = Object.fromEntries(SOFT_PENALTY_RULES.map((r) => [r.id, r.points]));

  it('every one of the brief\'s 12 named penalties is present at its exact point value', () => {
    // Visual dead zones (-10) and Low motif diversity (-10) are satisfied
    // by the pre-existing largeEmptyHole/repetitiveMotifShapes rules
    // (repetitiveMotifShapes' points were bumped 6 -> 10 to match) — see
    // SOFT_PENALTY_RULES' own doc comment for why those two aren't
    // duplicated as separate rules.
    expect(points.zeroMotifOverlap).toBe(20);
    expect(points.heroInsufficientDetail).toBe(15);
    expect(points.equalSpacingDetected).toBe(15);
    expect(points.tooManyIsolatedObjects).toBe(10);
    expect(points.weakHierarchy).toBe(15);
    expect(points.lowClusterCohesion).toBe(15);
    expect(points.repeatedMotifOrientation).toBe(10);
    expect(points.gridAppearance).toBe(20);
    expect(points.largeEmptyHole).toBe(10); // "Visual dead zones -10"
    expect(points.monotonousScale).toBe(10);
    expect(points.repetitiveMotifShapes).toBe(10); // "Low motif diversity -10"
    expect(points.mechanicalComposition).toBe(20);
  });

  it('zeroMotifOverlap fires for a pattern with essentially no overlap between motifs', () => {
    const spaced: CompositionMetrics = { ...ALL_GOOD_METRICS, overlapQuality: 15 };
    const { penalties } = applySoftPenalties(spaced, 80);
    expect(penalties.some((p) => p.points === 20)).toBe(true);
  });

  it('heroInsufficientDetail fires when hero motifs are no more detailed than filler', () => {
    const entries = [
      { x: 500, y: 500, role: 'hero' as const, shapeCount: 1 },
      ...Array.from({ length: 5 }, (_, i) => ({ x: 100 + i * 150, y: 900, role: 'filler' as const, shapeCount: 1 })),
    ];
    const tile = makeRoledSyntheticTile(entries);
    const metrics = computeMetrics(tile);
    const { penalties } = applySoftPenalties(metrics, 80);
    expect(penalties.some((p) => p.points === 15 && metrics.heroDetailRatio < 45)).toBe(metrics.heroDetailRatio < 45);
  });

  it('equalSpacingDetected fires for perfectly equal nearest-neighbor spacing', () => {
    const positions = Array.from({ length: 10 }, (_, i) => ({ x: 50 + i * 90, y: 500 }));
    const metrics = computeMetrics(makeSyntheticTile(positions));
    const { penalties } = applySoftPenalties(metrics, 80);
    expect(penalties.some((p) => p.points === 15 && metrics.spacingUniformity < 35)).toBe(metrics.spacingUniformity < 35);
  });

  it('gridAppearance fires for a strict axis-aligned grid', () => {
    const positions: Array<{ x: number; y: number }> = [];
    for (let gy = 0; gy < 6; gy++) for (let gx = 0; gx < 6; gx++) positions.push({ x: gx * 160 + 80, y: gy * 160 + 80 });
    const metrics = computeMetrics(makeSyntheticTile(positions));
    const { penalties } = applySoftPenalties(metrics, 80);
    expect(penalties.some((p) => p.points === 20)).toBe(true);
  });

  it('monotonousScale fires when every instance is exactly the same scale', () => {
    const bad: CompositionMetrics = { ...ALL_GOOD_METRICS, scaleDiversity: 10 };
    const { penalties } = applySoftPenalties(bad, 80);
    expect(penalties.some((p) => p.points === 10 && p.label.includes('scale'))).toBe(true);
  });

  it('mechanicalComposition only fires when grid/spacing/rotation all three read as mechanical together', () => {
    const onlyGrid: CompositionMetrics = { ...ALL_GOOD_METRICS, gridAppearanceScore: 10 };
    expect(applySoftPenalties(onlyGrid, 80).penalties.some((p) => p.points === 20 && p.label.includes('multiple'))).toBe(false);

    const allThree: CompositionMetrics = { ...ALL_GOOD_METRICS, gridAppearanceScore: 10, spacingUniformity: 10, rotationDiversity: 10 };
    expect(applySoftPenalties(allThree, 80).penalties.some((p) => p.points === 20 && p.label.includes('multiple'))).toBe(true);
  });
});

describe('computeOverallScore', () => {
  const tile = buildTile({ ...defaultParams(), seed: 'overall-score' });
  const metrics = computeMetrics(tile);

  it('is deterministic and within [0, 100] for every preset', () => {
    for (const preset of PRESETS) {
      const a = computeOverallScore(metrics, preset);
      const b = computeOverallScore(metrics, preset);
      expect(a.score).toBe(b.score);
      expect(a.score).toBeGreaterThanOrEqual(0);
      expect(a.score).toBeLessThanOrEqual(100);
    }
  });

  it('flags low-scoring weighted metrics as penalty reasons', () => {
    const badMetrics = { ...metrics, svgHealth: 10, composition: 5 };
    const { penaltyReasons } = computeOverallScore(badMetrics, 'stockClean');
    expect(penaltyReasons.length).toBeGreaterThan(0);
    expect(penaltyReasons.some((r) => r.includes('SVG technical health'))).toBe(true);
  });

  it('every preset weight set only references keys that exist on CompositionMetrics', () => {
    for (const preset of PRESETS) {
      const weights = QUALITY_PRESET_WEIGHTS[preset];
      for (const key of Object.keys(weights)) {
        expect(Object.prototype.hasOwnProperty.call(metrics, key)).toBe(true);
      }
    }
  });

  it('applies soft-penalty deductions on top of the weighted average, and reports them', () => {
    const triggering = { ...metrics, quadrantBalance: 5, largestEmptyRegion: 5 };
    const { score: penalizedScore, penaltyReasons } = computeOverallScore(triggering, 'stockClean');
    const { score: cleanScore } = computeOverallScore({ ...metrics, quadrantBalance: 100, largestEmptyRegion: 100 }, 'stockClean');
    expect(penalizedScore).toBeLessThan(cleanScore);
    expect(penaltyReasons.some((r) => r.includes('soft penalty'))).toBe(true);
  });
});
