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

const PRESETS = Object.keys(QUALITY_PRESET_WEIGHTS) as QualityPresetId[];

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
    const base = { ...defaultParams(), categoryId: 'botanical', layoutId: 'grid' as const, seed: 'metrics-density', hierarchy: undefined };
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

describe('applySoftPenalties', () => {
  const base = computeMetrics(buildTile({ ...defaultParams(), seed: 'soft-penalty-base' }));

  it('deducts nothing when no rule is triggered', () => {
    const healthy: CompositionMetrics = { ...base, quadrantBalance: 90, largestEmptyRegion: 90, heroSeparation: 90, adjacencyRepetition: 90, edgeDensity: 90, paletteContrast: 90 };
    const { score, penalties } = applySoftPenalties(healthy, 80);
    expect(penalties.length).toBe(0);
    expect(score).toBe(80);
  });

  it('deducts real points for each triggered rule, stacking multiple', () => {
    const bad: CompositionMetrics = { ...base, quadrantBalance: 10, largestEmptyRegion: 10, heroSeparation: 90, adjacencyRepetition: 90, edgeDensity: 90, paletteContrast: 90 };
    const { score, penalties } = applySoftPenalties(bad, 80);
    expect(penalties.length).toBe(2);
    const expectedDeduction = penalties.reduce((a, p) => a + p.points, 0);
    expect(score).toBe(80 - expectedDeduction);
  });

  it('never drops the score below 0', () => {
    const worst: CompositionMetrics = { ...base, quadrantBalance: 0, largestEmptyRegion: 0, heroSeparation: 0, adjacencyRepetition: 0, edgeDensity: 0, paletteContrast: 0 };
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
