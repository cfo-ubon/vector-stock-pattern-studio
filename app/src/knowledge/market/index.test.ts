import { describe, it, expect } from 'vitest';
import { MarketKnowledge } from '..';

describe('MarketKnowledge facade', () => {
  it('re-exports real Marketing Intelligence functions, not stubs', () => {
    const source = MarketKnowledge.createResearchSource({ sourceType: 'etsy', sourceTitle: 'x', now: 1000 });
    expect(source.id).toMatch(/^SRC-\d{8}-[0-9A-Z]{6}$/);

    const observation = MarketKnowledge.createMarketObservation({
      sourceType: 'etsy',
      evidenceStatus: 'USER_OBSERVATION',
      now: 1000,
    });
    expect(observation.evidenceStatus).toBe('USER_OBSERVATION');

    const snapshot = MarketKnowledge.createMarketSnapshot({
      researchDateRange: { from: 0, to: 1000 },
      evidenceRefs: [observation.id],
      now: 1000,
    });
    expect(snapshot.sourceCount).toBe(1);
  });

  it('exposes the evidence provenance enum values', () => {
    expect(MarketKnowledge.EVIDENCE_STATUS_VALUES).toContain('SAMPLE_DATA');
    expect(MarketKnowledge.EVIDENCE_STATUS_VALUES).toContain('VERIFIED_SOURCE');
  });
});
