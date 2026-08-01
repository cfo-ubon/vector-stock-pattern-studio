import { describe, it, expect, beforeEach } from 'vitest';
import type { DecisionRequestContext, EvidenceRecord } from './domain/types';
import { registerEvidenceProvider, resetEvidenceProvidersForTest, gatherEvidence, classifyFreshness, EvidenceCache } from './evidenceEngine';

const NOW = 1_700_000_000_000;

function makeRecord(id: string, source: EvidenceRecord['source']): EvidenceRecord {
  return { id, source, label: id, timestamp: NOW, freshness: 'LIVE', completeness: 1, confidenceImpact: 0.5, missingData: [], value: null };
}

function makeContext(data: Record<string, unknown> = {}): DecisionRequestContext {
  return { domain: 'factory', requestedAction: null, now: NOW, data };
}

describe('evidenceEngine', () => {
  beforeEach(() => {
    resetEvidenceProvidersForTest();
  });

  it('classifyFreshness returns UNKNOWN for a zero/missing timestamp, LIVE within a minute, RECENT within a week, STALE beyond', () => {
    expect(classifyFreshness(0, NOW)).toBe('UNKNOWN');
    expect(classifyFreshness(NOW - 1000, NOW)).toBe('LIVE');
    expect(classifyFreshness(NOW - 2 * 24 * 60 * 60 * 1000, NOW)).toBe('RECENT');
    expect(classifyFreshness(NOW - 30 * 24 * 60 * 60 * 1000, NOW)).toBe('STALE');
  });

  it('gathers evidence from every registered source requested, deduped by record id', () => {
    registerEvidenceProvider('portfolio', () => [makeRecord('portfolio:x', 'portfolio')]);
    registerEvidenceProvider('qa', () => [makeRecord('qa:y', 'qa')]);
    const bundle = gatherEvidence(makeContext(), ['portfolio', 'qa']);
    expect(bundle.records.map((r) => r.id).sort()).toEqual(['portfolio:x', 'qa:y']);
  });

  it('an unregistered source silently contributes zero records (never throws)', () => {
    const bundle = gatherEvidence(makeContext(), ['collection']);
    expect(bundle.records).toEqual([]);
  });

  it('EvidenceCache only calls a provider once per source even across multiple gatherEvidence calls', () => {
    let calls = 0;
    registerEvidenceProvider('portfolio', () => {
      calls += 1;
      return [makeRecord('portfolio:x', 'portfolio')];
    });
    const cache = new EvidenceCache();
    gatherEvidence(makeContext(), ['portfolio'], cache);
    gatherEvidence(makeContext(), ['portfolio'], cache);
    expect(calls).toBe(1);
    expect(cache.callCount).toBe(1);
  });

  it('two independent EvidenceCache instances do not share state', () => {
    let calls = 0;
    registerEvidenceProvider('portfolio', () => {
      calls += 1;
      return [makeRecord('portfolio:x', 'portfolio')];
    });
    gatherEvidence(makeContext(), ['portfolio'], new EvidenceCache());
    gatherEvidence(makeContext(), ['portfolio'], new EvidenceCache());
    expect(calls).toBe(2);
  });
});
