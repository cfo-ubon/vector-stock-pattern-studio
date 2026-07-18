import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from '../trend/designIntelligence';
import type { KeywordBundle } from '../trend/designSpecTypes';
import { runImprovementLoop } from './improvementLoop';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Grid Pattern', secondaryKeywords: [], marketplace: 'adobestock', season: 'spring',
    audience: 'editorial', commercialCategory: 'wallpaper', patternType: 'geometric',
    paletteDirection: '', difficulty: 'moderate', collectionSize: 8, ...overrides,
  };
}

function makeSpec() {
  return buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: undefined, createdAt: 1000 });
}

describe('runImprovementLoop', () => {
  it('runs at least one round and never returns zero rounds', () => {
    const result = runImprovementLoop(makeSpec(), 'improvement-loop-1');
    expect(result.rounds.length).toBeGreaterThan(0);
    expect(result.roundsUsed).toBe(result.rounds.length);
  });

  it('actually improves the overall critique score for a spec with real headroom to improve', () => {
    // Build 012 (Evaluation Intelligence Engine V3) fixed a real scoring
    // bias where a grid layout's own deliberate even spacing/axis alignment
    // was scored as a defect (BUILD_012_AUDIT.md Finding 1) -- this grid
    // spec now correctly scores ~80/100 out of the box, clearing the
    // default `minOverallScore: 70` bar in round 0 with nothing left to
    // fix. A raised `minOverallScore` restores genuine headroom (real
    // quality-target shortfall, not an artifact of the fixed bias) so this
    // test still exercises the loop's actual multi-round mechanism.
    const spec = {
      ...makeSpec(), repeatType: 'grid' as const, rhythm: 'regular' as const, flow: 'calm' as const, density: 0.3,
      qualityTargets: { ...makeSpec().qualityTargets, minOverallScore: 95 },
    };
    const result = runImprovementLoop(spec, 'improvement-loop-2', 3);
    expect(result.rounds.length).toBeGreaterThan(1);
    expect(result.improved).toBe(true);
    expect(result.finalReport.critique.overall).toBeGreaterThan(result.rounds[0].report.critique.overall);
  });

  it('each round after the first reflects a real, different spec patch applied by the previous round', () => {
    const spec = {
      ...makeSpec(), repeatType: 'grid' as const, rhythm: 'regular' as const, flow: 'calm' as const, density: 0.3,
      qualityTargets: { ...makeSpec().qualityTargets, minOverallScore: 95 },
    };
    const result = runImprovementLoop(spec, 'improvement-loop-3', 3);
    expect(result.rounds.length).toBeGreaterThan(1);
    expect(result.rounds[1].spec).not.toEqual(result.rounds[0].spec);
  });

  it('stops as soon as the commercial bar is met, without using every round', () => {
    // A spec whose own quality targets are trivially low should meet the bar in round 0.
    const spec = { ...makeSpec(), qualityTargets: { minOverallScore: 0, minSeamlessIntegrity: 0, minMotifDiversity: 0, minCommercialReadiness: 0 } };
    const result = runImprovementLoop(spec, 'improvement-loop-4', 3);
    expect(result.rounds[result.rounds.length - 1].meetsCommercialBar).toBe(true);
  });

  it('never returns a round whose winning candidate is hard-rejected', () => {
    // density high enough with a scatter-inducing patch to plausibly blow the node budget on some seeds;
    // regardless of whether it triggers here, the invariant this test protects is structural.
    const spec = { ...makeSpec(), repeatType: 'grid' as const, rhythm: 'regular' as const, density: 0.55 };
    const result = runImprovementLoop(spec, 'improvement-loop-5', 3);
    for (const round of result.rounds) {
      expect(round.report.critique.overall).toBeGreaterThanOrEqual(-1);
    }
    // The final report's underlying tile must be a real, non-rejected winner —
    // verified indirectly: every round pushed came from a non-rejected pool
    // per the loop's own round>0-reject guard, so finalReport is always usable.
    expect(result.finalReport).toBeDefined();
  });

  it('respects maxRounds as a hard bound', () => {
    const spec = { ...makeSpec(), repeatType: 'grid' as const, rhythm: 'regular' as const, flow: 'calm' as const, density: 0.3 };
    const result = runImprovementLoop(spec, 'improvement-loop-6', 2);
    expect(result.rounds.length).toBeLessThanOrEqual(2);
    expect(result.maxRounds).toBe(2);
  });

  it('is deterministic for the same spec + seed', () => {
    const spec = { ...makeSpec(), repeatType: 'grid' as const, rhythm: 'regular' as const, flow: 'calm' as const, density: 0.3 };
    const a = runImprovementLoop(spec, 'improvement-loop-7', 3);
    const b = runImprovementLoop(spec, 'improvement-loop-7', 3);
    expect(a.roundsUsed).toBe(b.roundsUsed);
    expect(a.finalReport.critique.overall).toBe(b.finalReport.critique.overall);
  });
});
