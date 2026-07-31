import { describe, it, expect } from 'vitest';
import {
  createMarketingDesignHandoff,
  transitionMarketingDesignHandoffWorkflow,
  getMarketingDesignHandoffWorkflowStatus,
  isValidMarketingDesignHandoff,
  InvalidMarketingDesignHandoffInputError,
} from './marketingDesignHandoff';

// Build 028C — MarketingDesignHandoff: the one record spanning the whole
// Marketing -> Creative Director workflow.

describe('createMarketingDesignHandoff', () => {
  it('creates a record that already reflects two real, already-happened events (MARKETING_RESEARCH, OPPORTUNITY_SELECTED)', () => {
    const handoff = createMarketingDesignHandoff({
      marketOpportunityId: 'OPP-20260101-AAAAAA',
      recommendedTheme: 'spring florals',
      now: 1000,
    });
    expect(handoff.workflowHistory.map((h) => h.status)).toEqual(['MARKETING_RESEARCH', 'OPPORTUNITY_SELECTED']);
    expect(getMarketingDesignHandoffWorkflowStatus(handoff)).toBe('OPPORTUNITY_SELECTED');
    expect(handoff.createdAt).toBe(1000);
    expect(handoff.updatedAt).toBe(1000);
    expect(isValidMarketingDesignHandoff(handoff)).toBe(true);
  });

  it('honestly defaults every unset provenance field rather than fabricating one', () => {
    const handoff = createMarketingDesignHandoff({ recommendedTheme: 'from a gap, no opportunity yet' });
    expect(handoff.marketSnapshotId).toBeNull();
    expect(handoff.marketOpportunityId).toBeNull();
    expect(handoff.dailyMissionId).toBeNull();
    expect(handoff.opportunityScore).toBeNull();
    expect(handoff.confidence).toBe('unknown');
    expect(handoff.heroMotif).toBeNull();
    expect(handoff.composition).toBeNull();
    expect(handoff.palette).toEqual([]);
    expect(handoff.productionTiming).toBeNull();
    expect(handoff.creativeBriefId).toBeNull();
    expect(handoff.collectionPlanId).toBeNull();
    expect(handoff.collectionItemId).toBeNull();
    expect(handoff.generatorHandoffId).toBeNull();
  });

  it('rejects an empty recommendedTheme', () => {
    expect(() => createMarketingDesignHandoff({ recommendedTheme: '' })).toThrow(InvalidMarketingDesignHandoffInputError);
    expect(() => createMarketingDesignHandoff({ recommendedTheme: '   ' })).toThrow(InvalidMarketingDesignHandoffInputError);
  });
});

describe('transitionMarketingDesignHandoffWorkflow', () => {
  it('appends a new workflow status while merging in a field patch, bumping updatedAt', () => {
    const handoff = createMarketingDesignHandoff({ recommendedTheme: 'spring florals', now: 1000 });
    const updated = transitionMarketingDesignHandoffWorkflow({ ...handoff, creativeBriefId: 'BRF-20260101-AAAAAA' }, 'BRIEF_DRAFT', 2000);
    expect(updated.creativeBriefId).toBe('BRF-20260101-AAAAAA');
    expect(getMarketingDesignHandoffWorkflowStatus(updated)).toBe('BRIEF_DRAFT');
    expect(updated.updatedAt).toBe(2000);
    // Prior history entries are preserved, never overwritten.
    expect(updated.workflowHistory).toHaveLength(3);
    expect(updated.workflowHistory[0]).toEqual(handoff.workflowHistory[0]);
  });

  it('walks through the full workflow, recording every transition in order (requirement #11 audit trail)', () => {
    let handoff = createMarketingDesignHandoff({ recommendedTheme: 'spring florals', now: 1 });
    handoff = transitionMarketingDesignHandoffWorkflow(handoff, 'BRIEF_DRAFT', 2);
    handoff = transitionMarketingDesignHandoffWorkflow(handoff, 'BRIEF_REVIEW', 3);
    handoff = transitionMarketingDesignHandoffWorkflow(handoff, 'BRIEF_APPROVED', 4);
    handoff = transitionMarketingDesignHandoffWorkflow(handoff, 'COLLECTION_PLANNED', 5);
    handoff = transitionMarketingDesignHandoffWorkflow(handoff, 'COLLECTION_ITEM_SELECTED', 6);
    handoff = transitionMarketingDesignHandoffWorkflow(handoff, 'HANDOFF_REVIEW', 7);
    handoff = transitionMarketingDesignHandoffWorkflow(handoff, 'READY_FOR_GENERATOR', 8);
    handoff = transitionMarketingDesignHandoffWorkflow(handoff, 'GENERATING', 9);
    handoff = transitionMarketingDesignHandoffWorkflow(handoff, 'GENERATED', 10);
    handoff = transitionMarketingDesignHandoffWorkflow(handoff, 'DESIGN_REVIEW', 11);
    handoff = transitionMarketingDesignHandoffWorkflow(handoff, 'READY_FOR_PORTFOLIO', 12);
    expect(handoff.workflowHistory.map((h) => h.status)).toEqual([
      'MARKETING_RESEARCH',
      'OPPORTUNITY_SELECTED',
      'BRIEF_DRAFT',
      'BRIEF_REVIEW',
      'BRIEF_APPROVED',
      'COLLECTION_PLANNED',
      'COLLECTION_ITEM_SELECTED',
      'HANDOFF_REVIEW',
      'READY_FOR_GENERATOR',
      'GENERATING',
      'GENERATED',
      'DESIGN_REVIEW',
      'READY_FOR_PORTFOLIO',
    ]);
    expect(handoff.workflowHistory.map((h) => h.at)).toEqual([1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe('isValidMarketingDesignHandoff', () => {
  it('rejects malformed values', () => {
    expect(isValidMarketingDesignHandoff(null)).toBe(false);
    expect(isValidMarketingDesignHandoff({})).toBe(false);
    expect(isValidMarketingDesignHandoff({ id: 'x', recommendedTheme: 'y', confidence: 'not-a-band', workflowHistory: [], evidenceRefs: [], createdAt: 1, updatedAt: 1 })).toBe(false);
  });
});
