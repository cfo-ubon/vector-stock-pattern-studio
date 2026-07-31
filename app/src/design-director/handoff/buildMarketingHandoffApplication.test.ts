import { describe, it, expect } from 'vitest';
import { createMarketOpportunity } from '../../marketing/domain/marketOpportunity';
import { createMarketSnapshot } from '../../marketing/domain/marketSnapshot';
import { createDailyMission } from '../../marketing/domain/dailyMission';
import { createMarketKeyword } from '../../marketing/domain/marketKeyword';
import type { OpportunityScoreResult } from '../../marketing/scoring/opportunityScoring';
import type { EvidenceBand } from '../../marketing/domain/evidence';
import {
  buildMarketingHandoffApplication,
  buildMarketingHandoffApplicationFromGap,
  buildMarketingDesignHandoffInput,
  buildCreativeBriefDraftInput,
  type MarketingHandoffField,
} from './buildMarketingHandoffApplication';

// Build 028C — field-mapping builder tests: real provenance, 3-tier
// missing-data semantics (requirements #7/#8), and lock/edit behavior
// (requirement #5) for the "ส่งให้นักออกแบบ / Send to Creative Director"
// review screen.

function fakeScore(overall: number, confidence: EvidenceBand): OpportunityScoreResult {
  return { components: [], overall, band: 'Test Band', confidence, missingDimensions: [], scoringProfileId: 'SCP-test' };
}

function makeOpportunity(overrides: { confidence?: EvidenceBand } = {}) {
  return createMarketOpportunity({
    snapshotId: 'SNAP-20260101-AAAAAA',
    title: 'Spring Florals Opportunity',
    theme: 'spring florals',
    niche: 'home decor',
    marketplace: 'Etsy',
    score: fakeScore(78, overrides.confidence ?? 'high'),
    evidenceRefs: ['obs:OBS-1', 'obs:OBS-2'],
    now: 1000,
  });
}

function makeSnapshot() {
  return createMarketSnapshot({
    researchDateRange: { from: 0, to: 1000 },
    marketplaces: ['Etsy'],
    regions: ['US'],
    keywords: ['spring florals'],
    themes: ['spring florals'],
    niches: ['home decor'],
    motifs: ['tulip'],
    styles: ['watercolor'],
    colors: ['#ffffff', '#ffb6c1'],
    seasons: ['spring'],
    productUseCases: ['giftWrap'],
    observedCompetition: 'medium',
    observedDemand: 'high',
    confidence: 'high',
    evidenceRefs: ['obs:OBS-1'],
    now: 500,
  });
}

function makeMission(overrides: Partial<Parameters<typeof createDailyMission>[0]> = {}) {
  return createDailyMission({
    date: 2000,
    opportunityId: 'OPP-20260101-AAAAAA',
    primaryMarketplace: 'Etsy',
    niche: 'home decor',
    theme: 'spring florals',
    category: 'botanical',
    heroMotif: 'Tulip bouquet',
    opportunityScore: 78,
    confidence: 'high',
    evidenceFreshness: '2 days old',
    composition: 'balanced-toss',
    colorDirection: ['#ffffff', '#ffb6c1'],
    buyerGroup: 'gift buyers',
    productUseCases: ['giftWrap'],
    submissionTiming: 'Q2',
    ...overrides,
  });
}

describe('buildMarketingHandoffApplication — with a Daily Mission (rich case)', () => {
  it('maps every field with real provenance and status "provided"', () => {
    const opportunity = makeOpportunity();
    const snapshot = makeSnapshot();
    const mission = makeMission();
    const { fields, handoffSeed } = buildMarketingHandoffApplication(opportunity, snapshot, mission);

    const byKey = new Map(fields.map((f) => [f.key, f]));
    expect(byKey.get('theme')?.value).toBe('spring florals');
    expect(byKey.get('theme')?.source).toBe('marketOpportunity');
    expect(byKey.get('theme')?.status).toBe('provided');

    expect(byKey.get('heroMotif')?.value).toBe('Tulip bouquet');
    expect(byKey.get('heroMotif')?.source).toBe('dailyMission');
    expect(byKey.get('heroMotif')?.status).toBe('provided');

    expect(byKey.get('composition')?.value).toBe('balanced-toss');
    expect(byKey.get('palette')?.value).toEqual(['#ffffff', '#ffb6c1']);
    expect(byKey.get('targetProducts')?.value).toEqual(['giftWrap']);
    expect(byKey.get('productionTiming')?.value).toBe('Q2');
    expect(byKey.get('buyerPersona')?.value).toBe('gift buyers');

    // Every field starts unlocked (apply by default).
    expect(fields.every((f) => f.locked === false)).toBe(true);

    // The handoff seed carries the same real values, for the
    // MarketingDesignHandoff record itself (requirement #2).
    expect(handoffSeed.marketOpportunityId).toBe(opportunity.id);
    expect(handoffSeed.dailyMissionId).toBe(mission.id);
    expect(handoffSeed.marketSnapshotId).toBe(opportunity.snapshotId);
    expect(handoffSeed.recommendedTheme).toBe('spring florals');
  });

  it('grades a low-confidence mission field as notSupportedByEvidence, never silently trusted', () => {
    const opportunity = makeOpportunity();
    const snapshot = makeSnapshot();
    const mission = makeMission({ confidence: 'very-low' });
    const { fields } = buildMarketingHandoffApplication(opportunity, snapshot, mission);
    const heroMotif = fields.find((f) => f.key === 'heroMotif')!;
    expect(heroMotif.status).toBe('notSupportedByEvidence');
  });
});

