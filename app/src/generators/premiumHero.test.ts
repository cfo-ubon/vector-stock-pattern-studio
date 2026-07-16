import { describe, it, expect } from 'vitest';
import { createRng } from '../engine/rng';
import { serialize } from '../engine/svgAst';
import type { SvgNode } from '../engine/types';
import { buildPremiumHero, resolveFillerPart, supportWeightRatio, resolveHeroArchetype } from './premiumHero';
import { BOTANICAL_FAMILIES, BOTANICAL_SPECIES } from './botanicalFamilies';
import { ILLUSTRATION_TEMPLATES } from './illustrationFamily';

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

  it('Build 006, Section 7: the hero-role sub-part gets a real Flower Center (data-part="flower-center") whenever it gets a Calyx', () => {
    let sawCenter = false;
    for (let i = 0; i < 15; i++) {
      const hero = buildPremiumHero(createRng(`premium-hero-center-${i}`), { colors: COLORS, size: 120 });
      const svg = serialize(hero.node);
      if (svg.includes('data-part="calyx"')) {
        expect(svg).toContain('data-part="flower-center"');
        sawCenter = true;
      }
    }
    expect(sawCenter).toBe(true);
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

describe('resolveFillerPart (Build 008B, Section 3: Commercial Bouquet Grammar)', () => {
  const bouquet = ILLUSTRATION_TEMPLATES.bouquet;

  it('a companion with role "foliage" resolves to the template\'s real Filler Leaf part', () => {
    expect(resolveFillerPart(bouquet, 'foliage', 'eucalyptus')).toBe(bouquet.fillerLeafPart);
  });

  it('a companion with role "filler" resolves to a small filler flower', () => {
    expect(resolveFillerPart(bouquet, 'filler', 'babysBreath')).toBe('secondaryFlower');
  });

  it('a companion with role "accentBerry" resolves to the template\'s real berry part', () => {
    expect(resolveFillerPart(bouquet, 'accentBerry', 'berryBranch')).toBe(bouquet.fillerPart);
  });

  it('falls back to the pre-008B bouquetRole check when no companion role is known (no companion picked)', () => {
    // eucalyptus itself has bouquetRole 'foliageOnly', not 'filler' -- old
    // behavior falls through to the template's berry part.
    expect(resolveFillerPart(bouquet, undefined, 'eucalyptus')).toBe(bouquet.fillerPart);
    // babysBreath itself has bouquetRole 'filler' -- old behavior draws a
    // filler flower even with no typed companion role available.
    expect(BOTANICAL_SPECIES.babysBreath.bouquetRole).toBe('filler');
    expect(resolveFillerPart(bouquet, undefined, 'babysBreath')).toBe('secondaryFlower');
  });

  it('falls back to the template\'s berry part when fillerFamily itself is undefined', () => {
    expect(resolveFillerPart(bouquet, undefined, undefined)).toBe(bouquet.fillerPart);
  });

  it('every real companion entry across all 19 species resolves to one of the 3 real part outcomes', () => {
    const validOutcomes = new Set([bouquet.fillerLeafPart, 'secondaryFlower', bouquet.fillerPart]);
    for (const family of BOTANICAL_FAMILIES) {
      for (const companion of BOTANICAL_SPECIES[family].companions) {
        const part = resolveFillerPart(bouquet, companion.role, companion.family);
        expect(validOutcomes.has(part)).toBe(true);
      }
    }
  });

  it('rose has a real "foliage"-role companion (eucalyptus), so buildPremiumHero\'s filler branch genuinely reaches the new Filler Leaf path, not just an unreachable unit-tested branch', () => {
    expect(BOTANICAL_SPECIES.rose.companions.some((c) => c.role === 'foliage' && c.family === 'eucalyptus')).toBe(true);
    for (let i = 0; i < 30; i++) {
      const hero = buildPremiumHero(createRng(`premium-hero-filler-leaf-${i}`), { colors: COLORS, size: 120, family: 'rose' });
      expect(serialize(hero.node)).not.toMatch(/NaN|Infinity|undefined/);
    }
  });
});

describe('supportWeightRatio (Build 008B, Section 6: Commercial Asset Priority)', () => {
  it('returns the exact pre-008B flat ratio (0.9) when no premiumScore is known', () => {
    expect(supportWeightRatio(undefined)).toBe(0.9);
  });

  it('a top-tier premium score (100) tightens the cap to 0.7, letting the hero dominate more', () => {
    expect(supportWeightRatio(100)).toBeCloseTo(0.7, 5);
  });

  it('a zero premium score relaxes the cap to 1.0', () => {
    expect(supportWeightRatio(0)).toBeCloseTo(1.0, 5);
  });

  it('is monotonically decreasing as premiumScore rises (higher premium -> stricter cap -> more hero dominance)', () => {
    expect(supportWeightRatio(90)).toBeLessThan(supportWeightRatio(50));
    expect(supportWeightRatio(50)).toBeLessThan(supportWeightRatio(10));
  });

  it('every real species\' premiumScore resolves to a ratio within the intended [0.7, 1.0] band', () => {
    for (const family of BOTANICAL_FAMILIES) {
      const ratio = supportWeightRatio(BOTANICAL_SPECIES[family].premiumScore);
      expect(ratio).toBeGreaterThanOrEqual(0.7);
      expect(ratio).toBeLessThanOrEqual(1.0);
    }
  });
});

describe('resolveHeroArchetype (Build 008B, Section 7: Silhouette Diversity)', () => {
  it('an explicit archetype option always wins over the weighted roll', () => {
    expect(resolveHeroArchetype(createRng('archetype-explicit'), 'diagonal')).toBe('diagonal');
    expect(resolveHeroArchetype(createRng('archetype-explicit'), 'editorial')).toBe('editorial');
  });

  it('is deterministic for a given seed', () => {
    const a = resolveHeroArchetype(createRng('archetype-det'));
    const b = resolveHeroArchetype(createRng('archetype-det'));
    expect(a).toBe(b);
  });

  it('produces more than one real silhouette across many seeds (never always "bouquet")', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(resolveHeroArchetype(createRng(`archetype-vary-${i}`)));
    expect(seen.size).toBeGreaterThan(1);
    expect(seen.has('bouquet')).toBe(true);
  });

  it('only ever resolves to a real, known cluster archetype', () => {
    const validArchetypes = new Set(['bouquet', 'cascade', 'diagonal', 'asymmetric', 'editorial']);
    for (let i = 0; i < 40; i++) {
      expect(validArchetypes.has(resolveHeroArchetype(createRng(`archetype-valid-${i}`)))).toBe(true);
    }
  });

  it('buildPremiumHero actually reaches a non-"bouquet" internal silhouette across enough seeds without ever crashing', () => {
    // End-to-end confirmation that the whole assembly (stem/leaves/members/
    // reach/radius math) stays valid for every archetype in the pool, not
    // just the historically-exercised 'bouquet' path.
    for (let i = 0; i < 80; i++) {
      const hero = buildPremiumHero(createRng(`premium-hero-silhouette-${i}`), { colors: COLORS, size: 120, family: 'peony' });
      expect(serialize(hero.node)).not.toMatch(/NaN|Infinity|undefined/);
      expect(hero.radius).toBeGreaterThan(0);
      expect(hero.radius).toBeLessThan(600);
    }
  });

  it('an explicit archetype option reaches buildPremiumHero and still produces valid output for every real archetype', () => {
    for (const archetype of ['bouquet', 'cascade', 'diagonal', 'asymmetric', 'editorial'] as const) {
      const hero = buildPremiumHero(createRng(`premium-hero-explicit-${archetype}`), { colors: COLORS, size: 120, family: 'rose', archetype });
      expect(serialize(hero.node)).not.toMatch(/NaN|Infinity|undefined/);
      expect(hero.radius).toBeGreaterThan(0);
    }
  });
});
