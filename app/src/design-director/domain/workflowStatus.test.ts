import { describe, it, expect } from 'vitest';
import {
  WORKFLOW_STATUS_VALUES,
  isValidWorkflowStatus,
  appendWorkflowTransition,
  currentWorkflowStatus,
  InvalidWorkflowTransitionError,
  WORKFLOW_STATUS_LABELS,
  WORKFLOW_STATUS_OWNER_MODULE,
} from './workflowStatus';

describe('WORKFLOW_STATUS_VALUES', () => {
  it('contains exactly the 13 required statuses, in the required workflow order', () => {
    expect(WORKFLOW_STATUS_VALUES).toEqual([
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
  });

  it('every status has a human label and an owner/module', () => {
    for (const status of WORKFLOW_STATUS_VALUES) {
      expect(WORKFLOW_STATUS_LABELS[status]).toBeTruthy();
      expect(WORKFLOW_STATUS_OWNER_MODULE[status]).toBeTruthy();
    }
  });
});

describe('isValidWorkflowStatus', () => {
  it('accepts every real status and rejects unknown strings', () => {
    for (const status of WORKFLOW_STATUS_VALUES) expect(isValidWorkflowStatus(status)).toBe(true);
    expect(isValidWorkflowStatus('NOT_A_STATUS')).toBe(false);
    expect(isValidWorkflowStatus(42)).toBe(false);
  });
});

describe('appendWorkflowTransition / currentWorkflowStatus — the audit history', () => {
  it('appends transitions in order without mutating or discarding prior entries', () => {
    let history = appendWorkflowTransition([], 'MARKETING_RESEARCH', 100);
    history = appendWorkflowTransition(history, 'OPPORTUNITY_SELECTED', 200);
    history = appendWorkflowTransition(history, 'BRIEF_DRAFT', 300, 'auto-created from Marketing Handoff');
    expect(history).toHaveLength(3);
    expect(history.map((h) => h.status)).toEqual(['MARKETING_RESEARCH', 'OPPORTUNITY_SELECTED', 'BRIEF_DRAFT']);
    expect(history[0].at).toBe(100);
    expect(history[2].note).toBe('auto-created from Marketing Handoff');
    // Every previous entry is still present unchanged.
    expect(history[0]).toEqual({ status: 'MARKETING_RESEARCH', at: 100 });
  });

  it('currentWorkflowStatus reads the latest entry, or null for empty history', () => {
    expect(currentWorkflowStatus([])).toBeNull();
    const history = appendWorkflowTransition(appendWorkflowTransition([], 'MARKETING_RESEARCH', 1), 'OPPORTUNITY_SELECTED', 2);
    expect(currentWorkflowStatus(history)).toBe('OPPORTUNITY_SELECTED');
  });

  it('rejects an unknown status rather than silently recording it', () => {
    expect(() => appendWorkflowTransition([], 'NOT_A_STATUS' as never, 1)).toThrow(InvalidWorkflowTransitionError);
  });
});
