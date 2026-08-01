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

// Build 031C, Part 3 — Dynamic Priority policies. The Factory Priority
// Engine (`factory/priorityEngine.ts`) evaluates each of these under a
// `requestedAction: 'reprioritizeQueue'` context; `applies: true` means
// "boost this task type's queue priority now," never a blocking decision.
// Each reuses an existing evidence record already gathered by one of the
// 7 policies above — no new evidence type invented beyond the two small
// optional fields added to `PipelineEvidenceInput`/`CommercialEvidenceInput`
// for the two signals (backlog size, export-blocked count) that have no
// existing single-asset evidence record to reuse.

const HIGH_REVIEW_RATE_THRESHOLD = 0.3; // 30% of evaluated items in REVIEW/REJECT
const LARGE_READY_BACKLOG_THRESHOLD = 10;
const COLLECTION_NEAR_COMPLETE_MAX_MISSING_ROLES = 1;

const prioritizeRepairOnHighReviewRate: PolicyDefinition = {
  id: 'factory.prioritizeRepairOnHighReviewRate',
  name: 'Prioritize repair on high REVIEW rate',
  description: 'When a large share of evaluated items are REVIEW/REJECT, move Repair tasks to the front of the queue.',
  domain: 'factory',
  version: 1,
  defaultPriority: 2,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['qa'],
  expectedOutcome: 'Repair tasks run before new Generate tasks when the REVIEW/REJECT rate is high.',
  impactWhenApplies: 'HIGH',
  examples: ['40% of evaluated items are REVIEW/REJECT -> boost repair task priority.'],
  evaluate: (evidence, context): PolicyEvaluation => {
    const qa = evaluationOf<{ reviewCount: number; rejectCount: number; totalEvaluated: number }>(evidence.records, 'qa:reviewRejectCounts');
    const evidenceIds = evidence.records.filter((r) => r.id === 'qa:reviewRejectCounts').map((r) => r.id);
    if (context.requestedAction !== 'reprioritizeRepair' || !qa || qa.totalEvaluated === 0) {
      return { policyId: prioritizeRepairOnHighReviewRate.id, policyName: prioritizeRepairOnHighReviewRate.name, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: 'Not a reprioritize request, or no evaluated items yet.', evidenceIds };
    }
    const rate = (qa.reviewCount + qa.rejectCount) / qa.totalEvaluated;
    if (rate < HIGH_REVIEW_RATE_THRESHOLD) {
      return { policyId: prioritizeRepairOnHighReviewRate.id, policyName: prioritizeRepairOnHighReviewRate.name, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: `REVIEW/REJECT rate ${Math.round(rate * 100)}% is below the ${Math.round(HIGH_REVIEW_RATE_THRESHOLD * 100)}% threshold.`, evidenceIds };
    }
    return { policyId: prioritizeRepairOnHighReviewRate.id, policyName: prioritizeRepairOnHighReviewRate.name, domain: 'factory', applies: true, action: 'boostRepairPriority', blockedReason: null, warning: null, detail: `REVIEW/REJECT rate is ${Math.round(rate * 100)}% (${qa.reviewCount + qa.rejectCount} of ${qa.totalEvaluated}).`, evidenceIds };
  },
};

const prioritizePackagingOnLargeBacklog: PolicyDefinition = {
  id: 'factory.prioritizePackagingOnLargeBacklog',
  name: 'Prioritize packaging on large READY backlog',
  description: 'When many QA-READY assets are waiting to be packaged, move Package tasks to the front of the queue.',
  domain: 'factory',
  version: 1,
  defaultPriority: 3,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['pipeline'],
  expectedOutcome: 'Package tasks run before new Generate tasks when the READY backlog is large.',
  impactWhenApplies: 'MEDIUM',
  examples: ['15 READY assets are awaiting packaging -> boost package task priority.'],
  evaluate: (evidence, context): PolicyEvaluation => {
    const pipeline = evaluationOf<{ readyBacklogCount: number | null }>(evidence.records, 'pipeline:unfinishedWork');
    const evidenceIds = evidence.records.filter((r) => r.id === 'pipeline:unfinishedWork').map((r) => r.id);
    if (context.requestedAction !== 'reprioritizePackaging' || !pipeline || pipeline.readyBacklogCount === null) {
      return { policyId: prioritizePackagingOnLargeBacklog.id, policyName: prioritizePackagingOnLargeBacklog.name, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: 'Not a reprioritize request, or READY backlog unknown.', evidenceIds };
    }
    if (pipeline.readyBacklogCount < LARGE_READY_BACKLOG_THRESHOLD) {
      return { policyId: prioritizePackagingOnLargeBacklog.id, policyName: prioritizePackagingOnLargeBacklog.name, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: `READY backlog (${pipeline.readyBacklogCount}) is below the ${LARGE_READY_BACKLOG_THRESHOLD} threshold.`, evidenceIds };
    }
    return { policyId: prioritizePackagingOnLargeBacklog.id, policyName: prioritizePackagingOnLargeBacklog.name, domain: 'factory', applies: true, action: 'boostPackagingPriority', blockedReason: null, warning: null, detail: `${pipeline.readyBacklogCount} READY asset(s) are awaiting packaging.`, evidenceIds };
  },
};

