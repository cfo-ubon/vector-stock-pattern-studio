import type { DecisionRequestContext, EvidenceSourceKind } from '../domain/types';

// Build 031C, Part 3 — Factory Priority adapter. Turns already-computed
// queue-level aggregates (never recomputed here — the Priority Engine is
// the only caller and it derives every number from the real
// `FactoryTask[]`/`QualitySnapshot[]`/`CommercialReadinessReport[]`
// already loaded) into the 4 independent `DecisionRequestContext`s the
// `factory.prioritize*` policies expect. Each signal is evaluated as its
// own Decision (a distinct `requestedAction`) rather than one shared
// decision, because more than one signal can be true at the same time and
// the Decision Engine only ever returns a single `recommendedAction` per
// decision — four independent decisions means every true signal produces
// its own real Decision ID and trace, instead of the others being
// silently dropped as an unused "alternative."

export const FACTORY_PRIORITY_REPAIR_SOURCES: EvidenceSourceKind[] = ['qa'];
export const FACTORY_PRIORITY_PACKAGING_SOURCES: EvidenceSourceKind[] = ['pipeline'];
export const FACTORY_PRIORITY_EXPORT_VALIDATION_SOURCES: EvidenceSourceKind[] = ['commercial'];
export const FACTORY_PRIORITY_COLLECTION_COMPLETION_SOURCES: EvidenceSourceKind[] = ['collection'];

export function factoryPriorityRepairContext(reviewCount: number, rejectCount: number, totalEvaluated: number, now: number): DecisionRequestContext {
  return {
    domain: 'factory',
    requestedAction: 'reprioritizeRepair',
    now,
    data: { qa: { reviewCount, rejectCount, totalEvaluated, assetQaPassed: null, timestamp: now } },
  };
}

export function factoryPriorityPackagingContext(readyBacklogCount: number, now: number): DecisionRequestContext {
  return {
    domain: 'factory',
    requestedAction: 'reprioritizePackaging',
    now,
    data: { pipeline: { resumableRunCount: 0, readyNotImportedCount: 0, readyBacklogCount, timestamp: now } },
  };
}

export function factoryPriorityExportValidationContext(exportBlockedCount: number, now: number): DecisionRequestContext {
  return {
    domain: 'factory',
    requestedAction: 'reprioritizeExportValidation',
    now,
    data: { commercial: { readiness: null, hasSeo: null, recentPackage: null, collectionAssigned: null, exportBlockedCount, timestamp: now } },
  };
}

export function factoryPriorityCollectionCompletionContext(collectionId: string, missingRoles: string[], now: number): DecisionRequestContext {
  return {
    domain: 'factory',
    requestedAction: 'reprioritizeCollectionCompletion',
    now,
    data: { collection: { emptyCollectionCount: 0, completeness: { collectionId, roleTrackingAvailable: true, missingRoles }, timestamp: now } },
  };
}
