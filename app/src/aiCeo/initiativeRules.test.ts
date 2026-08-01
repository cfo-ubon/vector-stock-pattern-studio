import { describe, it, expect } from 'vitest';
import { requiresExplicitUserApproval, aiCeoCanMutateQualityDecisions, aiCeoCanAutoSubmit } from './initiativeRules';
import type { AiCeoRecommendation } from './domain/types';

function fakeRecommendation(overrides: Partial<AiCeoRecommendation> = {}): AiCeoRecommendation {
  return {
    id: 'CEOREC-1',
    action: 'USE_EVERGREEN_FALLBACK',
    title: 'x',
    reason: 'x',
    evidenceRefs: [],
    confidence: 'unknown',
    risks: [],
    alternativeAction: null,
    alternativeTitle: null,
    alternativeReason: null,
    dataFreshness: 'INSUFFICIENT_DATA',
    freshnessLabel: 'x',
    expectedImpact: 'x',
    autopilotAction: null,
    navigateTarget: null,
    memoryInfluence: [],
    ...overrides,
  };
}

describe('Module 9 — Initiative Rules', () => {
  it('a recommendation with a real autopilotAction always requires explicit approval', () => {
    expect(requiresExplicitUserApproval(fakeRecommendation({ autopilotAction: { mode: 'FULL_AUTOPILOT', requestedCount: 10 } }))).toBe(true);
  });
  it('a navigation-only recommendation still requires the user to act (open a screen), never auto-executes', () => {
    expect(requiresExplicitUserApproval(fakeRecommendation({ navigateTarget: 'portfolio' }))).toBe(true);
  });
  it('the AI CEO can never mutate quality decisions or auto-submit — compile-time-checkable constants', () => {
    expect(aiCeoCanMutateQualityDecisions()).toBe(false);
    expect(aiCeoCanAutoSubmit()).toBe(false);
  });
});
