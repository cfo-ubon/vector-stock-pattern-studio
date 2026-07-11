import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { serialize } from './svgAst';
import { defaultParams } from './defaults';
import { generateMotifSet } from './motifFactory';
import { buildBorderStrip, buildCornerUnit, type BorderEdge, type CornerId } from './borderCornerAssets';

const motifs = generateMotifSet(defaultParams(), { count: 4, role: 'accent', baseSeed: 'border-corner-fixture' });

describe('buildBorderStrip', () => {
  it('top/bottom edges are wide-and-thin; left/right edges are tall-and-thin', () => {
    const top = buildBorderStrip({ edge: 'top', length: 1200, band: 150, motifs, rng: createRng('bs-1'), backgroundColor: '#fff', count: 10 });
    expect(top.width).toBe(1200);
    expect(top.height).toBe(150);
    const left = buildBorderStrip({ edge: 'left', length: 1200, band: 150, motifs, rng: createRng('bs-2'), backgroundColor: '#fff', count: 10 });
    expect(left.width).toBe(150);
    expect(left.height).toBe(1200);
  });

  it('is deterministic for the same rng seed and inputs', () => {
    const a = buildBorderStrip({ edge: 'top', length: 1000, band: 120, motifs, rng: createRng('bs-det'), backgroundColor: '#fff', count: 8 });
    const b = buildBorderStrip({ edge: 'top', length: 1000, band: 120, motifs, rng: createRng('bs-det'), backgroundColor: '#fff', count: 8 });
    expect(serialize(a.svg)).toBe(serialize(b.svg));
  });

  it('never emits NaN/Infinity', () => {
    for (const edge of ['top', 'bottom', 'left', 'right'] as BorderEdge[]) {
      const result = buildBorderStrip({ edge, length: 1200, band: 150, motifs, rng: createRng(`bs-nan-${edge}`), backgroundColor: '#fff', count: 12 });
      expect(serialize(result.svg)).not.toMatch(/NaN|Infinity/);
    }
  });

  it('places at least `count` motif instances', () => {
    const result = buildBorderStrip({ edge: 'bottom', length: 1200, band: 150, motifs, rng: createRng('bs-count'), backgroundColor: '#fff', count: 12 });
    const matches = serialize(result.svg).match(/scale\(/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(12);
  });
});

describe('buildCornerUnit', () => {
  it('is always a square band x band unit', () => {
    const result = buildCornerUnit({ corner: 'top-left', band: 300, motifs, rng: createRng('cu-1'), backgroundColor: '#fff', count: 6 });
    expect(result.width).toBe(300);
    expect(result.height).toBe(300);
  });

  it('is deterministic for the same rng seed and inputs', () => {
    const a = buildCornerUnit({ corner: 'bottom-right', band: 250, motifs, rng: createRng('cu-det'), backgroundColor: '#fff', count: 6 });
    const b = buildCornerUnit({ corner: 'bottom-right', band: 250, motifs, rng: createRng('cu-det'), backgroundColor: '#fff', count: 6 });
    expect(serialize(a.svg)).toBe(serialize(b.svg));
  });

  it('never emits NaN/Infinity for any of the 4 corners', () => {
    for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as CornerId[]) {
      const result = buildCornerUnit({ corner, band: 300, motifs, rng: createRng(`cu-nan-${corner}`), backgroundColor: '#fff', count: 8 });
      expect(serialize(result.svg)).not.toMatch(/NaN|Infinity/);
    }
  });

  it('the 3 mirrored corners genuinely differ in structure from the un-mirrored top-left base', () => {
    const topLeft = buildCornerUnit({ corner: 'top-left', band: 300, motifs, rng: createRng('cu-mirror'), backgroundColor: '#fff', count: 6 });
    const topRight = buildCornerUnit({ corner: 'top-right', band: 300, motifs, rng: createRng('cu-mirror'), backgroundColor: '#fff', count: 6 });
    const bottomLeft = buildCornerUnit({ corner: 'bottom-left', band: 300, motifs, rng: createRng('cu-mirror'), backgroundColor: '#fff', count: 6 });
    const bottomRight = buildCornerUnit({ corner: 'bottom-right', band: 300, motifs, rng: createRng('cu-mirror'), backgroundColor: '#fff', count: 6 });
    const serialized = [topLeft, topRight, bottomLeft, bottomRight].map((r) => serialize(r.svg));
    expect(new Set(serialized).size).toBe(4);
  });
});
