import type { PolicyDefinition, PolicyEvaluation } from '../domain/types';
import type { PipelineEvidenceInput } from '../evidenceProviders/pipelineEvidence';
import type { QaEvidenceInput } from '../evidenceProviders/qaEvidence';
import type { CommercialEvidenceInput } from '../evidenceProviders/commercialEvidence';
import type { CollectionEvidenceInput } from '../evidenceProviders/collectionEvidence';

// Build 031B, Part 7 — Factory policies. The 7 rules named in the spec's
// own Factory list. Every `evaluate` below only reads `EvidenceRecord`s
// (never `context.data` directly) — the one rule every policy in this
// build follows, so a policy can never quietly bypass the Evidence Engine.

function evaluationOf<T>(records: { id: string; value: unknown }[], id: string): T | undefined {
  return records.find((r) => r.id === id)?.value as T | undefined;
}

const completeExistingWorkFirst: PolicyDefinition = {
  id: 'factory.completeExistingWorkFirst',
  name: 'Complete existing work first',
  description: 'Prefer resuming an interrupted Autopilot run or importing already-READY items over starting new production.',
  domain: 'factory',
  version: 1,
  defaultPriority: 10,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['pipeline'],
  expectedOutcome: 'Unfinished work (interrupted runs, un-imported READY items) is resumed/imported before new production starts.',
  impactWhenApplies: 'HIGH',
  examples: ['1 interrupted run with 3 of 10 items completed exists -> resume it instead of starting a new run.'],
  evaluate: (evidence, context): PolicyEvaluation => {
    const pipeline = evaluationOf<PipelineEvidenceInput>(evidence.records, 'pipeline:unfinishedWork');
    const evidenceIds = evidence.records.filter((r) => r.id === 'pipeline:unfinishedWork').map((r) => r.id);
    if (!pipeline || (pipeline.resumableRunCount === 0 && pipeline.readyNotImportedCount === 0)) {
      return { policyId: completeExistingWorkFirst.id, policyName: completeExistingWorkFirst.name, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: 'No unfinished Autopilot work exists.', evidenceIds };
    }
    const parts: string[] = [];
    if (pipeline.resumableRunCount > 0) parts.push(`${pipeline.resumableRunCount} resumable run(s)`);
    if (pipeline.readyNotImportedCount > 0) parts.push(`${pipeline.readyNotImportedCount} un-imported READY item(s)`);
    const detail = `Unfinished work exists: ${parts.join(', ')}.`;
    const warning = context.requestedAction === 'generate' ? 'Unfinished work exists — consider completing it before generating more.' : null;
    return { policyId: completeExistingWorkFirst.id, policyName: completeExistingWorkFirst.name, domain: 'factory', applies: true, action: 'resumeExistingWork', blockedReason: null, warning, detail, evidenceIds };
  },
};

const repairBeforeGenerate: PolicyDefinition = {
  id: 'factory.repairBeforeGenerate',
  name: 'Repair before Generate',
  description: 'Prefer repairing REVIEW/REJECT items over generating new patterns in the same category.',
  domain: 'factory',
  version: 1,
  defaultPriority: 20,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['qa'],
  expectedOutcome: 'Patterns needing repair are addressed before more of the same kind are generated.',
  impactWhenApplies: 'MEDIUM',
  examples: ['5 REVIEW + 2 REJECT items exist -> repair them before generating 10 more.'],
  evaluate: (evidence, context): PolicyEvaluation => {
    const qa = evaluationOf<QaEvidenceInput>(evidence.records, 'qa:reviewRejectCounts');
    const evidenceIds = evidence.records.filter((r) => r.id === 'qa:reviewRejectCounts').map((r) => r.id);
    const needsRepair = qa && qa.reviewCount + qa.rejectCount > 0;
    if (!needsRepair) {
      return { policyId: repairBeforeGenerate.id, policyName: repairBeforeGenerate.name, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: 'No REVIEW/REJECT items outstanding.', evidenceIds };
    }
    const detail = `${qa!.reviewCount} REVIEW, ${qa!.rejectCount} REJECT item(s) out of ${qa!.totalEvaluated} evaluated.`;
    const warning = context.requestedAction === 'generate' ? 'Items needing repair exist — consider fixing them before generating more.' : null;
    return { policyId: repairBeforeGenerate.id, policyName: repairBeforeGenerate.name, domain: 'factory', applies: true, action: 'repairExisting', blockedReason: null, warning, detail, evidenceIds };
  },
};

