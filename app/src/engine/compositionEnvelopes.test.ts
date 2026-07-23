import { describe, it, expect } from 'vitest';
import { applyCompositionEnvelope, WEAK_PRESET_HIERARCHY_OVERRIDES } from './compositionEnvelopes';
import { HIERARCHY_PRESETS } from './hierarchy';

describe('applyCompositionEnvelope', () => {
  it('is a strict no-op (identical reference) for any style with no registered override', () => {
    const base = HIERARCHY_PRESETS.balancedEditorial.value;
    const result = applyCompositionEnvelope('editorialBotanical', base);
    expect(result).toBe(base);
  });

  it('only registers overrides for the two audit-evidenced weak presets', () => {
    expect(Object.keys(WEAK_PRESET_HIERARCHY_OVERRIDES).sort()).toEqual(['luxuryFloral', 'minimalBotanical']);
  });

  it('raises heroRatio and heroScale for minimalBotanical, leaves other fields untouched', () => {
    const base = HIERARCHY_PRESETS.minimalRepeat.value;
    const result = applyCompositionEnvelope('minimalBotanical', base);
    expect(result.heroRatio).toBeGreaterThan(base.heroRatio);
    expect(result.heroScale).toBeGreaterThan(base.heroScale);
    expect(result.fillerRatio).toBe(base.fillerRatio);
    expect(result.accentRatio).toBe(base.accentRatio);
  });

  it('lowers heroRatio for luxuryFloral so fewer placements compete as an equal-sized hero', () => {
    const base = HIERARCHY_PRESETS.heroFocus.value;
    const result = applyCompositionEnvelope('luxuryFloral', base);
    expect(result.heroRatio).toBeLessThan(base.heroRatio);
    expect(result.heroScale).toBeGreaterThanOrEqual(base.heroScale);
  });

  it('does not affect other presets sharing the same underlying hierarchy table (darkBotanical/modernTropical share heroFocus; organicAbstract shares minimalRepeat)', () => {
    const heroFocusBase = HIERARCHY_PRESETS.heroFocus.value;
    expect(applyCompositionEnvelope('darkBotanical', heroFocusBase)).toBe(heroFocusBase);
    expect(applyCompositionEnvelope('modernTropical', heroFocusBase)).toBe(heroFocusBase);
    const minimalRepeatBase = HIERARCHY_PRESETS.minimalRepeat.value;
    expect(applyCompositionEnvelope('organicAbstract', minimalRepeatBase)).toBe(minimalRepeatBase);
  });
});
