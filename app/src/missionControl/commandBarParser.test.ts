import { describe, it, expect } from 'vitest';
import { parseCommandBarInput } from './commandBarParser';

describe('parseCommandBarInput', () => {
  it('recognizes navigation intent before goal-mode keywords', () => {
    expect(parseCommandBarInput('Analyze my portfolio')).toEqual({ kind: 'navigate', target: 'portfolio' });
  });

  it('recognizes a real Goal Mode from the sentence', () => {
    expect(parseCommandBarInput('Help me earn faster')).toEqual({ kind: 'goalMode', goalMode: 'EARN_FASTER' });
    expect(parseCommandBarInput('Increase Adobe portfolio')).toEqual({ kind: 'goalMode', goalMode: 'EXPAND_ADOBE' });
    expect(parseCommandBarInput('Generate today\'s recommendation')).toEqual({ kind: 'goalMode', goalMode: 'USE_TODAYS_RECOMMENDATION' });
  });

  it('falls back to the real, existing Custom Goal parser — never a fabricated interpretation', () => {
    const result = parseCommandBarInput('Create 20 Botanical patterns');
    expect(result.kind).toBe('customGoal');
    if (result.kind === 'customGoal') {
      expect(result.parsed.count).toBe(20);
      expect(result.parsed.theme.toLowerCase()).toContain('botanical');
    }
  });
});
