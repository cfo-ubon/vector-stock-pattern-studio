import { describe, it, expect } from 'vitest';
import {
  createScoringProfile,
  defaultScoringWeights,
  defaultScoreBands,
  labelForScore,
  isValidScoringProfile,
  OPPORTUNITY_SCORE_DIMENSIONS,
  InvalidScoringProfileInputError,
} from './scoringProfile';

describe('createScoringProfile', () => {
  it('creates a profile with equal default weights and the documented default bands', () => {
    const profile = createScoringProfile({ name: 'My Profile', now: 1000 });
    for (const dimension of OPPORTUNITY_SCORE_DIMENSIONS) {
      expect(profile.weights[dimension]).toBe(1);
    }
    expect(profile.bands).toEqual(defaultScoreBands());
    expect(isValidScoringProfile(profile)).toBe(true);
  });

  it('lets the user override individual weights without affecting the rest', () => {
    const profile = createScoringProfile({ name: 'Custom', weights: { demandSignal: 5 }, now: 1000 });
    expect(profile.weights.demandSignal).toBe(5);
    expect(profile.weights.trendMomentum).toBe(1);
  });

  it('rejects an empty name', () => {
    expect(() => createScoringProfile({ name: '' })).toThrow(InvalidScoringProfileInputError);
  });
});

describe('defaultScoringWeights', () => {
  it('covers every documented scoring dimension with no gaps', () => {
    const weights = defaultScoringWeights();
    expect(Object.keys(weights).sort()).toEqual([...OPPORTUNITY_SCORE_DIMENSIONS].sort());
  });
});

describe('labelForScore', () => {
  it('classifies scores into the correct configurable band at each boundary', () => {
    const bands = defaultScoreBands();
    expect(labelForScore(88, bands)).toBe('Strong Opportunity');
    expect(labelForScore(85, bands)).toBe('Strong Opportunity');
    expect(labelForScore(84, bands)).toBe('Promising');
    expect(labelForScore(70, bands)).toBe('Promising');
    expect(labelForScore(69, bands)).toBe('Experimental');
    expect(labelForScore(55, bands)).toBe('Experimental');
    expect(labelForScore(54, bands)).toBe('Weak');
    expect(labelForScore(40, bands)).toBe('Weak');
    expect(labelForScore(39, bands)).toBe('Avoid or Reconsider');
    expect(labelForScore(0, bands)).toBe('Avoid or Reconsider');
  });

  it('respects a user-edited custom band configuration instead of the default', () => {
    const customBands = [{ min: 0, max: 100, label: 'Everything Is Fine' }];
    expect(labelForScore(12, customBands)).toBe('Everything Is Fine');
  });
});
