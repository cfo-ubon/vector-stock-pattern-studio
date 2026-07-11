import { describe, it, expect } from 'vitest';
import {
  listPatternGrammars,
  getPatternGrammar,
  findPatternGrammarsByLayout,
  isDensityCompatible,
  isNegativeSpaceCompatible,
} from './patternGrammarService';

describe('patternGrammarService', () => {
  it('listPatternGrammars returns all 6 composition styles', () => {
    expect(listPatternGrammars()).toHaveLength(6);
  });

  it('getPatternGrammar resolves a real id and returns undefined for an unknown one', () => {
    expect(getPatternGrammar('dense')?.id).toBe('dense');
    expect(getPatternGrammar('not-real')).toBeUndefined();
  });

  it('findPatternGrammarsByLayout only returns grammars listing that layout', () => {
    const results = findPatternGrammarsByLayout('grid');
    expect(results.length).toBeGreaterThan(0);
    for (const grammar of results) {
      expect(grammar.compatibleLayouts).toContain('grid');
    }
  });

  it('isDensityCompatible checks the densityRange and returns false for an unknown grammar', () => {
    const dense = getPatternGrammar('dense')!;
    expect(isDensityCompatible('dense', dense.densityRange.min)).toBe(true);
    expect(isDensityCompatible('dense', dense.densityRange.max + 1)).toBe(false);
    expect(isDensityCompatible('not-real', 0.5)).toBe(false);
  });

  it('isNegativeSpaceCompatible checks the negativeSpaceRange and returns false for an unknown grammar', () => {
    const minimal = getPatternGrammar('minimal')!;
    expect(isNegativeSpaceCompatible('minimal', minimal.negativeSpaceRange.min)).toBe(true);
    expect(isNegativeSpaceCompatible('minimal', minimal.negativeSpaceRange.max + 1)).toBe(false);
    expect(isNegativeSpaceCompatible('not-real', 0.2)).toBe(false);
  });
});
