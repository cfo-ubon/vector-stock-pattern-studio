// Build 028C (Marketing to Creative Director Workflow) — the one workflow
// status enum shared across the whole Market Opportunity -> Creative Brief
// -> Collection Plan -> Collection Item -> Generator Handoff -> Generated
// pipeline. Lives on `MarketingDesignHandoff` (the one record that spans
// the entire workflow, from the moment a marketing record is sent to the
// Creative Director through to the pattern being generated) rather than
// being duplicated across CreativeBrief/CollectionPlan/GeneratorHandoff —
// those domain records keep their own narrower status fields (e.g.
// `CreativeBriefStatus`) for their own module's concerns; this enum is
// specifically the cross-module workflow position.

export const WORKFLOW_STATUS_VALUES = [
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
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUS_VALUES)[number];

export function isValidWorkflowStatus(value: unknown): value is WorkflowStatus {
  return typeof value === 'string' && (WORKFLOW_STATUS_VALUES as readonly string[]).includes(value);
}

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  MARKETING_RESEARCH: 'Marketing Research',
  OPPORTUNITY_SELECTED: 'Opportunity Selected',
  BRIEF_DRAFT: 'Brief Draft',
  BRIEF_REVIEW: 'Brief Review',
  BRIEF_APPROVED: 'Brief Approved',
  COLLECTION_PLANNED: 'Collection Planned',
  COLLECTION_ITEM_SELECTED: 'Collection Item Selected',
  HANDOFF_REVIEW: 'Handoff Review',
  READY_FOR_GENERATOR: 'Ready for Generator',
  GENERATING: 'Generating',
  GENERATED: 'Generated',
  DESIGN_REVIEW: 'Design Review',
  READY_FOR_PORTFOLIO: 'Ready for Portfolio',
};

/** Which module currently "owns" a handoff at each workflow status — drives
 * the "current owner/module" UI indicator (requirement #12) without a
 * second, separately-maintained lookup table. */
export const WORKFLOW_STATUS_OWNER_MODULE: Record<WorkflowStatus, string> = {
  MARKETING_RESEARCH: 'Marketing Intelligence',
  OPPORTUNITY_SELECTED: 'Marketing Intelligence',
  BRIEF_DRAFT: 'Creative Brief',
  BRIEF_REVIEW: 'Creative Brief',
  BRIEF_APPROVED: 'Creative Brief',
  COLLECTION_PLANNED: 'Collection Planner',
  COLLECTION_ITEM_SELECTED: 'Collection Planner',
  HANDOFF_REVIEW: 'Generator Handoff',
  READY_FOR_GENERATOR: 'Generator Handoff',
  GENERATING: 'Generator Handoff',
  GENERATED: 'Generator Handoff',
  DESIGN_REVIEW: 'Portfolio',
  READY_FOR_PORTFOLIO: 'Portfolio',
};

export interface WorkflowHistoryEntry {
  status: WorkflowStatus;
  at: number;
  note?: string;
}

export class InvalidWorkflowTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWorkflowTransitionError';
  }
}

/** Pure append — every workflow status change is recorded here, never
 * mutated or removed, so `workflowHistory` on `MarketingDesignHandoff` is a
 * genuine, complete audit trail (requirement #11) rather than just the
 * latest status. */
export function appendWorkflowTransition(
  history: WorkflowHistoryEntry[],
  status: WorkflowStatus,
  now: number = Date.now(),
  note?: string,
): WorkflowHistoryEntry[] {
  if (!isValidWorkflowStatus(status)) {
    throw new InvalidWorkflowTransitionError(`Unknown workflow status "${String(status)}".`);
  }
  return [...history, note ? { status, at: now, note } : { status, at: now }];
}

export function currentWorkflowStatus(history: WorkflowHistoryEntry[]): WorkflowStatus | null {
  return history.length > 0 ? history[history.length - 1].status : null;
}