const prioritizeExportValidationWhenBlocked: PolicyDefinition = {
  id: 'factory.prioritizeExportValidationWhenBlocked',
  name: 'Prioritize export validation when export is blocked',
  description: 'When one or more packages are blocked from export, move Export Validation tasks to the front of the queue.',
  domain: 'factory',
  version: 1,
  defaultPriority: 1,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['commercial'],
  expectedOutcome: 'Export Validation tasks run before new Generate tasks when any package is export-blocked.',
  impactWhenApplies: 'HIGH',
  examples: ['3 packages are below the readiness threshold -> boost export validation task priority.'],
  evaluate: (evidence, context): PolicyEvaluation => {
    const summary = evaluationOf<{ exportBlockedCount: number | null }>(evidence.records, 'commercial:exportBlockedSummary');
    const evidenceIds = evidence.records.filter((r) => r.id === 'commercial:exportBlockedSummary').map((r) => r.id);
    if (context.requestedAction !== 'reprioritizeExportValidation' || !summary || summary.exportBlockedCount === null) {
      return { policyId: prioritizeExportValidationWhenBlocked.id, policyName: prioritizeExportValidationWhenBlocked.name, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: 'Not a reprioritize request, or export-blocked count unknown.', evidenceIds };
    }
    if (summary.exportBlockedCount === 0) {
      return { policyId: prioritizeExportValidationWhenBlocked.id, policyName: prioritizeExportValidationWhenBlocked.name, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: 'No packages are export-blocked.', evidenceIds };
    }
    return { policyId: prioritizeExportValidationWhenBlocked.id, policyName: prioritizeExportValidationWhenBlocked.name, domain: 'factory', applies: true, action: 'boostExportValidationPriority', blockedReason: null, warning: null, detail: `${summary.exportBlockedCount} package(s) are export-blocked.`, evidenceIds };
  },
};

const prioritizeCollectionCompletionWhenNear: PolicyDefinition = {
  id: 'factory.prioritizeCollectionCompletionWhenNear',
  name: 'Prioritize collection completion when nearly complete',
  description: 'When a collection is missing only 1 tracked role, move its Collection Completion task to the front of the queue.',
  domain: 'factory',
  version: 1,
  defaultPriority: 4,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['collection'],
  expectedOutcome: 'A nearly-finished collection is completed before starting unrelated new work.',
  impactWhenApplies: 'MEDIUM',
  examples: ['Collection is missing only its "colorway" role -> boost collection completion task priority.'],
  evaluate: (evidence, context): PolicyEvaluation => {
    const completeness = evaluationOf<{ collectionId: string; roleTrackingAvailable: boolean; missingRoles: string[] } | null>(evidence.records, 'collection:completeness');
    const evidenceIds = evidence.records.filter((r) => r.id === 'collection:completeness').map((r) => r.id);
    if (context.requestedAction !== 'reprioritizeCollectionCompletion' || !completeness || !completeness.roleTrackingAvailable) {
      return { policyId: prioritizeCollectionCompletionWhenNear.id, policyName: prioritizeCollectionCompletionWhenNear.name, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: 'Not a reprioritize request, or role tracking unavailable.', evidenceIds };
    }
    if (completeness.missingRoles.length === 0 || completeness.missingRoles.length > COLLECTION_NEAR_COMPLETE_MAX_MISSING_ROLES) {
      return { policyId: prioritizeCollectionCompletionWhenNear.id, policyName: prioritizeCollectionCompletionWhenNear.name, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: completeness.missingRoles.length === 0 ? 'Collection is already complete.' : `Collection is missing ${completeness.missingRoles.length} roles — not near-complete.`, evidenceIds };
    }
    return { policyId: prioritizeCollectionCompletionWhenNear.id, policyName: prioritizeCollectionCompletionWhenNear.name, domain: 'factory', applies: true, action: 'boostCollectionCompletionPriority', blockedReason: null, warning: null, detail: `Collection ${completeness.collectionId} is missing only: ${completeness.missingRoles.join(', ')}.`, evidenceIds };
  },
};

export const FACTORY_PRIORITY_POLICIES: PolicyDefinition[] = [prioritizeRepairOnHighReviewRate, prioritizePackagingOnLargeBacklog, prioritizeExportValidationWhenBlocked, prioritizeCollectionCompletionWhenNear];

export const FACTORY_POLICIES: PolicyDefinition[] = [
  completeExistingWorkFirst,
  repairBeforeGenerate,
  qaBeforeExport,
  seoBeforePackaging,
  packagingBeforeExport,
  noDuplicatePackage,
  noIncompleteCollectionExport,
  ...FACTORY_PRIORITY_POLICIES,
];
