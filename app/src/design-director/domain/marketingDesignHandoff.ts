import { marketingDesignHandoffId } from '../../marketing/domain/id';
import { isValidEvidenceBand, type EvidenceBand } from '../../marketing/domain/evidence';
import {
  appendWorkflowTransition,
  currentWorkflowStatus,
  isValidWorkflowStatus,
  type WorkflowHistoryEntry,
  type WorkflowStatus,
} from './workflowStatus';

// Build 028C (Marketing to Creative Director Workflow) — the formal
// handoff record between Marketing Intelligence and the AI Creative
// Director, persisted into the `marketingDesignHandoffs` IndexedDB store
// Build 028 Phase 2 already pre-provisioned (keyPath 'id', indexes
// 'status'/'briefId' — this is the first domain module to actually
// read/write through it). One record spans the ENTIRE workflow (Market
// Opportunity -> Creative Brief -> Collection Plan -> Collection Item ->
// Generator Handoff -> Generated), carrying both the original marketing
// evidence this workflow started from (requirement #2) and the running
// `workflowHistory` audit trail (requirement #11) as it progresses.

export const MARKETING_DESIGN_HANDOFF_SCHEMA_VERSION = 1;

export interface MarketingDesignHandoff {
  id: string;
  // Requirement #2 — preserved marketing provenance.
  marketSnapshotId: string | null;
  marketOpportunityId: string | null;
  dailyMissionId: string | null;
  evidenceRefs: string[];
  opportunityScore: number | null;
  confidence: EvidenceBand;
  dataFreshness: string;
  targetMarketplace: string;
  targetProducts: string[];
  recommendedTheme: string;
  heroMotif: string | null;
  composition: string | null;
  palette: string[];
  productionTiming: string | null;
  // Downstream record links, populated as the workflow progresses.
  creativeBriefId: string | null;
  collectionPlanId: string | null;
  collectionItemId: string | null;
  generatorHandoffId: string | null;
  /** Field keys the mapping builder could not confidently resolve at the
   * moment this handoff was created (requirement #6/#12's "unresolved
   * fields" indicator) — a snapshot, not re-derived live, since the
   * marketing evidence it was computed from may itself change afterward. */
  unresolvedFieldKeys: string[];
  workflowHistory: WorkflowHistoryEntry[];
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export class InvalidMarketingDesignHandoffInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMarketingDesignHandoffInputError';
  }
}

export interface CreateMarketingDesignHandoffInput {
  marketSnapshotId?: string | null;
  marketOpportunityId?: string | null;
  dailyMissionId?: string | null;
  evidenceRefs?: string[];
  opportunityScore?: number | null;
  confidence?: EvidenceBand;
  dataFreshness?: string;
  targetMarketplace?: string;
  targetProducts?: string[];
  recommendedTheme: string;
  heroMotif?: string | null;
  composition?: string | null;
  palette?: string[];
  productionTiming?: string | null;
  unresolvedFieldKeys?: string[];
  now?: number;
}

/** Every new handoff starts already having passed through
 * MARKETING_RESEARCH (the record's source data existed in Marketing
 * Intelligence) and OPPORTUNITY_SELECTED (the exact moment "ส่งให้นักออกแบบ"
 * was pressed, which is what created this record) — both real, already-
 * happened events, not placeholders. */
export function createMarketingDesignHandoff(input: CreateMarketingDesignHandoffInput): MarketingDesignHandoff {
  if (!input.recommendedTheme.trim()) {
    throw new InvalidMarketingDesignHandoffInputError('recommendedTheme cannot be empty.');
  }
  const now = input.now ?? Date.now();
  const history = appendWorkflowTransition(appendWorkflowTransition([], 'MARKETING_RESEARCH', now), 'OPPORTUNITY_SELECTED', now);
  return {
    id: marketingDesignHandoffId.generate(now),
    marketSnapshotId: input.marketSnapshotId ?? null,
    marketOpportunityId: input.marketOpportunityId ?? null,
    dailyMissionId: input.dailyMissionId ?? null,
    evidenceRefs: input.evidenceRefs ?? [],
    opportunityScore: input.opportunityScore ?? null,
    confidence: input.confidence ?? 'unknown',
    dataFreshness: input.dataFreshness ?? 'unknown',
    targetMarketplace: input.targetMarketplace ?? '',
    targetProducts: input.targetProducts ?? [],
    recommendedTheme: input.recommendedTheme,
    heroMotif: input.heroMotif ?? null,
    composition: input.composition ?? null,
    palette: input.palette ?? [],
    productionTiming: input.productionTiming ?? null,
    creativeBriefId: null,
    collectionPlanId: null,
    collectionItemId: null,
    generatorHandoffId: null,
    unresolvedFieldKeys: input.unresolvedFieldKeys ?? [],
    workflowHistory: history,
    createdAt: now,
    updatedAt: now,
    schemaVersion: MARKETING_DESIGN_HANDOFF_SCHEMA_VERSION,
  };
}

/** The one place a workflow status transition is recorded — always appends
 * to `workflowHistory` (never mutates/removes a prior entry), so the full
 * audit trail (requirement #11) is reconstructable at any time. */
export function transitionMarketingDesignHandoffWorkflow(
  handoff: MarketingDesignHandoff,
  status: WorkflowStatus,
  now: number = Date.now(),
  note?: string,
): MarketingDesignHandoff {
  return {
    ...handoff,
    workflowHistory: appendWorkflowTransition(handoff.workflowHistory, status, now, note),
    updatedAt: now,
  };
}

export function getMarketingDesignHandoffWorkflowStatus(handoff: MarketingDesignHandoff): WorkflowStatus | null {
  return currentWorkflowStatus(handoff.workflowHistory);
}

export function isValidMarketingDesignHandoff(value: unknown): value is MarketingDesignHandoff {
  if (!value || typeof value !== 'object') return false;
  const h = value as Partial<MarketingDesignHandoff>;
  if (
    typeof h.id !== 'string' ||
    typeof h.recommendedTheme !== 'string' ||
    !isValidEvidenceBand(h.confidence) ||
    !Array.isArray(h.evidenceRefs) ||
    !Array.isArray(h.workflowHistory) ||
    typeof h.createdAt !== 'number' ||
    typeof h.updatedAt !== 'number'
  ) {
    return false;
  }
  return h.workflowHistory.every((entry) => isValidWorkflowStatus(entry.status) && typeof entry.at === 'number');
}
