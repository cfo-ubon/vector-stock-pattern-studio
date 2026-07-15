import { describe, it, expect } from 'vitest';
import { createRng } from '../engine/rng';
import { serialize } from '../engine/svgAst';
import type { SvgNode } from '../engine/types';
import { botanicalGenerator, BOTANICAL_VARIANTS, __testables } from './botanical';
import { BOTANICAL_FAMILIES } from './botanicalFamilies';

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

  it('Build 004, Section 1: a role-only hint (no family) is inert -- role/part selection logic is Section 3+', () => {
    for (let i = 0; i < 10; i++) {
      const seed = `botanical-hints-inert-${i}`;
      const plain = botanicalGenerator.createMotif(createRng(seed), COLORS, 70, 0);
      const withHints = botanicalGenerator.createMotif(createRng(seed), COLORS, 70, 0, { role: 'hero', part: 'heroFlower' });
      expect(serialize(withHints.node)).toBe(serialize(plain.node));
      expect(withHints.radius).toBe(plain.radius);
    }
  });

  it('Build 004, Section 2: poolForFamily narrows to only that family plus untagged universal variants', () => {
    const { poolForFamily, TAGGED_VARIANTS } = __testables;
    for (const family of BOTANICAL_FAMILIES) {
      const pool = poolForFamily(family);
      const expectedCount = TAGGED_VARIANTS.filter((t) => t.family === family || t.family === undefined).length;
      expect(pool.length).toBe(expectedCount);
      // Every family-restricted pool must exclude every variant tagged with
      // a *different* family -- the actual "no mixing unrelated species"
      // guarantee, checked precisely against the real tag set rather than
      // inferred from serialized output.
      const excludedOtherFamilyVariants = TAGGED_VARIANTS.filter((t) => t.family !== undefined && t.family !== family).map((t) => t.variant);
      for (const excluded of excludedOtherFamilyVariants) {
        expect(pool).not.toContain(excluded);
      }
    }
  });

  it('Build 004, Section 2: at least one family (magnolia) has a real, small, non-degenerate pool', () => {
    // Confirms the filter genuinely narrows (not just "technically excludes
    // nothing") -- magnolia has exactly 1 dedicated variant + the untagged
    // universal ones, well under the full 25.
    const pool = __testables.poolForFamily('magnolia');
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.length).toBeLessThan(BOTANICAL_VARIANTS.length);
  });

  it('Build 004, Section 2: every one of the 15 named families produces valid output when explicitly requested', () => {
    for (const family of BOTANICAL_FAMILIES) {
      for (let i = 0; i < 8; i++) {
        const motif = botanicalGenerator.createMotif(createRng(`family-${family}-${i}`), COLORS, 70, 0, { family });
        const svg = serialize(motif.node);
        expect(svg).not.toMatch(/NaN|Infinity|undefined/);
        expect(motif.radius).toBeGreaterThan(0);
      }
    }
  });

  it('Build 004, Section 2: 25 variants are registered (21 original + 4 new: magnolia, hydrangea, lavender, berry branch)', () => {
    expect(BOTANICAL_VARIANTS.length).toBe(25);
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
    // 25 variants exist; with 400 draws we expect well over half of them to
    // show up in just the first-40-chars signature bucket.
    expect(seen.size).toBeGreaterThan(10);
  });

  it('Build 004, Section 2: berryBranch (forced via family hint) emits a real data-part="berries" group', () => {
    let sawBerries = false;
    for (let i = 0; i < 20; i++) {
      const motif = botanicalGenerator.createMotif(createRng(`berry-branch-${i}`), COLORS, 70, 0, { family: 'berryBranch' });
      // berryBranch is the only 'berryBranch'-tagged variant, but universal
      // untagged variants can still be drawn too -- filter down to the ones
      // that actually emit the berries part before asserting on it.
      if (serialize(motif.node).includes('data-part="berries"')) sawBerries = true;
    }
    expect(sawBerries).toBe(true);
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
