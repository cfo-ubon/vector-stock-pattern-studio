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
    for (let i = 0; i < 20; i++) {
      const hero = buildPremiumHero(createRng(`premium-hero-nodes-${i}`), { colors: COLORS, size: 120 });
      expect(countNodes(hero.node)).toBeLessThan(400);
    }
  });

  it('every one of the 15 named families produces valid output when explicitly requested', () => {
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
});
