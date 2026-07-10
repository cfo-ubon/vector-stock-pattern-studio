import { describe, it, expect } from 'vitest';
import { createRng } from '../engine/rng';
import { serialize } from '../engine/svgAst';
import type { SvgNode } from '../engine/types';
import { botanicalGenerator } from './botanical';

const COLORS = ['#f4ede4', '#c9a86c', '#7c8a5f', '#a94438', '#3c3a34'];

function countNodes(node: SvgNode): number {
  return 1 + (node.children ?? []).reduce((sum, c) => sum + countNodes(c), 0);
}

describe('botanicalGenerator', () => {
  it('is deterministic for the same seed', () => {
    const a = botanicalGenerator.createMotif(createRng('botanical-det'), COLORS, 70);
    const b = botanicalGenerator.createMotif(createRng('botanical-det'), COLORS, 70);
    expect(serialize(a.node)).toBe(serialize(b.node));
    expect(a.radius).toBe(b.radius);
  });

  it('produces valid, finite, non-empty SVG for many seeds', () => {
    for (let i = 0; i < 60; i++) {
      const motif = botanicalGenerator.createMotif(createRng(`botanical-seed-${i}`), COLORS, 70);
      const svg = serialize(motif.node);
      expect(svg).not.toMatch(/NaN|Infinity|undefined/);
      expect(motif.radius).toBeGreaterThan(0);
      expect(motif.radius).toBeLessThan(400);
    }
  });

  it('keeps node counts within a reasonable ceiling (no runaway path bloat)', () => {
    for (let i = 0; i < 40; i++) {
      const motif = botanicalGenerator.createMotif(createRng(`botanical-nodes-${i}`), COLORS, 70);
      expect(countNodes(motif.node)).toBeLessThan(220);
    }
  });

  it('every registered variant appears at least once across enough seeds (no silent dead code)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const motif = botanicalGenerator.createMotif(createRng(`botanical-cover-${i}`), COLORS, 70);
      seen.add(serialize(motif.node).slice(0, 40));
    }
    // 21 variants exist; with 400 draws we expect well over half of them to
    // show up in just the first-40-chars signature bucket.
    expect(seen.size).toBeGreaterThan(10);
  });

  it('growth-based motifs emit data-part stem/leaves groups (Affinity-editable structure)', () => {
    let sawStemPart = false;
    let sawLeavesPart = false;
    for (let i = 0; i < 60; i++) {
      const motif = botanicalGenerator.createMotif(createRng(`botanical-parts-${i}`), COLORS, 70);
      const svg = serialize(motif.node);
      if (svg.includes('data-part="stem"')) sawStemPart = true;
      if (svg.includes('data-part="leaves"')) sawLeavesPart = true;
    }
    expect(sawStemPart).toBe(true);
    expect(sawLeavesPart).toBe(true);
  });
});