const qaBeforeExport: PolicyDefinition = {
  id: 'factory.qaBeforeExport',
  name: 'QA before Export',
  description: 'Refuse to export an asset that has not passed quality review.',
  domain: 'factory',
  version: 1,
  defaultPriority: 5,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['qa'],
  expectedOutcome: 'No export proceeds for an asset whose latest QualitySnapshot decision is not READY.',
  impactWhenApplies: 'HIGH',
  examples: ['Asset QA status is REJECT -> block export.'],
  evaluate: (evidence, context): PolicyEvaluation => {
    // Note: this evidence record's `value` shape is `{ passed }` (see
    // `qaEvidenceProvider`'s `qa:assetQaStatus` record) — a distinct,
    // narrower shape from the adapter-facing `QaEvidenceInput` type, so it
    // is typed locally here rather than reusing that import.
    const qa = evaluationOf<{ passed: boolean | null }>(evidence.records, 'qa:assetQaStatus');
    const evidenceIds = evidence.records.filter((r) => r.id === 'qa:assetQaStatus').map((r) => r.id);
    if (context.requestedAction !== 'export' || !qa || qa.passed === null) {
      return { policyId: qaBeforeExport.id, policyName: qaBeforeExport.name, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: 'Not an export request, or QA status unknown.', evidenceIds };
    }
    if (qa.passed) {
      return { policyId: qaBeforeExport.id, policyName: qaBeforeExport.name, domain: 'factory', applies: true, action: null, blockedReason: null, warning: null, detail: 'Asset has passed QA.', evidenceIds };
    }
    return { policyId: qaBeforeExport.id, policyName: qaBeforeExport.name, domain: 'factory', applies: true, action: null, blockedReason: 'Asset has not passed quality review — export refused.', warning: null, detail: 'Asset QA status is not passed.', evidenceIds };
  },
};

const seoBeforePackaging: PolicyDefinition = {
  id: 'factory.seoBeforePackaging',
  name: 'SEO before Packaging',
  description: 'Prefer completing SEO metadata before a Commercial Package is built, without blocking the build.',
  domain: 'factory',
  version: 1,
  defaultPriority: 30,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['commercial'],
  expectedOutcome: 'An asset missing SEO metadata is recommended for "finish SEO" before "build package".',
  impactWhenApplies: 'MEDIUM',
  examples: ['No submission/SEO exists for the asset -> recommend finishing SEO first.'],
  evaluate: (evidence): PolicyEvaluation => {
    const commercial = evaluationOf<{ hasSeo: boolean | null }>(evidence.records, 'commercial:seoStatus');
    const evidenceIds = evidence.records.filter((r) => r.id === 'commercial:seoStatus').map((r) => r.id);
    if (!commercial || commercial.hasSeo === null || commercial.hasSeo) {
      return { policyId: seoBeforePackaging.id, policyName: seoBeforePackaging.name, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: 'SEO metadata already present, or status unknown.', evidenceIds };
    }
    return { policyId: seoBeforePackaging.id, policyName: seoBeforePackaging.name, domain: 'factory', applies: true, action: 'finishSeo', blockedReason: null, warning: null, detail: 'No SEO metadata exists for this asset yet.', evidenceIds };
  },
};

const packagingBeforeExport: PolicyDefinition = {
  id: 'factory.packagingBeforeExport',
  name: 'Packaging before Export',
  description: 'An asset cannot be marked Export Ready before a Commercial Package has actually been built for it.',
  domain: 'factory',
  version: 1,
  defaultPriority: 15,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['commercial'],
  expectedOutcome: 'The "markExportReady" action is refused until at least one Commercial Package exists for the target.',
  impactWhenApplies: 'MEDIUM',
  examples: ['No package has ever been built for this (asset, marketplace) pair -> block markExportReady.'],
  evaluate: (evidence, context): PolicyEvaluation => {
    const pkg = evaluationOf<CommercialEvidenceInput['recentPackage']>(evidence.records, 'commercial:recentPackage');
    const evidenceIds = evidence.records.filter((r) => r.id === 'commercial:recentPackage').map((r) => r.id);
    if (context.requestedAction !== 'markExportReady') {
      return { policyId: packagingBeforeExport.id, policyName: packagingBeforeExport.name, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: 'Not a markExportReady request.', evidenceIds };
    }
    if (pkg && pkg.found) {
      return { policyId: packagingBeforeExport.id, policyName: packagingBeforeExport.name, domain: 'factory', applies: true, action: null, blockedReason: null, warning: null, detail: 'A Commercial Package already exists for this target.', evidenceIds };
    }
    return { policyId: packagingBeforeExport.id, policyName: packagingBeforeExport.name, domain: 'factory', applies: true, action: 'buildPackage', blockedReason: 'No Commercial Package has been built for this target yet.', warning: null, detail: 'Packaging has not happened yet.', evidenceIds };
  },
};

