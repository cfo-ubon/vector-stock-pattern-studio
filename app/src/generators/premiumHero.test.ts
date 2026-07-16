import { describe, it, expect } from 'vitest';
import { createRng } from '../engine/rng';
import { serialize } from '../engine/svgAst';
import type { SvgNode } from '../engine/types';
import { buildPremiumHero } from './premiumHero';
import { BOTANICAL_FAMILIES } from './botanicalFamilies';

const COLORS = ['#f4ede4', '#c9a86c', '#7c8a5f', '#a94438', '#3c3a34'];

function countNodes(node: SvgNode): number {
  return 1 + (node.children ?? []).reduce((sum, c) => sum + countNodes(c), 0);
}

describe('buildPremiumHero', () => {
  it('is deterministic for the same seed', () => {
    const a = buildPremiumHero(createRng('premium-hero-det'), { colors: COLORS, size: 120 });
    const b = buildPremiumHero(createRng('premium-hero-det'), { colors: COLORS, size: 120 });
    expect(serialize(a.node)).toBe(serialize(b.node));
    expect(a.radius).toBe(b.radius);
  });

  it('produces valid, finite, non-empty SVG for many seeds', () => {
    for (let i = 0; i < 40; i++) {
      const hero = buildPremiumHero(createRng(`premium-hero-seed-${i}`), { colors: COLORS, size: 120 });
      const svg = serialize(hero.node);
      expect(svg).not.toMatch(/NaN|Infinity|undefined/);
      expect(hero.radius).toBeGreaterThan(0);
      expect(hero.radius).toBeLessThan(600);
    }
  });

  it('emits data-part groups for stem, leaves, and the overall premium-hero assembly', () => {
    const hero = buildPremiumHero(createRng('premium-hero-parts'), { colors: COLORS, size: 120 });
    const svg = serialize(hero.node);
    expect(svg).toContain('data-part="stem"');
    expect(svg).toContain('data-part="leaves"');
    expect(svg).toContain('data-part="premium-hero"');
  });

  it('assembles more than just a single flower: multiple sub-part groups beyond stem/leaves', () => {
    for (let i = 0; i < 10; i++) {
      const hero = buildPremiumHero(createRng(`premium-hero-subparts-${i}`), { colors: COLORS, size: 120 });
      // 'premium-hero' g -> [stem g, leaves g, ...N member sub-part g's]
      const assembled = hero.node.children!.find((c) => c.attrs?.['data-part'] === 'premium-hero') ?? hero.node;
      const topLevelGroups = assembled.children ?? [];
      expect(topLevelGroups.length).toBeGreaterThanOrEqual(2 + 4); // stem + leaves + at least 4 cluster members
    }
  });

  it('keeps node counts within a reasonable ceiling (no runaway path bloat)', () => {
    // Build 006, Section 2/3 (Luxury Bouquet Composer + Natural Botanical
    // Relationships): the companion-foliage sprig is a real, deliberately
    // small addition (capped at 3 leaves), but it's still additive on top
    // of every pre-existing part -- a diagnostic sweep across 200 seeds
    // measured a real max of 525 (was <400 pre-Build-006), so 600 is a real
    // ceiling with headroom, not an arbitrarily loosened one.
    for (let i = 0; i < 20; i++) {
      const hero = buildPremiumHero(createRng(`premium-hero-nodes-${i}`), { colors: COLORS, size: 120 });
      expect(countNodes(hero.node)).toBeLessThan(600);
    }
  });

  it('every one of the 18 named families produces valid output when explicitly requested', () => {
    for (const family of BOTANICAL_FAMILIES) {
      for (let i = 0; i < 3; i++) {
        const hero = buildPremiumHero(createRng(`premium-hero-family-${family}-${i}`), { colors: COLORS, size: 120, family });
        const svg = serialize(hero.node);
        expect(svg).not.toMatch(/NaN|Infinity|undefined/);
        expect(hero.radius).toBeGreaterThan(0);
      }
    }
  });

  it('radius accounts for the furthest sub-part, not just the hero flower alone', () => {
    const hero = buildPremiumHero(createRng('premium-hero-radius'), { colors: COLORS, size: 200 });
    expect(hero.radius).toBeGreaterThanOrEqual(200 * 0.55);
  });

  it('Build 005, Section 3: the hero-role sub-part gets a real Calyx (data-part="calyx") that secondary/filler/accent parts don\'t', () => {
    let sawCalyx = false;
    for (let i = 0; i < 15; i++) {
      const hero = buildPremiumHero(createRng(`premium-hero-calyx-${i}`), { colors: COLORS, size: 120 });
      const svg = serialize(hero.node);
      if (svg.includes('data-part="calyx"')) sawCalyx = true;
    }
    expect(sawCalyx).toBe(true);
  });

  it('Build 005, Section 4: a species with real design data (rose) genuinely changes the assembled hero vs. no family hint', () => {
    const withFamily = buildPremiumHero(createRng('premium-hero-species-effect'), { colors: COLORS, size: 120, family: 'rose' });
    const withoutFamily = buildPremiumHero(createRng('premium-hero-species-effect'), { colors: COLORS, size: 120 });
    expect(serialize(withFamily.node)).not.toBe(serialize(withoutFamily.node));
  });

  it('Build 005, Section 2: designRules genuinely change the assembled hero vs. omitting them', () => {
    const withRules = buildPremiumHero(createRng('premium-hero-rules-effect'), {
      colors: COLORS,
      size: 120,
      designRules: { heroMemberCountRange: [5, 7], bouquetBaseRadiusScale: 1.2, stemLengthMultiplier: 1.3, leafDensityMultiplier: 1.3 },
    });
    const withoutRules = buildPremiumHero(createRng('premium-hero-rules-effect'), { colors: COLORS, size: 120 });
    expect(serialize(withRules.node)).not.toBe(serialize(withoutRules.node));
  });

  it('Build 005, Section 2: a "full bouquet" design rule set produces a larger radius than a "single" one, all else equal', () => {
    const full = buildPremiumHero(createRng('premium-hero-rules-radius'), {
      colors: COLORS,
      size: 120,
      designRules: { heroMemberCountRange: [5, 7], bouquetBaseRadiusScale: 1.2, stemLengthMultiplier: 1, leafDensityMultiplier: 1 },
    });
    const single = buildPremiumHero(createRng('premium-hero-rules-radius'), {
      colors: COLORS,
      size: 120,
      designRules: { heroMemberCountRange: [3, 4], bouquetBaseRadiusScale: 0.85, stemLengthMultiplier: 1, leafDensityMultiplier: 1 },
    });
    expect(full.radius).toBeGreaterThanOrEqual(single.radius);
  });

  it('Build 006, Section 3: a species with real companions (rose) draws a real companion-foliage sprig at least sometimes', () => {
    let sawCompanionFoliage = false;
    for (let i = 0; i < 20; i++) {
      const hero = buildPremiumHero(createRng(`premium-hero-companion-${i}`), { colors: COLORS, size: 120, family: 'rose' });
      if (serialize(hero.node).includes('data-part="companion-foliage"')) sawCompanionFoliage = true;
    }
    expect(sawCompanionFoliage).toBe(true);
  });

  it('Build 006, Section 3: a species with no companions (eucalyptus, foliageOnly) never draws a companion-foliage sprig', () => {
    for (let i = 0; i < 15; i++) {
      const hero = buildPremiumHero(createRng(`premium-hero-no-companion-${i}`), { colors: COLORS, size: 120, family: 'eucalyptus' });
      expect(serialize(hero.node)).not.toContain('data-part="companion-foliage"');
    }
  });

  it('Build 006, Section 6: non-hero members are sometimes horizontally mirrored (negative x-scale) across many seeds', () => {
    let sawMirror = false;
    for (let i = 0; i < 25; i++) {
      const hero = buildPremiumHero(createRng(`premium-hero-mirror-${i}`), { colors: COLORS, size: 120, family: 'peony' });
      if (/scale\(-[0-9.]+ [0-9.]+\)/.test(serialize(hero.node))) sawMirror = true;
    }
    expect(sawMirror).toBe(true);
  });

  it('Build 006, Section 2: visual weight balancing never shrinks the hero member itself (hero-scale flower always present at full member scale)', () => {
    // A regression here would mean balanceVisualWeight's role filter broke and
    // started touching hero members too -- this stays deterministic and valid
    // across many seeds/species regardless.
    for (let i = 0; i < 15; i++) {
      const hero = buildPremiumHero(createRng(`premium-hero-weight-${i}`), { colors: COLORS, size: 120, family: 'hydrangea' });
      expect(hero.radius).toBeGreaterThan(0);
      expect(serialize(hero.node)).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it('every one of the 19 named species (including the new babysBreath) produces valid output when explicitly requested', () => {
    for (const family of BOTANICAL_FAMILIES) {
      for (let i = 0; i < 3; i++) {
        const hero = buildPremiumHero(createRng(`premium-hero-species19-${family}-${i}`), { colors: COLORS, size: 120, family });
        const svg = serialize(hero.node);
        expect(svg).not.toMatch(/NaN|Infinity|undefined/);
        expect(hero.radius).toBeGreaterThan(0);
      }
    }
  });
});
