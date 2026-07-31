import { describe, it, expect } from 'vitest';
import { buildGeneratorHandoffApplication, applyMappedFieldsToParams } from './applyGeneratorHandoff';
import { createCreativeBrief } from '../domain/creativeBrief';
import { createCollectionPlan } from '../domain/collectionPlan';
import { createGeneratorHandoff } from '../domain/generatorHandoff';
import { createMarketOpportunity } from '../../marketing/domain/marketOpportunity';
import { defaultParams } from '../../engine/defaults';

function makeBrief() {
  return createCreativeBrief({ collectionName: 'Christmas Botanical', theme: 'christmas botanical', sourceOpportunityId: 'OPP-1', now: 1 });
}

function makePlan(briefId: string) {
  return createCollectionPlan({
    briefId,
    name: 'Plan',
    theme: 'christmas botanical',
    totalSize: 10,
    patternTypeCounts: { hero: 1, secondary: 1, blender: 1, stripe: 1, border: 1, coordinate: 1, miniPattern: 1, texture: 1 },
    targetProducts: ['wallpaper'],
    now: 2,
  });
}

describe('buildGeneratorHandoffApplication', () => {
  it('maps categoryId, layout, density, patternScale, palette, and seed to real GenerateParams fields', () => {
    const brief = makeBrief();
    const plan = makePlan(brief.id);
    const handoff = createGeneratorHandoff({
      briefId: brief.id,
      collectionPlanId: plan.id,
      heroMotif: 'Poinsettia bouquet',
      categoryId: 'botanical',
      composition: 'layered-cluster',
      density: 0.7,
      scale: 'large',
      palette: ['#111111', '#222222'],
      now: 3,
    });

    const application = buildGeneratorHandoffApplication(handoff, brief, plan, null);
    const byKey = Object.fromEntries(application.mappedFields.map((f) => [f.key, f]));

    expect(byKey.categoryId.value).toBe('botanical');
    expect(byKey.layoutId.value).toBe('densePremium');
    expect(byKey.density.value).toBe(0.7);
    expect(byKey.patternScale.value).toBe(1.25);
    expect(byKey.customColors.value).toEqual(['#111111', '#222222']);
    expect(byKey.seed.value).toBe(handoff.seedStrategy);
    // Every mapped field always carries a non-empty rationale.
    for (const field of application.mappedFields) {
      expect(field.rationale.length).toBeGreaterThan(0);
    }
  });

  it('omits customColors from mappedFields when the handoff has no palette', () => {
    const brief = makeBrief();
    const plan = makePlan(brief.id);
    const handoff = createGeneratorHandoff({ briefId: brief.id, collectionPlanId: plan.id, heroMotif: 'Hero', categoryId: 'geometric', now: 3 });
    const application = buildGeneratorHandoffApplication(handoff, brief, plan, null);
    expect(application.mappedFields.some((f) => f.key === 'customColors')).toBe(false);
  });

  it('reports hero/secondary motifs, complexity, spacing, colorway plan, and commercial notes as unmapped with an explanatory note', () => {
    const brief = makeBrief();
    const plan = makePlan(brief.id);
    const handoff = createGeneratorHandoff({ briefId: brief.id, collectionPlanId: plan.id, heroMotif: 'Poinsettia', categoryId: 'botanical', now: 3 });
    const application = buildGeneratorHandoffApplication(handoff, brief, plan, null);
    const labels = application.unmappedNotes.map((n) => n.label);
    expect(labels).toEqual(expect.arrayContaining(['Hero motif', 'Secondary motifs', 'Complexity', 'Spacing', 'Colorway plan', 'Commercial notes']));
    for (const note of application.unmappedNotes) {
      expect(note.note.length).toBeGreaterThan(0);
    }
  });

  it('builds full traceability lineage, preferring the resolved MarketOpportunity over the brief\'s own reference', () => {
    const brief = makeBrief();
    const plan = makePlan(brief.id);
    const handoff = createGeneratorHandoff({ briefId: brief.id, collectionPlanId: plan.id, heroMotif: 'Hero', categoryId: 'botanical', now: 5 });
    const opportunity = createMarketOpportunity({
      snapshotId: 'SNAP-1',
      title: 'Christmas Botanical Opportunity',
      theme: 'christmas botanical',
      niche: 'home decor',
      marketplace: 'shutterstock',
      score: { overallScore: 80, confidence: 'high', dimensionScores: [], excludedDimensions: [], evidenceRefs: [] } as unknown as ReturnType<typeof createMarketOpportunity>['score'],
      evidenceRefs: [],
      now: 6,
    });

    const application = buildGeneratorHandoffApplication(handoff, brief, plan, opportunity);
    expect(application.lineage).toMatchObject({
      marketSnapshotId: 'SNAP-1',
      marketOpportunityId: opportunity.id,
      designBriefId: brief.id,
      collectionPlanId: plan.id,
      collectionItemId: null,
      generatorHandoffId: handoff.id,
      generatorVersion: handoff.generatorVersion,
      seed: handoff.seedStrategy,
    });
    expect(application.lineage.appliedAt).toBeGreaterThan(0);
  });

  it('falls back to the brief\'s own sourceOpportunityId when no MarketOpportunity is resolved', () => {
    const brief = makeBrief();
    const plan = makePlan(brief.id);
    const handoff = createGeneratorHandoff({ briefId: brief.id, collectionPlanId: plan.id, heroMotif: 'Hero', categoryId: 'botanical', now: 5 });
    const application = buildGeneratorHandoffApplication(handoff, brief, plan, null);
    expect(application.lineage.marketOpportunityId).toBe('OPP-1');
    expect(application.lineage.marketSnapshotId).toBeNull();
  });
});

describe('applyMappedFieldsToParams', () => {
  it('applies only the caller-selected fields, leaving every excluded ("locked") field at its current value', () => {
    const brief = makeBrief();
    const plan = makePlan(brief.id);
    const handoff = createGeneratorHandoff({ briefId: brief.id, collectionPlanId: plan.id, heroMotif: 'Hero', categoryId: 'geometric', density: 0.9, now: 3 });
    const application = buildGeneratorHandoffApplication(handoff, brief, plan, null);

    const base = defaultParams();
    const originalLayoutId = base.layoutId;
    // Simulate the reviewer locking the "layoutId" field — it's excluded
    // from the fields actually passed to applyMappedFieldsToParams.
    const selected = application.mappedFields.filter((f) => f.key !== 'layoutId');
    const applied = applyMappedFieldsToParams(base, selected, application.lineage);

    expect(applied.categoryId).toBe('geometric');
    expect(applied.density).toBe(0.9);
    expect(applied.layoutId).toBe(originalLayoutId); // untouched — was locked
    expect(applied.sourceLineage).toEqual(application.lineage);
  });

  it('applies every mapped field when none are locked', () => {
    const brief = makeBrief();
    const plan = makePlan(brief.id);
    const handoff = createGeneratorHandoff({ briefId: brief.id, collectionPlanId: plan.id, heroMotif: 'Hero', categoryId: 'mandala', composition: 'grid', now: 3 });
    const application = buildGeneratorHandoffApplication(handoff, brief, plan, null);
    const applied = applyMappedFieldsToParams(defaultParams(), application.mappedFields, application.lineage);
    expect(applied.categoryId).toBe('mandala');
    expect(applied.layoutId).toBe('grid');
    expect(applied.sourceLineage?.generatorHandoffId).toBe(handoff.id);
  });
});
