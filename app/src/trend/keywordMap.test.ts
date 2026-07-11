import { describe, it, expect } from 'vitest';
import { GENERATORS } from '../generators';
import { STYLE_DNA_PRESETS } from '../engine/styleDna';
import { KEYWORD_MAP, COMBO_RULES } from './keywordMap';

describe('keywordMap: config integrity', () => {
  it('every motifHint referenced is a real category id in GENERATORS', () => {
    for (const [token, signal] of Object.entries(KEYWORD_MAP)) {
      for (const id of signal.motifHints) {
        expect(GENERATORS[id], `${token} -> motifHints has unknown category "${id}"`).toBeDefined();
      }
    }
  });

  it('every styleDnaHint referenced is a real Style DNA preset id', () => {
    for (const [token, signal] of Object.entries(KEYWORD_MAP)) {
      for (const id of signal.styleDnaHints) {
        expect(STYLE_DNA_PRESETS[id], `${token} -> styleDnaHints has unknown Style DNA "${id}"`).toBeDefined();
      }
    }
  });

  it('every keyword has a positive weight', () => {
    for (const [token, signal] of Object.entries(KEYWORD_MAP)) {
      expect(signal.weight, token).toBeGreaterThan(0);
    }
  });

  it('every combo rule references two tokens that actually exist in KEYWORD_MAP', () => {
    for (const rule of COMBO_RULES) {
      for (const token of rule.tokens) {
        expect(KEYWORD_MAP[token], `combo rule references unknown token "${token}"`).toBeDefined();
      }
    }
  });

  it('no combo rule pairs a token with itself', () => {
    for (const rule of COMBO_RULES) {
      expect(rule.tokens[0]).not.toBe(rule.tokens[1]);
    }
  });
});