describe('buildMarketingHandoffApplication — no Daily Mission (opportunity-only case)', () => {
  it('reports mission-only evidence fields as notProvided and creative-judgment fields as needsUserDecision', () => {
    const opportunity = makeOpportunity();
    const { fields } = buildMarketingHandoffApplication(opportunity, null, null);
    const byKey = new Map(fields.map((f) => [f.key, f]));

    // Evidence-only fields with no mission: honestly "not provided".
    expect(byKey.get('targetProducts')?.status).toBe('notProvided');
    expect(byKey.get('productionTiming')?.status).toBe('notProvided');
    expect(byKey.get('buyerPersona')?.status).toBe('notProvided');
    expect(byKey.get('palette')?.status).toBe('notProvided');

    // Creative-judgment fields: distinctly flagged as needing a human decision.
    expect(byKey.get('heroMotif')?.status).toBe('needsUserDecision');
    expect(byKey.get('composition')?.status).toBe('needsUserDecision');

    // Opportunity-sourced fields are still real and provided.
    expect(byKey.get('theme')?.status).toBe('provided');
    expect(byKey.get('targetMarketplace')?.status).toBe('provided');
  });

  it('never fabricates a value for a missing field — value stays null/empty, not a guess', () => {
    const opportunity = makeOpportunity();
    const { fields } = buildMarketingHandoffApplication(opportunity, null, null);
    const heroMotif = fields.find((f) => f.key === 'heroMotif')!;
    expect(heroMotif.value).toBeNull();
    expect(heroMotif.displayValue).toBe('—');
  });
});

describe('buildMarketingHandoffApplicationFromGap — Market Gap Finder entry point', () => {
  it('builds an application with no Market Opportunity id, deriving theme/marketplace/products from the keyword alone', () => {
    const keyword = createMarketKeyword({
      keyword: 'terrazzo coasters',
      cluster: 'subject',
      evidenceSource: 'LOCAL_SALES_DATA',
      parentTheme: 'terrazzo',
      marketplace: 'Etsy',
      productRelevance: ['coasters'],
      confidence: 'medium',
      now: 1,
    });
    const { fields, handoffSeed } = buildMarketingHandoffApplicationFromGap(keyword);
    expect(handoffSeed.marketOpportunityId).toBeNull();
    expect(handoffSeed.recommendedTheme).toBe('terrazzo');
    const byKey = new Map(fields.map((f) => [f.key, f]));
    expect(byKey.get('theme')?.source).toBe('marketGap');
    expect(byKey.get('heroMotif')?.status).toBe('needsUserDecision');
    expect(byKey.get('collectionName')?.status).toBe('needsUserDecision');
  });
});

describe('buildMarketingDesignHandoffInput / buildCreativeBriefDraftInput — lock + edit behavior', () => {
  it('a locked field falls back to the handoff seed default and is excluded from unresolvedFieldKeys consideration for the brief', () => {
    const opportunity = makeOpportunity();
    const mission = makeMission();
    const { fields, handoffSeed } = buildMarketingHandoffApplication(opportunity, null, mission);
    const locked: MarketingHandoffField[] = fields.map((f) => (f.key === 'heroMotif' ? { ...f, locked: true } : f));

    const handoffInput = buildMarketingDesignHandoffInput(locked, handoffSeed);
    // Locked field falls back to the seed's own value (still the real mission value here, since seed = unedited source).
    expect(handoffInput.heroMotif).toBe(handoffSeed.heroMotif);

    const briefInput = buildCreativeBriefDraftInput(locked, handoffSeed.marketOpportunityId ?? null, handoffSeed.confidence ?? 'unknown');
    expect(briefInput.heroStyle).toBe(''); // heroMotif field is locked -> excluded from the brief draft
    expect(briefInput.sourceOpportunityId).toBe(opportunity.id);
    expect(briefInput.theme).toBe('spring florals');
  });

  it('an edited (user-override) field value flows into both the handoff record and the Creative Brief draft', () => {
    const opportunity = makeOpportunity();
    const { fields, handoffSeed } = buildMarketingHandoffApplication(opportunity, null, null);
    const edited: MarketingHandoffField[] = fields.map((f) => (f.key === 'heroMotif' ? { ...f, value: 'Peony bouquet', source: 'userOverride' as const } : f));

    const handoffInput = buildMarketingDesignHandoffInput(edited, handoffSeed);
    expect(handoffInput.heroMotif).toBe('Peony bouquet');

    const briefInput = buildCreativeBriefDraftInput(edited, handoffSeed.marketOpportunityId ?? null, handoffSeed.confidence ?? 'unknown');
    expect(briefInput.heroStyle).toBe('Peony bouquet');
  });

  it('unresolvedFieldKeys lists every non-locked field whose status was not "provided" (requirement #6 missing-information detection)', () => {
    const opportunity = makeOpportunity();
    const { fields, handoffSeed } = buildMarketingHandoffApplication(opportunity, null, null);
    const handoffInput = buildMarketingDesignHandoffInput(fields, handoffSeed);
    expect(handoffInput.unresolvedFieldKeys).toEqual(expect.arrayContaining(['heroMotif', 'composition', 'targetProducts', 'productionTiming', 'buyerPersona', 'palette']));
    expect(handoffInput.unresolvedFieldKeys).not.toContain('theme');
  });

  it('locking out an unresolved field removes it from unresolvedFieldKeys (the user has explicitly deferred it)', () => {
    const opportunity = makeOpportunity();
    const { fields, handoffSeed } = buildMarketingHandoffApplication(opportunity, null, null);
    const locked = fields.map((f) => (f.key === 'heroMotif' ? { ...f, locked: true } : f));
    const handoffInput = buildMarketingDesignHandoffInput(locked, handoffSeed);
    expect(handoffInput.unresolvedFieldKeys).not.toContain('heroMotif');
  });
});
