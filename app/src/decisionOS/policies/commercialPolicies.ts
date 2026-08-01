import type { PolicyDefinition, PolicyEvaluation } from '../domain/types';
import type { CommercialEvidenceInput } from '../evidenceProviders/commercialEvidence';

// Build 031B, Part 7 — Commercial policies. "Never export below
// readiness threshold" — mirrors `commercial/safetyThreshold.ts`'s
// `canExportPackage` exactly (same threshold semantics, same explicit-
// override escape hatch) rather than a second, possibly-inconsistent
// gate.

function evaluationOf<T>(records: { id: string; value: unknown }[], id: string): T | undefined {
  return records.find((r) => r.id === id)?.value as T | undefined;
}

const neverExportBelowReadinessThreshold: PolicyDefinition = {
  id: 'commercial.neverExportBelowReadinessThreshold',
  name: 'Never export below readiness threshold',
  description: 'Refuse export/package-build when Commercial Readiness is below the configured threshold, unless explicitly overridden.',
  domain: 'commercial',
  version: 1,
  defaultPriority: 5,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['commercial'],
  expectedOutcome: 'No package is ever built below the safety threshold without an explicit, disclosed override.',
  impactWhenApplies: 'VERY_HIGH',
  examples: ['Readiness 42%, threshold 95% -> block export unless overridden.'],
  evaluate: (evidence, context): PolicyEvaluation => {
    const readiness = evaluationOf<CommercialEvidenceInput['readiness']>(evidence.records, 'commercial:readiness');
    const evidenceIds = evidence.records.filter((r) => r.id === 'commercial:readiness').map((r) => r.id);
    if ((context.requestedAction !== 'export' && context.requestedAction !== 'buildPackage') || !readiness) {
      return { policyId: neverExportBelowReadinessThreshold.id, policyName: neverExportBelowReadinessThreshold.name, domain: 'commercial', applies: false, action: null, blockedReason: null, warning: null, detail: 'Not an export/package request, or readiness unknown.', evidenceIds };
    }
    if (readiness.score >= readiness.threshold) {
      return {
        policyId: neverExportBelowReadinessThreshold.id,
        policyName: neverExportBelowReadinessThreshold.name,
        domain: 'commercial',
        applies: true,
        action: context.requestedAction,
        blockedReason: null,
        warning: null,
        detail: `Commercial Readiness ${readiness.score}% meets the ${readiness.threshold}% threshold.`,
        evidenceIds,
      };
    }
    return {
      policyId: neverExportBelowReadinessThreshold.id,
      policyName: neverExportBelowReadinessThreshold.name,
      domain: 'commercial',
      applies: true,
      action: null,
      blockedReason: `Commercial Readiness ${readiness.score}% is below the ${readiness.threshold}% threshold.`,
      warning: null,
      detail: `Commercial Readiness ${readiness.score}% is below the ${readiness.threshold}% threshold.`,
      evidenceIds,
    };
  },
};

// Build 031B Hardening — the next 3 policies replace
// `commercial/commercialRecommendation.ts`'s local `actionForBucket`
// if/else-if cascade. Priority order below (6 < 11 < 16 < 21) reproduces
// that cascade exactly: `evaluateDecision` always returns the lowest-
// priority-number APPLYING policy's action, so "collection assignment
// missing" always outranks "QA not passed", which always outranks
// "SEO missing", which always outranks "ready to export" — identical to
// the original chain, just made explainable/traceable/testable as
// Decision OS policies instead of inline `if` statements. Technical
// validation (does the SVG exist, etc.) stays local to the caller; these
// 3 policies (plus the pre-existing `neverExportBelowReadinessThreshold`)
// are the actual business decisions.

const completeCollectionFirst: PolicyDefinition = {
  id: 'commercial.completeCollectionFirst',
  name: 'Complete collection assignment first',
  description: 'Recommend assigning an asset to a Collection before any other Commercial Pipeline action.',
  domain: 'commercial',
  version: 1,
  defaultPriority: 6,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['commercial'],
  expectedOutcome: 'An asset with no Collection assignment is never recommended for repair/SEO/export before it has one.',
  impactWhenApplies: 'MEDIUM',
  examples: ['Asset is not assigned to any Collection -> recommend assigning it first.'],
  evaluate: (evidence): PolicyEvaluation => {
    const assignment = evaluationOf<{ assigned: boolean | null }>(evidence.records, 'commercial:collectionAssignment');
    const evidenceIds = evidence.records.filter((r) => r.id === 'commercial:collectionAssignment').map((r) => r.id);
    if (!assignment || assignment.assigned !== false) {
      return { policyId: completeCollectionFirst.id, policyName: completeCollectionFirst.name, domain: 'commercial', applies: false, action: null, blockedReason: null, warning: null, detail: 'Asset is already assigned to a Collection, or assignment status is unknown.', evidenceIds };
    }
    return { policyId: completeCollectionFirst.id, policyName: completeCollectionFirst.name, domain: 'commercial', applies: true, action: 'completeCollection', blockedReason: null, warning: null, detail: 'This asset is not assigned to any Collection.', evidenceIds };
  },
};

