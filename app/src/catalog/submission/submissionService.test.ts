import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createSubmission,
  updateSubmissionDraft,
  transitionSubmission,
  markReady,
  enqueueSubmission,
  markSubmitted,
  markApproved,
  markRejected,
  markNeedsRevision,
  archiveSubmission,
  restoreSubmissionToDraft,
  deleteSubmissionRecord,
  SubmissionNotFoundError,
  SubmissionNotEditableError,
} from './submissionService';
import { getSubmission, clearSubmissionStore } from './submissionStore';
import { InvalidSubmissionStatusTransitionError } from './submissionStatus';
import { resetMarketplaceProfileRegistry } from './marketplaceProfile';

const FULL_READY = { hasSvg: true, hasPreview: true };

function createReadySubmission() {
  return createSubmission({
    patternId: 'p1',
    marketplaceId: 'etsy',
    titleSnapshot: 'Floral Seamless Pattern',
    descriptionSnapshot: 'A lush spring floral pattern with soft pastel colors.',
    keywordSnapshot: ['floral', 'spring', 'seamless', 'pastel', 'nature'],
    category: 'Patterns',
  });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  resetMarketplaceProfileRegistry();
  clearSubmissionStore();
});

describe('createSubmission', () => {
  it('creates and persists a DRAFT submission', () => {
    const record = createSubmission({ patternId: 'p1', marketplaceId: 'etsy' });
    expect(record.status).toBe('DRAFT');
    expect(getSubmission(record.submissionId)).toEqual(record);
  });
});

describe('updateSubmissionDraft', () => {
  it('updates snapshot fields while DRAFT', () => {
    const record = createSubmission({ patternId: 'p1', marketplaceId: 'etsy' });
    const updated = updateSubmissionDraft(record.submissionId, { titleSnapshot: 'New Title', category: 'Patterns' });
    expect(updated.titleSnapshot).toBe('New Title');
    expect(updated.category).toBe('Patterns');
    expect(getSubmission(record.submissionId)?.titleSnapshot).toBe('New Title');
  });

  it('throws SubmissionNotFoundError for an unknown id', () => {
    expect(() => updateSubmissionDraft('SUB-00000000-ZZZZZZ', { titleSnapshot: 'X' })).toThrow(SubmissionNotFoundError);
  });

  it('throws SubmissionNotEditableError once a submission has left the editable states', () => {
    const record = createReadySubmission();
    markReady(record.submissionId, FULL_READY);
    expect(() => updateSubmissionDraft(record.submissionId, { titleSnapshot: 'X' })).toThrow(SubmissionNotEditableError);
  });

  it('remains editable in NEEDS_REVISION and REJECTED', () => {
    const record = createReadySubmission();
    markReady(record.submissionId, FULL_READY);
    enqueueSubmission(record.submissionId);
    markSubmitted(record.submissionId);
    markNeedsRevision(record.submissionId, 'Fix the title');
    expect(() => updateSubmissionDraft(record.submissionId, { titleSnapshot: 'Revised Title' })).not.toThrow();
  });
});

describe('markReady', () => {
  it('transitions DRAFT -> READY when validation passes', () => {
    const record = createReadySubmission();
    const { record: updated, validation } = markReady(record.submissionId, FULL_READY);
    expect(validation.valid).toBe(true);
    expect(updated.status).toBe('READY');
  });

  it('leaves the record unchanged and reports issues when validation fails', () => {
    const record = createSubmission({ patternId: 'p1', marketplaceId: 'etsy' }); // no title/description/keywords/category
    const { record: unchanged, validation } = markReady(record.submissionId, FULL_READY);
    expect(validation.valid).toBe(false);
    expect(unchanged.status).toBe('DRAFT');
    expect(getSubmission(record.submissionId)?.status).toBe('DRAFT');
  });
});

describe('full lifecycle transitions', () => {
  it('walks the golden path DRAFT -> READY -> QUEUED -> SUBMITTED -> APPROVED -> ARCHIVED', () => {
    const record = createReadySubmission();
    markReady(record.submissionId, FULL_READY);
    const queued = enqueueSubmission(record.submissionId);
    expect(queued.status).toBe('QUEUED');
    const submitted = markSubmitted(record.submissionId);
    expect(submitted.status).toBe('SUBMITTED');
    expect(submitted.submittedAt).not.toBeNull();
    const approved = markApproved(record.submissionId);
    expect(approved.status).toBe('APPROVED');
    const archived = archiveSubmission(record.submissionId, 'done');
    expect(archived.status).toBe('ARCHIVED');
  });

  it('supports the rejected -> draft -> ready resubmission loop', () => {
    const record = createReadySubmission();
    markReady(record.submissionId, FULL_READY);
    enqueueSubmission(record.submissionId);
    markSubmitted(record.submissionId);
    const rejected = markRejected(record.submissionId, 'Title too generic');
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.statusHistory.at(-1)).toEqual({ status: 'REJECTED', changedAt: rejected.updatedAt, note: 'Title too generic' });
    const draft = restoreSubmissionToDraft(record.submissionId);
    expect(draft.status).toBe('DRAFT');
    const { record: readyAgain } = markReady(record.submissionId, FULL_READY);
    expect(readyAgain.status).toBe('READY');
  });

  it('appends every transition to statusHistory in order', () => {
    const record = createReadySubmission();
    markReady(record.submissionId, FULL_READY);
    enqueueSubmission(record.submissionId);
    const final = markSubmitted(record.submissionId);
    expect(final.statusHistory.map((e) => e.status)).toEqual(['DRAFT', 'READY', 'QUEUED', 'SUBMITTED']);
  });

  it('rejects an illegal transition with InvalidSubmissionStatusTransitionError', () => {
    const record = createSubmission({ patternId: 'p1', marketplaceId: 'etsy' });
    expect(() => transitionSubmission(record.submissionId, 'SUBMITTED')).toThrow(InvalidSubmissionStatusTransitionError);
  });

  it('throws SubmissionNotFoundError transitioning an unknown id', () => {
    expect(() => transitionSubmission('SUB-00000000-ZZZZZZ', 'READY')).toThrow(SubmissionNotFoundError);
  });
});

describe('deleteSubmissionRecord', () => {
  it('removes the record permanently', () => {
    const record = createSubmission({ patternId: 'p1', marketplaceId: 'etsy' });
    deleteSubmissionRecord(record.submissionId);
    expect(getSubmission(record.submissionId)).toBeUndefined();
  });
});
