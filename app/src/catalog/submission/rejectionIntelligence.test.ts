import { describe, it, expect } from 'vitest';
import {
  normalizeRejectionReason,
  createRejectionRecord,
  normalizeRejectionRecord,
  isValidRejectionRecord,
  effectiveCategory,
  breakdownByCategory,
  REJECTION_CATEGORIES,
} from './rejectionIntelligence';
import type { RejectionRecord } from './rejectionIntelligence';

describe('normalizeRejectionReason', () => {
  it('classifies duplicate-content text', () => {
    expect(normalizeRejectionReason('This is a duplicate of a previous submission.')).toBe('duplicate-content');
  });

  it('classifies trademark text', () => {
    expect(normalizeRejectionReason('Contains a recognizable brand logo.')).toBe('trademark');
  });

  it('classifies copyright text', () => {
    expect(normalizeRejectionReason('Potential copyright infringement.')).toBe('copyright');
  });

  it('classifies AI policy text', () => {
    expect(normalizeRejectionReason('This appears to be AI-generated content.')).toBe('ai-policy');
  });

  it('classifies vector construction text', () => {
    expect(normalizeRejectionReason('File contains open paths and stray points.')).toBe('vector-construction');
  });

  it('classifies keyword issue text', () => {
    expect(normalizeRejectionReason('Keyword spam detected.')).toBe('keyword-issue');
  });

  it('falls back to "other" for unrecognized text, never silently dropping it', () => {
    expect(normalizeRejectionReason('Completely unrelated gibberish reason xyz123')).toBe('other');
  });

  it('every returned category is a member of the documented taxonomy', () => {
    const samples = ['duplicate', 'trademark', 'copyright', 'AI generated', 'random text', ''];
    for (const s of samples) {
      expect(REJECTION_CATEGORIES).toContain(normalizeRejectionReason(s));
    }
  });
});

describe('createRejectionRecord', () => {
  it('auto-normalizes the marketplace reason text', () => {
    const record = createRejectionRecord({ submissionId: 'SUB-1', marketplaceReasonText: 'Duplicate content detected' });
    expect(record.normalizedReason).toBe('duplicate-content');
    expect(record.correctedCategory).toBeNull();
    expect(record.resubmissionResult).toBeNull();
  });

  it('preserves the marketplace text verbatim', () => {
    const text = 'Some VERY specific marketplace wording.';
    const record = createRejectionRecord({ submissionId: 'SUB-1', marketplaceReasonText: text });
    expect(record.marketplaceReasonText).toBe(text);
  });
});

describe('normalizeRejectionRecord', () => {
  it('fills missing optional fields with safe defaults', () => {
    const partial = { rejectionId: 'REJ-1', submissionId: 'SUB-1', marketplaceReasonText: 'x', normalizedReason: 'other' } as RejectionRecord;
    const normalized = normalizeRejectionRecord(partial);
    expect(normalized.userInterpretation).toBe('');
    expect(normalized.correctedCategory).toBeNull();
  });
});

describe('isValidRejectionRecord', () => {
  it('rejects malformed values', () => {
    expect(isValidRejectionRecord(null)).toBe(false);
    expect(isValidRejectionRecord({})).toBe(false);
  });

  it('accepts a well-formed record', () => {
    const record = createRejectionRecord({ submissionId: 'SUB-1', marketplaceReasonText: 'test' });
    expect(isValidRejectionRecord(record)).toBe(true);
  });
});

describe('effectiveCategory', () => {
  it('prefers a human correction over the automated guess', () => {
    const record = createRejectionRecord({ submissionId: 'SUB-1', marketplaceReasonText: 'Duplicate content' });
    expect(effectiveCategory(record)).toBe('duplicate-content');
    const corrected = { ...record, correctedCategory: 'similarity' as const };
    expect(effectiveCategory(corrected)).toBe('similarity');
  });
});

describe('breakdownByCategory', () => {
  it('groups by effective category, most common first', () => {
    const records = [
      createRejectionRecord({ submissionId: 'SUB-1', marketplaceReasonText: 'Duplicate content' }),
      createRejectionRecord({ submissionId: 'SUB-2', marketplaceReasonText: 'Duplicate again' }),
      createRejectionRecord({ submissionId: 'SUB-3', marketplaceReasonText: 'Trademark issue' }),
    ];
    const result = breakdownByCategory(records);
    expect(result[0]).toEqual({ category: 'duplicate-content', count: 2 });
    expect(result[1]).toEqual({ category: 'trademark', count: 1 });
  });

  it('does not automatically treat every rejection as a generator defect (categories are marketplace/metadata/etc., not "generator-bug")', () => {
    const records = [createRejectionRecord({ submissionId: 'SUB-1', marketplaceReasonText: 'Duplicate content' })];
    const result = breakdownByCategory(records);
    expect(result.every((r) => REJECTION_CATEGORIES.includes(r.category))).toBe(true);
  });
});