const repairBeforeSeo: PolicyDefinition = {
  id: 'commercial.repairBeforeSeo',
  name: 'Repair before SEO',
  description: 'Recommend repairing a QA-failed asset before finishing its SEO metadata.',
  domain: 'commercial',
  version: 1,
  defaultPriority: 11,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['qa'],
  expectedOutcome: 'SEO work is never recommended for an asset that has not passed quality review.',
  impactWhenApplies: 'MEDIUM',
  examples: ['Latest QualitySnapshot decision is REJECT -> recommend repair before SEO.'],
  evaluate: (evidence): PolicyEvaluation => {
    const qa = evaluationOf<{ passed: boolean | null }>(evidence.records, 'qa:assetQaStatus');
    const evidenceIds = evidence.records.filter((r) => r.id === 'qa:assetQaStatus').map((r) => r.id);
    if (!qa || qa.passed !== false) {
      return { policyId: repairBeforeSeo.id, policyName: repairBeforeSeo.name, domain: 'commercial', applies: false, action: null, blockedReason: null, warning: null, detail: 'Asset has passed QA, or QA status is unknown.', evidenceIds };
    }
    return { policyId: repairBeforeSeo.id, policyName: repairBeforeSeo.name, domain: 'commercial', applies: true, action: 'repair', blockedReason: null, warning: null, detail: 'This asset has not passed quality review.', evidenceIds };
  },
};

const finishSeoBeforePackaging: PolicyDefinition = {
  id: 'commercial.finishSeoBeforePackaging',
  name: 'Finish SEO before packaging',
  description: 'Recommend finishing SEO metadata before an asset is treated as export-ready.',
  domain: 'commercial',
  version: 1,
  defaultPriority: 16,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['commercial'],
  expectedOutcome: 'An asset missing SEO metadata is recommended for "finish SEO" before "export".',
  impactWhenApplies: 'MEDIUM',
  examples: ['No submission/SEO exists for the asset -> recommend finishing SEO.'],
  evaluate: (evidence): PolicyEvaluation => {
    const seo = evaluationOf<{ hasSeo: boolean | null }>(evidence.records, 'commercial:seoStatus');
    const evidenceIds = evidence.records.filter((r) => r.id === 'commercial:seoStatus').map((r) => r.id);
    if (!seo || seo.hasSeo !== false) {
      return { policyId: finishSeoBeforePackaging.id, policyName: finishSeoBeforePackaging.name, domain: 'commercial', applies: false, action: null, blockedReason: null, warning: null, detail: 'SEO metadata already present, or status unknown.', evidenceIds };
    }
    return { policyId: finishSeoBeforePackaging.id, policyName: finishSeoBeforePackaging.name, domain: 'commercial', applies: true, action: 'finishSeo', blockedReason: null, warning: null, detail: 'No SEO metadata exists for this asset yet.', evidenceIds };
  },
};

const recommendExportWhenReady: PolicyDefinition = {
  id: 'commercial.recommendExportWhenReady',
  name: 'Recommend export when ready',
  description: 'Recommend export once Commercial Readiness meets the threshold and no check is failing.',
  domain: 'commercial',
  version: 1,
  defaultPriority: 21,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['commercial'],
  expectedOutcome: 'An asset is only ever recommended for export once every FAIL-capable check has actually passed.',
  impactWhenApplies: 'MEDIUM',
  examples: ['Readiness 100%, 0 failing checks -> recommend export.'],
  evaluate: (evidence): PolicyEvaluation => {
    const readiness = evaluationOf<{ score: number; threshold: number; failingChecksCount: number }>(evidence.records, 'commercial:readiness');
    const evidenceIds = evidence.records.filter((r) => r.id === 'commercial:readiness').map((r) => r.id);
    if (!readiness || readiness.score < readiness.threshold || readiness.failingChecksCount > 0) {
      return { policyId: recommendExportWhenReady.id, policyName: recommendExportWhenReady.name, domain: 'commercial', applies: false, action: null, blockedReason: null, warning: null, detail: 'Not yet at or above the readiness threshold, or a check is still failing.', evidenceIds };
    }
    return {
      policyId: recommendExportWhenReady.id,
      policyName: recommendExportWhenReady.name,
      domain: 'commercial',
      applies: true,
      action: 'exportReady',
      blockedReason: null,
      warning: null,
      detail: `Commercial Readiness ${readiness.score}% meets the ${readiness.threshold}% threshold with no failing checks.`,
      evidenceIds,
    };
  },
};

export const COMMERCIAL_POLICIES: PolicyDefinition[] = [
  neverExportBelowReadinessThreshold,
  completeCollectionFirst,
  repairBeforeSeo,
  finishSeoBeforePackaging,
  recommendExportWhenReady,
];
