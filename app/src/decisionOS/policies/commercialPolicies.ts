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

export const COMMERCIAL_POLICIES: PolicyDefinition[] = [neverExportBelowReadinessThreshold];
