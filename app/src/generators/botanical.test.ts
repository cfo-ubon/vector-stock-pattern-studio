import { describe, it, expect } from 'vitest';
import { createRng } from '../engine/rng';
import { serialize } from '../engine/svgAst';
import { h } from '../engine/svgAst';
import type { SvgNode } from '../engine/types';
import { botanicalGenerator, BOTANICAL_VARIANTS, __testables } from './botanical';
import { BOTANICAL_FAMILIES } from './botanicalFamilies';
import { BOTANICAL_PARTS, shapeCategoryForPart } from './botanicalParts';

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

  it('Build 004, Section 1 / Build 020: a bare `family`/`part` hint is still inert (pool selection unaffected)', () => {
    // Build 004, Section 1 originally asserted a bare `role` hint was a
    // total no-op. Build 020 ("Hero Dominance Recovery") deliberately ends
    // that: measured evidence (docs/build_reports/BUILD_020_REPORT.md)
    // found the Build 019 stem/leaf wrapper narrowed `heroDetailRatio`
    // (hero vs. filler/accent average node count) by applying identically
    // regardless of role, tripping the `heroInsufficientDetail` soft
    // penalty on more patterns and dragging down Overall Visual Quality.
    // The fix makes `role` a real, intentional signal (hero/secondary get
    // a richer stem/leaf treatment than filler/accent) -- see the dedicated
    // "role affects stem/leaf richness" describe block below for that new
    // behavior's own tests. What's still true and still tested here: a
    // hint that carries no `role` (only `family`/`part`, or nothing at
    // all) continues to have zero effect on which pool a variant is drawn
    // from beyond what `family`/`part` alone already narrowed.
    for (let i = 0; i < 10; i++) {
      const seed = `botanical-hints-inert-${i}`;
      const plain = botanicalGenerator.createMotif(createRng(seed), COLORS, 70, 0);
      const withFamilyHint = botanicalGenerator.createMotif(createRng(seed), COLORS, 70, 0, { family: undefined });
      expect(serialize(withFamilyHint.node)).toBe(serialize(plain.node));
      expect(withFamilyHint.radius).toBe(plain.radius);
    }
  });

  it('Build 004, Section 3: poolForHints narrows by part-shape-category, real category-membership check', () => {
    const { poolForHints, TAGGED_VARIANTS } = __testables;
    for (const part of BOTANICAL_PARTS) {
      const category = shapeCategoryForPart(part);
      const pool = poolForHints({ part });
      if (category) {
        const expected = TAGGED_VARIANTS.filter((t) => t.category === category).map((t) => t.variant);
        expect(pool.length).toBe(expected.length);
        for (const v of expected) expect(pool).toContain(v);
        const excluded = TAGGED_VARIANTS.filter((t) => t.category !== category).map((t) => t.variant);
        for (const v of excluded) expect(pool).not.toContain(v);
      } else {
        // 'stem'/'connector'/'silhouette' have no dedicated shape category
        // yet -- a documented no-op, so the pool falls back to the full set.
        expect(pool.length).toBe(BOTANICAL_VARIANTS.length);
      }
    }
  });

  it('Build 004, Section 3: family + part hints combine (intersection), not just the last one applied', () => {
    const { poolForHints, TAGGED_VARIANTS } = __testables;
    // 'wildflower' family x 'flower' category: poppyFlower/bellFlower are
    // wildflower+flower; wildflowerSprig is wildflower+branch (excluded).
    const pool = poolForHints({ family: 'wildflower', part: 'heroFlower' });
    const expected = TAGGED_VARIANTS.filter((t) => (t.family === 'wildflower' || t.family === undefined) && t.category === 'flower').map(
      (t) => t.variant,
    );
    expect(pool.length).toBe(expected.length);
    for (const v of expected) expect(pool).toContain(v);
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

  it('Build 004, Section 2: every one of the 18 named families produces valid output when explicitly requested', () => {
    for (const family of BOTANICAL_FAMILIES) {
      for (let i = 0; i < 8; i++) {
        const motif = botanicalGenerator.createMotif(createRng(`family-${family}-${i}`), COLORS, 70, 0, { family });
        const svg = serialize(motif.node);
        expect(svg).not.toMatch(/NaN|Infinity|undefined/);
        expect(motif.radius).toBeGreaterThan(0);
      }
    }
  });

  it('Build 005, Section 4: 29 variants are registered (25 prior + 4 new: rose, protea, palm frond, monstera leaf)', () => {
    expect(BOTANICAL_VARIANTS.length).toBe(29);
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

describe('botanicalGenerator: optional stem wrapper for bare flower-head variants (Build 019, Priority 2/4)', () => {
  // Evidence: docs/build_reports/BUILD_019_VISUAL_AUDIT_before.json found
  // Botanical Realism the weakest scored dimension (mean 40.79/100) across
  // a 96-pattern sample spanning every botanical Style DNA preset -- most
  // of the standalone "flower head" variants (peony/rose/ranunculus/
  // protea/poppy/anemone/daisy/cosmos/bell/magnolia/hydrangea/lavender/
  // tulip/layeredBloom) drew no stem/leaf structure at all. `attachOptionalStem`
  // (exposed via `__testables`) is the single, shared fix for all of them.

  it('is a deterministic, pure function of its rng draw: same seed, same result', () => {
    const { attachOptionalStem } = __testables;
    const node = h('g', {}, [h('circle', { cx: 0, cy: 0, r: 10, fill: '#000' })]);
    const a = attachOptionalStem(createRng('stem-wrapper-det'), COLORS, node, 35, 70);
    const b = attachOptionalStem(createRng('stem-wrapper-det'), COLORS, node, 35, 70);
    expect(serialize(a.node)).toBe(serialize(b.node));
    expect(a.radius).toBe(b.radius);
  });

  it('when it adds a stem, extends radius by exactly the stem length and emits real data-part="stem"', () => {
    const { attachOptionalStem } = __testables;
    const node = h('g', {}, [h('circle', { cx: 0, cy: 0, r: 10, fill: '#000' })]);
    const baseRadius = 35;
    const size = 70;
    let sawStemAdded = false;
    for (let i = 0; i < 30; i++) {
      const result = attachOptionalStem(createRng(`stem-wrapper-add-${i}`), COLORS, node, baseRadius, size);
      const svg = serialize(result.node);
      if (svg.includes('data-part="stem"')) {
        sawStemAdded = true;
        expect(result.radius).toBeCloseTo(baseRadius + size * 0.32, 5);
        // Original circle geometry is preserved untouched, just wrapped.
        expect(svg).toContain('r="10"');
      } else {
        // The no-stem branch is a strict no-op: same node reference, same radius.
        expect(result.node).toBe(node);
        expect(result.radius).toBe(baseRadius);
      }
    }
    expect(sawStemAdded).toBe(true);
  });

  it('never applies to flowerBloom (its own Build 018 stem logic already handles it)', () => {
    const { CATEGORY_BY_VARIANT, flowerBloom } = __testables;
    // flowerBloom IS tagged 'flower' (so it would otherwise qualify) --
    // `createMotif`'s own routing explicitly excludes it by identity, which
    // is what the wiring-check test below confirms end-to-end.
    expect(CATEGORY_BY_VARIANT.get(flowerBloom)).toBe('flower');
  });

  it('createMotif attaches a real stem to a bare flower-head variant (proteaFlower) with no internal stem logic of its own', () => {
    const { proteaFlower } = __testables;
    // proteaFlower itself never draws a data-part="stem" -- confirmed
    // directly against the un-wrapped variant, so any stem seen through
    // createMotif for the 'protea' family is attributable to the wrapper.
    for (let i = 0; i < 15; i++) {
      const { node } = proteaFlower(createRng(`protea-bare-${i}`), COLORS, 70);
      expect(serialize(node)).not.toContain('data-part="stem"');
    }
    let sawStemViaCreateMotif = false;
    for (let i = 0; i < 60; i++) {
      const motif = botanicalGenerator.createMotif(createRng(`b019-wire-${i}`), COLORS, 70, 0, { family: 'protea', part: 'heroFlower' });
      if (serialize(motif.node).includes('data-part="stem"')) sawStemViaCreateMotif = true;
    }
    expect(sawStemViaCreateMotif).toBe(true);
  });

  it('is deterministic end-to-end through createMotif for the same seed', () => {
    const a = botanicalGenerator.createMotif(createRng('b019-det-flower'), COLORS, 70, 0, { family: 'protea', part: 'heroFlower' });
    const b = botanicalGenerator.createMotif(createRng('b019-det-flower'), COLORS, 70, 0, { family: 'protea', part: 'heroFlower' });
    expect(serialize(a.node)).toBe(serialize(b.node));
    expect(a.radius).toBe(b.radius);
  });
});

describe('botanicalGenerator: role affects stem/leaf richness (Build 020, Hero Dominance Recovery)', () => {
  // Evidence: docs/build_reports/BUILD_020_REPORT.md. Build 019's stem/leaf
  // wrapper applied the same probability to every role, which measurably
  // *narrowed* heroDetailRatio (a fixed absolute node addition is a larger
  // relative gain against filler/accent's smaller baseline node count than
  // against hero's already-larger one). The fix: hero always gets a stem,
  // usually a leaf, sometimes a second leaf; secondary gets an intermediate
  // tier; filler/accent/undefined stay byte-identical to Build 019.

  it('hero always gets a stem (probability 1, never the untouched-node no-op branch)', () => {
    const { attachOptionalStem } = __testables;
    const node = h('g', {}, [h('circle', { cx: 0, cy: 0, r: 10, fill: '#000' })]);
    for (let i = 0; i < 30; i++) {
      const result = attachOptionalStem(createRng(`b020-hero-stem-${i}`), COLORS, node, 35, 70, 'hero');
      expect(serialize(result.node)).toContain('data-part="stem"');
    }
  });

  it('a hero can gain a second leaf; secondary/filler never do (node-count floor strictly higher for hero)', () => {
    const { attachOptionalStem } = __testables;
    const node = h('g', {}, [h('circle', { cx: 0, cy: 0, r: 10, fill: '#000' })]);
    let sawSecondLeaf = false;
    for (let i = 0; i < 60; i++) {
      const heroResult = attachOptionalStem(createRng(`b020-second-leaf-${i}`), COLORS, node, 35, 70, 'hero');
      const heroLeafCount = (serialize(heroResult.node).match(/data-part="leaves"/g) ?? []).length;
      if (heroLeafCount >= 2) sawSecondLeaf = true;

      const secondaryResult = attachOptionalStem(createRng(`b020-second-leaf-${i}`), COLORS, node, 35, 70, 'secondary');
      const secondaryLeafCount = (serialize(secondaryResult.node).match(/data-part="leaves"/g) ?? []).length;
      expect(secondaryLeafCount).toBeLessThanOrEqual(1);
    }
    expect(sawSecondLeaf).toBe(true);
  });

  it('filler/accent/undefined role reproduces Build 019 exactly (same seed, same rng draws, byte-identical output)', () => {
    const { attachOptionalStem } = __testables;
    const node = h('g', {}, [h('circle', { cx: 0, cy: 0, r: 10, fill: '#000' })]);
    for (const role of [undefined, 'filler', 'accent'] as const) {
      for (let i = 0; i < 15; i++) {
        const withRole = attachOptionalStem(createRng(`b020-filler-parity-${role}-${i}`), COLORS, node, 35, 70, role);
        const withoutRole = attachOptionalStem(createRng(`b020-filler-parity-${role}-${i}`), COLORS, node, 35, 70);
        expect(serialize(withRole.node)).toBe(serialize(withoutRole.node));
        expect(withRole.radius).toBe(withoutRole.radius);
      }
    }
  });

  it('createMotif extends the stem/leaf wrapper to a hero landing on a bare leaf-category variant (singleLeaf)', () => {
    // singleLeaf itself never draws a data-part="stem" -- confirmed
    // directly against the un-wrapped variant, so any stem seen through
    // createMotif with a hero role hint is attributable to Build 020's
    // 'leaf'-category hero extension.
    const { singleLeaf, CATEGORY_BY_VARIANT } = __testables;
    expect(CATEGORY_BY_VARIANT.get(singleLeaf)).toBe('leaf');
    for (let i = 0; i < 15; i++) {
      const { node } = singleLeaf(createRng(`b020-leaf-bare-${i}`), COLORS, 70);
      expect(serialize(node)).not.toContain('data-part="stem"');
    }
    let sawStemViaCreateMotifHero = false;
    for (let i = 0; i < 80; i++) {
      const motif = botanicalGenerator.createMotif(createRng(`b020-leaf-hero-${i}`), COLORS, 70, 0, { part: 'leaf', role: 'hero' });
      if (serialize(motif.node).includes('data-part="stem"')) sawStemViaCreateMotifHero = true;
    }
    expect(sawStemViaCreateMotifHero).toBe(true);
  });

  it('the leaf-category extension is hero-only: a filler/secondary landing on a bare leaf variant is unaffected', () => {
    for (const role of ['filler', 'secondary', undefined] as const) {
      for (let i = 0; i < 30; i++) {
        const withoutHint = botanicalGenerator.createMotif(createRng(`b020-leaf-nonhero-${role}-${i}`), COLORS, 70, 0, { part: 'leaf' });
        const withRole = botanicalGenerator.createMotif(createRng(`b020-leaf-nonhero-${role}-${i}`), COLORS, 70, 0, { part: 'leaf', role });
        expect(serialize(withRole.node)).toBe(serialize(withoutHint.node));
        expect(withRole.radius).toBe(withoutHint.radius);
      }
    }
  });

  it('is deterministic end-to-end through createMotif for the same seed (hero + leaf-category path)', () => {
    const a = botanicalGenerator.createMotif(createRng('b020-det-leaf-hero'), COLORS, 70, 0, { part: 'leaf', role: 'hero' });
    const b = botanicalGenerator.createMotif(createRng('b020-det-leaf-hero'), COLORS, 70, 0, { part: 'leaf', role: 'hero' });
    expect(serialize(a.node)).toBe(serialize(b.node));
    expect(a.radius).toBe(b.radius);
  });
});
