import { describe, it, expect } from 'vitest';
import { STYLE_DNA_PRESETS, STYLE_DNA_LIST } from './styleDna';
import { computeDesignKnowledgeProfile, resolveDesignRules } from './designKnowledge';

describe('computeDesignKnowledgeProfile (Build 005, Section 1: Design Knowledge Engine)', () => {
  it('is a pure, deterministic function of the style (no randomness)', () => {
    const a = computeDesignKnowledgeProfile(STYLE_DNA_PRESETS.luxuryFloral);
    const b = computeDesignKnowledgeProfile(STYLE_DNA_PRESETS.luxuryFloral);
    expect(a).toEqual(b);
  });

  it('every preset produces a valid profile without throwing', () => {
    for (const dna of STYLE_DNA_LIST) {
      expect(() => computeDesignKnowledgeProfile(dna)).not.toThrow();
    }
  });

  it('Luxury Floral (premiumHero, high clusterDensity/heroScale) reads as a large, full bouquet', () => {
    const profile = computeDesignKnowledgeProfile(STYLE_DNA_PRESETS.luxuryFloral);
    expect(profile.bouquetSize).toBe('full');
    expect(profile.flowerSize).toBe('large');
    expect(profile.traits).toContain('Layered flowers');
  });

  it('Minimal Botanical (no premiumHero, sparse cluster, generous negative space) reads as single/sparse/generous', () => {
    const profile = computeDesignKnowledgeProfile(STYLE_DNA_PRESETS.minimalBotanical);
    expect(profile.bouquetSize).toBe('single');
    expect(profile.clusterDensity).toBe('sparse');
    expect(profile.negativeSpaceLevel).toBe('generous');
  });

  it('Eucalyptus/Olive-preferring Minimal Botanical reads as longer stem/denser leaf via real per-species averaging (Section 4 data)', () => {
    const minimal = computeDesignKnowledgeProfile(STYLE_DNA_PRESETS.minimalBotanical);
    expect(minimal.stemLength).toBe('long');
    expect(minimal.leafDensity).toBe('dense');
  });

  it('a style with no preferredFamilies at all gets the neutral medium/moderate stem/leaf tiers', () => {
    const profile = computeDesignKnowledgeProfile(STYLE_DNA_PRESETS.boutiquePackaging);
    expect(profile.stemLength).toBe('medium');
    expect(profile.leafDensity).toBe('moderate');
  });

  it('rhythm is exactly the style\'s own real flowProfile, not a fabricated separate field', () => {
    for (const dna of STYLE_DNA_LIST) {
      expect(computeDesignKnowledgeProfile(dna).rhythm).toBe(dna.flowProfile);
    }
  });
});

describe('resolveDesignRules (Build 005, Section 2: Design Rule Engine)', () => {
  it('every preset resolves to valid, sane generation rules', () => {
    for (const dna of STYLE_DNA_LIST) {
      const rules = resolveDesignRules(computeDesignKnowledgeProfile(dna));
      expect(rules.heroMemberCountRange[0]).toBeGreaterThan(0);
      expect(rules.heroMemberCountRange[1]).toBeGreaterThanOrEqual(rules.heroMemberCountRange[0]);
      expect(rules.bouquetBaseRadiusScale).toBeGreaterThan(0);
      expect(rules.stemLengthMultiplier).toBeGreaterThan(0);
      expect(rules.leafDensityMultiplier).toBeGreaterThan(0);
    }
  });

  it('a "full" bouquet style resolves to a larger member-count range and radius scale than a "single" one', () => {
    const full = resolveDesignRules(computeDesignKnowledgeProfile(STYLE_DNA_PRESETS.luxuryFloral));
    const single = resolveDesignRules(computeDesignKnowledgeProfile(STYLE_DNA_PRESETS.minimalBotanical));
    expect(full.heroMemberCountRange[1]).toBeGreaterThan(single.heroMemberCountRange[1]);
    expect(full.bouquetBaseRadiusScale).toBeGreaterThan(single.bouquetBaseRadiusScale);
  });

  it('a "long stem" style resolves to a stem multiplier > 1, a neutral "medium" style resolves to exactly 1', () => {
    const long = resolveDesignRules(computeDesignKnowledgeProfile(STYLE_DNA_PRESETS.minimalBotanical));
    const neutral = resolveDesignRules(computeDesignKnowledgeProfile(STYLE_DNA_PRESETS.boutiquePackaging));
    expect(long.stemLengthMultiplier).toBeGreaterThan(1);
    expect(neutral.stemLengthMultiplier).toBe(1);
  });
});
