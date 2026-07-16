import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from '../trend/designIntelligence';
import type { KeywordBundle } from '../trend/designSpecTypes';
import { listStyleKnowledge } from '../knowledge/style';
import { STYLE_COACH_CATEGORIES, findStylesForCategory, detectStyleCoachCategory, buildStyleCoachNotes } from './styleCoach';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical', secondaryKeywords: ['Wallpaper'], marketplace: 'adobestock',
    season: 'spring', audience: 'editorial', commercialCategory: 'wallpaper', patternType: 'botanical',
    paletteDirection: 'muted green', difficulty: 'moderate', collectionSize: 8, ...overrides,
  };
}

function makeSpec() {
  return buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
}

describe('STYLE_COACH_CATEGORIES / findStylesForCategory', () => {
  it('every one of the 7 brief-named categories resolves to at least one real Style DNA preset', () => {
    expect(STYLE_COACH_CATEGORIES).toHaveLength(7);
    for (const category of STYLE_COACH_CATEGORIES) {
      expect(findStylesForCategory(category).length, category).toBeGreaterThan(0);
    }
  });

  it('luxury resolves to real luxury-labeled presets', () => {
    const styles = findStylesForCategory('luxury');
    expect(styles.some((s) => s.id === 'luxuryFloral')).toBe(true);
    expect(styles.every((s) => /luxury/i.test(s.id) || /luxury/i.test(s.label))).toBe(true);
  });

  it('botanical resolves via the real preferredMotifFamilies field, not a hardcoded id list', () => {
    const styles = findStylesForCategory('botanical');
    for (const s of styles) expect(s.preferredMotifFamilies).toContain('botanical');
  });
});

describe('detectStyleCoachCategory', () => {
  it('detects a known category from the spec\'s real styleDnaId', () => {
    const luxuryStyle = listStyleKnowledge().find((s) => s.id === 'luxuryFloral')!;
    const spec = { ...makeSpec(), styleDnaId: luxuryStyle.id };
    expect(detectStyleCoachCategory(spec)).toBe('luxury');
  });

  it('returns null for a styleDnaId that matches no named category', () => {
    const spec = { ...makeSpec(), styleDnaId: 'not-a-real-style-id' };
    expect(detectStyleCoachCategory(spec)).toBeNull();
  });
});

describe('buildStyleCoachNotes', () => {
  it('returns [] when no category can be resolved and none is given explicitly', () => {
    const spec = { ...makeSpec(), styleDnaId: 'not-a-real-style-id' };
    expect(buildStyleCoachNotes(spec)).toEqual([]);
  });

  it('flags a real density mismatch against the matched style\'s preferred density', () => {
    const luxuryStyle = listStyleKnowledge().find((s) => s.id === 'luxuryFloral')!;
    const spec = { ...makeSpec(), styleDnaId: luxuryStyle.id, density: Math.min(1, luxuryStyle.preferredDensity + 0.4) };
    const notes = buildStyleCoachNotes(spec);
    expect(notes.some((n) => n.message.toLowerCase().includes('density'))).toBe(true);
    for (const n of notes) {
      expect(n.category).toBe('luxury');
      expect(n.matchedStyleId).toBe(luxuryStyle.id);
    }
  });

  it('flags a real palette mismatch against the matched style\'s preferred palettes', () => {
    const luxuryStyle = listStyleKnowledge().find((s) => s.id === 'luxuryFloral')!;
    const spec = { ...makeSpec(), styleDnaId: luxuryStyle.id, palette: { id: 'not-one-of-its-preferred-palettes', colors: ['#000000'] } };
    const notes = buildStyleCoachNotes(spec);
    expect(notes.some((n) => n.message.toLowerCase().includes('palette'))).toBe(true);
  });

  it('returns no density/palette notes when the spec already matches its style closely', () => {
    const luxuryStyle = listStyleKnowledge().find((s) => s.id === 'luxuryFloral')!;
    const spec = {
      ...makeSpec(),
      styleDnaId: luxuryStyle.id,
      density: luxuryStyle.preferredDensity,
      hierarchy: luxuryStyle.preferredHierarchy,
      palette: { id: luxuryStyle.preferredPalettes[0], colors: ['#000000'] },
    };
    expect(buildStyleCoachNotes(spec)).toEqual([]);
  });

  it('an explicit category argument overrides styleDnaId-based detection', () => {
    const spec = { ...makeSpec(), styleDnaId: 'not-a-real-style-id' };
    const notes = buildStyleCoachNotes(spec, 'minimal');
    // Should resolve against the real minimalBotanical preset instead of returning [] for an unmatched styleDnaId.
    expect(notes.every((n) => n.category === 'minimal')).toBe(true);
  });
});
