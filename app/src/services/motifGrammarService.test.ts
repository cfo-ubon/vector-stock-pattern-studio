import { describe, it, expect } from 'vitest';
import { listMotifGrammars, getMotifGrammar, findMotifGrammarsByFamily, findMotifGrammarsByPatternGrammar, isRoleAllowed } from './motifGrammarService';

describe('motifGrammarService', () => {
  it('listMotifGrammars returns all 15 categories', () => {
    expect(listMotifGrammars()).toHaveLength(15);
  });

  it('getMotifGrammar resolves a real id and returns undefined for an unknown one', () => {
    expect(getMotifGrammar('botanical')?.id).toBe('botanical');
    expect(getMotifGrammar('not-real')).toBeUndefined();
  });

  it('findMotifGrammarsByFamily only returns grammars in that family', () => {
    const results = findMotifGrammarsByFamily('flower');
    expect(results.length).toBeGreaterThan(0);
    for (const grammar of results) {
      expect(grammar.family).toBe('flower');
    }
  });

  it('findMotifGrammarsByPatternGrammar only returns categories compatible with that composition style', () => {
    const results = findMotifGrammarsByPatternGrammar('balanced');
    expect(results.length).toBeGreaterThan(0);
    for (const grammar of results) {
      expect(grammar.compatiblePatternGrammars).toContain('balanced');
    }
  });

  it('isRoleAllowed reflects each category\'s own roles list, false for an unknown category', () => {
    expect(isRoleAllowed('botanical', 'hero')).toBe(true);
    expect(isRoleAllowed('plaid', 'hero')).toBe(false);
    expect(isRoleAllowed('plaid', 'filler')).toBe(true);
    expect(isRoleAllowed('not-real', 'hero')).toBe(false);
  });
});
