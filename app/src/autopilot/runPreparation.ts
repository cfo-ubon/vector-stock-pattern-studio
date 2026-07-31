import { COLLECTION_PATTERN_TYPE_VALUES, type CollectionPatternType, type PatternTypeCounts, createCollectionPlan, type CollectionPlan } from '../design-director/domain/collectionPlan';
import { createCreativeBrief, type CreativeBrief } from '../design-director/domain/creativeBrief';
import { createMarketingDesignHandoff, transitionMarketingDesignHandoffWorkflow, type MarketingDesignHandoff } from '../design-director/domain/marketingDesignHandoff';
import { transitionAutonomousDesignRun, type AutonomousDesignRun } from './domain/autonomousDesignRun';
import { getDesignPlanDecision, type DesignPlan } from './domain/designPlan';

// Build 029, Module 6, steps 1-5 — "freeze the Design Plan" and create the
// real MarketingDesignHandoff -> Creative Brief -> Collection Plan chain,
// reusing the exact Build 028B/028C domain constructors (never a parallel
// autopilot-only record shape). Every id these produce is what
// `generationOrchestrator.ts` (steps 6-12) and Module 10's traceability
// requirement thread through to each generated pattern.

function emptyPatternTypeCounts(): PatternTypeCounts {
  const counts = {} as PatternTypeCounts;
  for (const t of COLLECTION_PATTERN_TYPE_VALUES) counts[t] = 0;
  return counts;
}

function patternTypeCountsFromPlan(plan: DesignPlan): PatternTypeCounts {
  const counts = emptyPatternTypeCounts();
  for (const entry of plan.collectionStructure) counts[entry.role as CollectionPatternType] = entry.count;
  return counts;
}

export interface PreparedRun {
  run: AutonomousDesignRun;
  marketingHandoff: MarketingDesignHandoff;
  brief: CreativeBrief;
  collectionPlan: CollectionPlan;
}

/** Freezes `run.designPlan` into the real handoff chain and transitions the
 * run PLAN_READY -> GENERATING. Never called twice for the same run — the
 * plan is immutable from this point on (Safety Rule #1/#3). */
export function prepareRunForGeneration(run: AutonomousDesignRun, now: number = Date.now()): PreparedRun {
  if (!run.designPlan) {
    throw new Error('Cannot prepare a run with no frozen Design Plan.');
  }
  if (run.status !== 'PLAN_READY') {
    throw new Error(`Cannot prepare a run in status ${run.status} — must be PLAN_READY.`);
  }
  const plan = run.designPlan;
  const themeDecision = getDesignPlanDecision(plan, 'theme');
  const heroMotifDecision = getDesignPlanDecision(plan, 'heroMotif');
  const compositionDecision = getDesignPlanDecision(plan, 'composition');
  const paletteDecision = getDesignPlanDecision(plan, 'palette');

  let marketingHandoff = createMarketingDesignHandoff({
    marketSnapshotId: run.sourceEvidence.marketSnapshotId,
    marketOpportunityId: run.sourceEvidence.marketOpportunityId,
    dailyMissionId: run.sourceEvidence.dailyMissionId,
    evidenceRefs: plan.marketEvidence,
    confidence: plan.confidence,
    dataFreshness: plan.dataFreshness,
    targetMarketplace: plan.targetMarketplace,
    targetProducts: plan.targetProducts,
    recommendedTheme: themeDecision?.value ?? 'Autopilot collection',
    heroMotif: heroMotifDecision && !heroMotifDecision.value.startsWith('Not Provided') ? heroMotifDecision.value : null,
    composition: compositionDecision && !compositionDecision.value.startsWith('Auto') ? compositionDecision.value : null,
    palette: paletteDecision && paletteDecision.value.startsWith('#') ? paletteDecision.value.split(',').map((c) => c.trim()) : [],
    unresolvedFieldKeys: plan.risks.map((r) => r.label),
    now,
  });

  const brief = createCreativeBrief({
    collectionName: plan.summary,
    theme: themeDecision?.value ?? 'Autopilot collection',
    sourceOpportunityId: run.sourceEvidence.marketOpportunityId,
    targetMarketplace: plan.targetMarketplace,
    targetProducts: plan.targetProducts,
    buyerPersona: plan.targetCustomer !== 'Not Provided' ? plan.targetCustomer : '',
    heroStyle: heroMotifDecision && !heroMotifDecision.value.startsWith('Not Provided') ? heroMotifDecision.value : '',
    collectionSize: run.requestedCount,
    evidenceRefs: plan.marketEvidence,
    confidence: plan.confidence,
    now,
  });

  const collectionPlan = createCollectionPlan({
    briefId: brief.id,
    name: plan.summary,
    theme: themeDecision?.value ?? 'Autopilot collection',
    totalSize: run.requestedCount,
    patternTypeCounts: patternTypeCountsFromPlan(plan),
    targetMarketplace: plan.targetMarketplace,
    targetProducts: plan.targetProducts,
    now,
  });

  marketingHandoff = transitionMarketingDesignHandoffWorkflow({ ...marketingHandoff, creativeBriefId: brief.id }, 'BRIEF_DRAFT', now);
  marketingHandoff = transitionMarketingDesignHandoffWorkflow({ ...marketingHandoff, collectionPlanId: collectionPlan.id }, 'COLLECTION_PLANNED', now);

  const updatedRun = transitionAutonomousDesignRun(
    {
      ...run,
      marketingDesignHandoffId: marketingHandoff.id,
      creativeBriefId: brief.id,
      collectionPlanId: collectionPlan.id,
    },
    'GENERATING',
    now,
  );

  return { run: updatedRun, marketingHandoff, brief, collectionPlan };
}
