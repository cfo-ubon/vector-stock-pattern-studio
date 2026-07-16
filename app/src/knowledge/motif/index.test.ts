import { describe, it, expect } from 'vitest';
import { listMotifGrammars } from '../../services/motifGrammarService';
import { listPatternGrammars } from '../../services/patternGrammarService';
import {
  listMotifKnowledge,
  getMotifKnowledge,
  findMotifKnowledgeByFamily,
  isMotifRoleAllowed,
  isCombinationRecommended,
  getForbiddenPatternGrammars,
  getRecommendedFamilyCombinations,
} from './index';

describe('knowledge/motif: pass-through lookups', () => {
  it('listMotifKnowledge matches the real Motif Grammar Library', () => {
    expect(listMotifKnowledge().length).toBe(listMotifGrammars().length);
  });

  it('findMotifKnowledgeByFamily returns only motifs in that family', () => {
    const results = findMotifKnowledgeByFamily('flower');
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(r.family).toBe('flower');
  });

  it('isMotifRoleAllowed matches the real motif grammar role list', () => {
    const grammar = listMotifGrammars()[0];
    expect(isMotifRoleAllowed(grammar.id, grammar.roles[0])).toBe(true);
  });
});

describe('knowledge/motif: allow-list / forbidden derivation', () => {
  it('isCombinationRecommended is true for a motif\'s own compatiblePatternGrammars entries', () => {
    const grammar = listMotifGrammars().find((g) => g.compatiblePatternGrammars.length > 0)!;
    expect(isCombinationRecommended(grammar.id, grammar.compatiblePatternGrammars[0])).toBe(true);
  });

  it('getForbiddenPatternGrammars is the exact complement of compatiblePatternGrammars', () => {
    const grammar = getMotifKnowledge(listMotifGrammars()[0].id)!;
    const allPatternGrammarIds = listPatternGrammars().map((g) => g.id);
    const forbidden = getForbiddenPatternGrammars(grammar.id);
    for (const id of allPatternGrammarIds) {
      if (grammar.compatiblePatternGrammars.includes(id)) {
        expect(forbidden).not.toContain(id);
      } else {
        expect(forbidden).toContain(id);
      }
    }
  });

  it('getForbiddenPatternGrammars returns [] for an unknown motif id', () => {
    expect(getForbiddenPatternGrammars('not-a-real-motif')).toEqual([]);
  });

  it('a forbidden pattern grammar for a motif is never also recommended for it', () => {
    for (const grammar of listMotifGrammars()) {
      const forbidden = getForbiddenPatternGrammars(grammar.id);
      for (const patternGrammarId of forbidden) {
        expect(isCombinationRecommended(grammar.id, patternGrammarId)).toBe(false);
      }
    }
  });
});

describe('knowledge/motif: recommended family combinations', () => {
  it('returns other motifs in the same family, excluding itself', () => {
    const grammar = listMotifGrammars()[0];
    const results = getRecommendedFamilyCombinations(grammar.id);
    expect(results.every((r) => r.family === grammar.family)).toBe(true);
    expect(results.some((r) => r.id === grammar.id)).toBe(false);
  });
});
