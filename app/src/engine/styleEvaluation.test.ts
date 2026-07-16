import { describe, it, expect } from 'vitest';
import { computeStyleEvaluationProfile, computeStyleAwareDensityFit } from './styleEvaluation';
import { STYLE_DNA_PRESETS } from './styleDna';

describe('computeStyleEvaluationProfile', () => {
  it('classifies the 3 known 100%-lattice presets as strict-lattice', () => {
    for (const id of ['minimalBotanical', 'boutiquePackaging', 'premiumTextile']) {
      const profile = computeStyleEvaluationProfile(STYLE_DNA_PRESETS[id]);
      expect(profile.regularityClass).toBe('strict-lattice');
      expect(profile.latticeFraction).toBe(1);
    }
  });

  it('classifies the 2 known mixed presets as mixed', () => {
    for (const id of ['luxuryWallpaper', 'vintageHerbarium']) {
      const profile = computeStyleEvaluationProfile(STYLE_DNA_PRESETS[id]);
      expect(profile.regularityClass).toBe('mixed');
      expect(profile.latticeFraction).toBe(0.5);
    }
  });

  it('classifies a purely organic preset as organic', () => {
    const profile = computeStyleEvaluationProfile(STYLE_DNA_PRESETS.organicAbstract);
    expect(profile.regularityClass).toBe('organic');
    expect(profile.latticeFraction).toBe(0);
  });

  it('derives sparse density intent from a high declared negativeSpace', () => {
    const profile = computeStyleEvaluationProfile(STYLE_DNA_PRESETS.minimalBotanical);
    expect(profile.densityIntent).toBe('sparse');
  });

  it('derives dense density intent from a low declared negativeSpace', () => {
    const profile = computeStyleEvaluationProfile(STYLE_DNA_PRESETS.premiumTextile);
    expect(profile.densityIntent).toBe('dense');
  });

  it('derives suppressed hero prominence for minimalRepeat/allOverTextile hierarchy presets', () => {
    for (const id of ['minimalBotanical', 'boutiquePackaging', 'premiumTextile']) {
      const profile = computeStyleEvaluationProfile(STYLE_DNA_PRESETS[id]);
      expect(profile.heroProminenceIntent).toBe('suppressed');
      expect(profile.heroScaleRatio).toBeLessThanOrEqual(1.35);
    }
  });

  it('derives emphasized hero prominence for heroFocus-style presets', () => {
    const profile = computeStyleEvaluationProfile(STYLE_DNA_PRESETS.luxuryFloral);
    expect(profile.heroProminenceIntent).toBe('emphasized');
  });

  it('computes every one of the 15 built-in presets without throwing', () => {
    for (const dna of Object.values(STYLE_DNA_PRESETS)) {
      const profile = computeStyleEvaluationProfile(dna);
      expect(profile.styleId).toBe(dna.id);
      expect(['strict-lattice', 'mixed', 'organic']).toContain(profile.regularityClass);
      expect(['sparse', 'moderate', 'dense']).toContain(profile.densityIntent);
      expect(['suppressed', 'normal', 'emphasized']).toContain(profile.heroProminenceIntent);
    }
  });
});

describe('computeStyleAwareDensityFit', () => {
  it('scores 100 when occupancy exactly matches declared density', () => {
    const profile = computeStyleEvaluationProfile(STYLE_DNA_PRESETS.minimalBotanical);
    const fit = computeStyleAwareDensityFit(30, profile, 0.3);
    expect(fit).toBe(100);
  });

  it('tolerates a sparse style sitting well below its declared density more than a dense style would', () => {
    const sparseProfile = computeStyleEvaluationProfile(STYLE_DNA_PRESETS.minimalBotanical);
    const denseProfile = computeStyleEvaluationProfile(STYLE_DNA_PRESETS.premiumTextile);
    const sparseFit = computeStyleAwareDensityFit(10, sparseProfile, 0.3);
    const denseFit = computeStyleAwareDensityFit(35, denseProfile, 0.55);
    expect(sparseFit).toBeGreaterThan(denseFit);
  });

  it('never returns a value outside [0, 100]', () => {
    const profile = computeStyleEvaluationProfile(STYLE_DNA_PRESETS.minimalBotanical);
    expect(computeStyleAwareDensityFit(0, profile, 0.9)).toBeGreaterThanOrEqual(0);
    expect(computeStyleAwareDensityFit(100, profile, 0)).toBeGreaterThanOrEqual(0);
  });
});