const noDuplicatePackage: PolicyDefinition = {
  id: 'factory.noDuplicatePackage',
  name: 'No duplicate package',
  description: 'Refuse to build another Commercial Package for the same (asset, marketplace) target within the cooldown window unless explicitly overridden.',
  domain: 'factory',
  version: 1,
  defaultPriority: 8,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['commercial'],
  expectedOutcome: 'A build already produced very recently is not silently duplicated.',
  impactWhenApplies: 'LOW',
  examples: ['A package for the same target was built 2 minutes ago (cooldown 5 minutes) -> block another build.'],
  evaluate: (evidence, context): PolicyEvaluation => {
    const pkg = evaluationOf<CommercialEvidenceInput['recentPackage']>(evidence.records, 'commercial:recentPackage');
    const evidenceIds = evidence.records.filter((r) => r.id === 'commercial:recentPackage').map((r) => r.id);
    if (context.requestedAction !== 'buildPackage' || !pkg || !pkg.found || pkg.builtAt === null) {
      return { policyId: noDuplicatePackage.id, policyName: noDuplicatePackage.name, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: 'No recent package exists for this target.', evidenceIds };
    }
    const age = context.now - pkg.builtAt;
    if (age > pkg.cooldownMs) {
      return { policyId: noDuplicatePackage.id, policyName: noDuplicatePackage.name, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: 'The most recent package for this target is outside the cooldown window.', evidenceIds };
    }
    return {
      policyId: noDuplicatePackage.id,
      policyName: noDuplicatePackage.name,
      domain: 'factory',
      applies: true,
      action: null,
      blockedReason: `A Commercial Package for this target was already built ${Math.round(age / 60000)} minute(s) ago.`,
      warning: null,
      detail: 'Duplicate build request within cooldown window.',
      evidenceIds,
    };
  },
};

const noIncompleteCollectionExport: PolicyDefinition = {
  id: 'factory.noIncompleteCollectionExport',
  name: 'No incomplete collection export',
  description: 'Refuse to export a collection whose tracked roles are not complete.',
  domain: 'factory',
  version: 1,
  defaultPriority: 6,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['collection'],
  expectedOutcome: 'A collection missing a tracked role (hero, colorway, etc.) is not exported as if it were complete.',
  impactWhenApplies: 'HIGH',
  examples: ['Collection is missing a "colorway"-tagged asset -> block collection export.'],
  evaluate: (evidence, context): PolicyEvaluation => {
    const completeness = evaluationOf<CollectionEvidenceInput['completeness']>(evidence.records, 'collection:completeness');
    const evidenceIds = evidence.records.filter((r) => r.id === 'collection:completeness').map((r) => r.id);
    if (context.requestedAction !== 'exportCollection' || !completeness || !completeness.roleTrackingAvailable) {
      return { policyId: noIncompleteCollectionExport.id, policyName: noIncompleteCollectionExport.name, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: 'Not a collection export request, or role tracking unavailable.', evidenceIds };
    }
    if (completeness.missingRoles.length === 0) {
      return { policyId: noIncompleteCollectionExport.id, policyName: noIncompleteCollectionExport.name, domain: 'factory', applies: true, action: null, blockedReason: null, warning: null, detail: 'Every tracked role is present.', evidenceIds };
    }
    return {
      policyId: noIncompleteCollectionExport.id,
      policyName: noIncompleteCollectionExport.name,
      domain: 'factory',
      applies: true,
      action: null,
      blockedReason: `Collection is missing role(s): ${completeness.missingRoles.join(', ')}.`,
      warning: null,
      detail: 'Collection role completeness is incomplete.',
      evidenceIds,
    };
  },
};

export const FACTORY_POLICIES: PolicyDefinition[] = [completeExistingWorkFirst, repairBeforeGenerate, qaBeforeExport, seoBeforePackaging, packagingBeforeExport, noDuplicatePackage, noIncompleteCollectionExport];
