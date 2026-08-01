import { describe, it, expect, beforeEach } from 'vitest';
import { recordDecisionTimelineEntry, loadDecisionTimeline, clearDecisionTimelineForTest } from './decisionTimelineStore';
import type { DecisionTimelineEntry } from '../domain/types';

const NOW = 1_700_000_000_000;

function entry(overrides: Partial<DecisionTimelineEntry> = {}): DecisionTimelineEntry {
  return {
    id: 'DEC-1',
    domain: 'factory',
    decisionId: 'DEC-1',
    requestedAction: null,
    recommendedAction: 'doThing',
    businessImpact: 'MEDIUM',
    confidenceScore: 80,
    confidenceBand: 'high',
    blockedReasons: [],
    warnings: [],
    explanation: ['recommended by test policy'],
    policyIds: ['p1'],
    evidenceIds: ['e1'],
    createdAt: NOW,
    ...overrides,
  };
}

beforeEach(async () => {
  await clearDecisionTimelineForTest();
});

describe('decisionTimelineStore', () => {
  it('round-trips a recorded entry through IndexedDB', async () => {
    await recordDecisionTimelineEntry(entry());
    const all = await loadDecisionTimeline();
    expect(all).toHaveLength(1);
    expect(all[0].decisionId).toBe('DEC-1');
  });

  it('is append-only in practice: each recorded entry keeps its own id and both persist', async () => {
    await recordDecisionTimelineEntry(entry({ id: 'DEC-1', decisionId: 'DEC-1' }));
    await recordDecisionTimelineEntry(entry({ id: 'DEC-2', decisionId: 'DEC-2' }));
    const all = await loadDecisionTimeline();
    expect(all.map((e) => e.decisionId).sort()).toEqual(['DEC-1', 'DEC-2']);
  });

  it('clearDecisionTimelineForTest empties the store', async () => {
    await recordDecisionTimelineEntry(entry());
    await clearDecisionTimelineForTest();
    expect(await loadDecisionTimeline()).toHaveLength(0);
  });
});
