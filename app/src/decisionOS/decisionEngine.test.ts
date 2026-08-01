import { describe, it, expect, beforeEach } from 'vitest';
import type { DecisionRequestContext, EvidenceBundle, EvidenceRecord, PolicyDefinition, PolicyEvaluation } from './domain/types';
import type { EffectivePolicy } from './policyEngine';
import { evaluateDecision, resetDecisionCounterForTest, runDecisionSync } from './decisionEngine';
import './index';

const NOW = 1_700_000_000_000;

function record(id: string, overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return { id, source: 'portfolio', label: id, timestamp: NOW, freshness: 'LIVE', completeness: 1, confidenceImpact: 0.5, missingData: [], value: null, ...overrides };
}

function policy(id: string, priority: number, evaluate: PolicyDefinition['evaluate'], impact: PolicyDefinition['impactWhenApplies'] = 'MEDIUM'): EffectivePolicy {
  const definition: PolicyDefinition = {
    id,
    name: id,
    description: 'test',
    domain: 'factory',
    version: 1,
    defaultPriority: priority,
    defaultStatus: 'ENABLED',
    requiredEvidence: [],
    expectedOutcome: 'test',
    impactWhenApplies: impact,
    examples: [],
    evaluate,
  };
  return { definition, status: 'ENABLED', priority, overridden: false };
}

function context(overrides: Partial<DecisionRequestContext> = {}): DecisionRequestContext {
  return { domain: 'factory', requestedAction: null, now: NOW, data: {}, ...overrides };
}

function neutralEvaluation(id: string): PolicyEvaluation {
  return { policyId: id, policyName: id, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: 'no opinion', evidenceIds: [] };
}

describe('decisionEngine.evaluateDecision', () => {
  beforeEach(() => resetDecisionCounterForTest());

  it('Part 11 safety: with zero evidence, refuses to guess and returns Unknown', () => {
    const p = policy('a', 1, () => ({ policyId: 'a', policyName: 'a', domain: 'factory', applies: true, action: 'doThing', blockedReason: null, warning: null, detail: 'fires anyway', evidenceIds: [] }));
    const decision = evaluateDecision([p], { gatheredAt: NOW, records: [] }, context());
    expect(decision.recommendedAction).toBeNull();
    expect(decision.confidence.band).toBe('unknown');
    expect(decision.explanation.some((e) => /not enough evidence/i.test(e))).toBe(true);
  });

  it('a blocking policy refuses the requested action and reports the block reason', () => {
    const evidence: EvidenceBundle = { gatheredAt: NOW, records: [record('e1')] };
    const blocker = policy('block', 1, () => ({ policyId: 'block', policyName: 'block', domain: 'factory', applies: true, action: null, blockedReason: 'readiness too low', warning: null, detail: 'blocked', evidenceIds: ['e1'] }));
    const decision = evaluateDecision([blocker], evidence, context({ requestedAction: 'export' }));
    expect(decision.recommendedAction).toBeNull();
    expect(decision.blockedReasons).toEqual(['readiness too low']);
  });

  it('allowOverride lets a blocked action proceed while still surfacing the block reason', () => {
    const evidence: EvidenceBundle = { gatheredAt: NOW, records: [record('e1')] };
    const blocker = policy('block', 1, () => ({ policyId: 'block', policyName: 'block', domain: 'factory', applies: true, action: null, blockedReason: 'readiness too low', warning: null, detail: 'blocked', evidenceIds: ['e1'] }));
    const decision = evaluateDecision([blocker], evidence, context({ requestedAction: 'export', allowOverride: true }));
    expect(decision.recommendedAction).toBe('export');
    expect(decision.blockedReasons).toEqual(['readiness too low']);
    expect(decision.explanation.some((e) => /explicitly overridden/i.test(e))).toBe(true);
  });

  it('the highest-priority applicable policy wins, and a lower-priority one becomes the alternative', () => {
    const evidence: EvidenceBundle = { gatheredAt: NOW, records: [record('e1', { confidenceImpact: 1 })] };
    const first = policy('first', 1, () => ({ policyId: 'first', policyName: 'first', domain: 'factory', applies: true, action: 'planA', blockedReason: null, warning: null, detail: 'plan A', evidenceIds: ['e1'] }), 'HIGH');
    const second = policy('second', 2, () => ({ policyId: 'second', policyName: 'second', domain: 'factory', applies: true, action: 'planB', blockedReason: null, warning: null, detail: 'plan B', evidenceIds: ['e1'] }));
    const decision = evaluateDecision([second, first], evidence, context());
    expect(decision.recommendedAction).toBe('planA');
    expect(decision.alternative).toEqual({ action: 'planB', reason: 'plan B' });
    expect(decision.policyIds).toContain('first');
    expect(decision.businessImpact).not.toBe('UNKNOWN');
  });

  it('no applicable policy and no requestedAction reports no recommendation, not a guess', () => {
    const evidence: EvidenceBundle = { gatheredAt: NOW, records: [record('e1', { confidenceImpact: 1 })] };
    const inert = policy('inert', 1, () => neutralEvaluation('inert'));
    const decision = evaluateDecision([inert], evidence, context());
    expect(decision.recommendedAction).toBeNull();
    expect(decision.businessImpact).toBe('UNKNOWN');
  });

  it('every decision carries a non-empty explanation and a stable, unique id', () => {
    const evidence: EvidenceBundle = { gatheredAt: NOW, records: [record('e1', { confidenceImpact: 1 })] };
    const p = policy('a', 1, () => ({ policyId: 'a', policyName: 'a', domain: 'factory', applies: true, action: 'doThing', blockedReason: null, warning: null, detail: 'fires', evidenceIds: ['e1'] }));
    const d1 = evaluateDecision([p], evidence, context());
    const d2 = evaluateDecision([p], evidence, context());
    expect(d1.explanation.length).toBeGreaterThan(0);
    expect(d1.id).not.toBe(d2.id);
  });
});

describe('decisionEngine.runDecisionSync', () => {
  it('evaluates against the real registered policies without any IndexedDB read (synchronous, no overrides applied)', () => {
    const decision = runDecisionSync(
      { domain: 'marketplace', requestedAction: null, now: NOW, data: { mission: { hasLiveEvidence: true, note: 'A scored opportunity exists', confidenceBand: 'high', timestamp: NOW } } },
      ['mission', 'portfolio'],
    );
    expect(decision.recommendedAction).toBe('targetMarketEvidence');
  });
});
