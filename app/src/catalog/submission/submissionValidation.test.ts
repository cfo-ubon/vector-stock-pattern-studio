import { describe, it, expect, afterEach } from 'vitest';
import { validateSubmissionReadiness } from './submissionValidation';
import type { SubmissionReadinessInput } from './submissionValidation';
import { createSubmissionRecord } from './submissionRecord';
import { registerMarketplaceProfile, resetMarketplaceProfileRegistry } from './marketplaceProfile';

afterEach(() => {
  resetMarketplaceProfileRegistry();
});

const FULL_READY: SubmissionReadinessInput = { hasSvg: true, hasPreview: true };

function readyRecord(overrides: Partial<Parameters<typeof createSubmissionRecord>[0]> = {}) {
  return createSubmissionRecord({
    patternId: 'p1',
    marketplaceId: 'etsy',
    titleSnapshot: 'Floral Seamless Pattern',
    descriptionSnapshot: 'A lush spring floral pattern with soft pastel colors.',
    keywordSnapshot: ['floral', 'spring', 'seamless', 'pastel', 'nature'],
    category: 'Patterns',
    ...overrides,
  });
}

describe('validateSubmissionReadiness — fully valid submission', () => {
  it('passes with zero issues when every requirement is met', () => {
    const record = readyRecord();
    const report = validateSubmissionReadiness(record, FULL_READY, []);
    expect(report.valid).toBe(true);
    expect(report.issues).toEqual([]);
  });
});

describe('validateSubmissionReadiness — individual required checks', () => {
  it('flags missing-svg', () => {
    const report = validateSubmissionReadiness(readyRecord(), { hasSvg: false, hasPreview: true }, []);
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'missing-svg')).toBe(true);
  });

  it('flags missing-preview', () => {
    const report = validateSubmissionReadiness(readyRecord(), { hasSvg: true, hasPreview: false }, []);
    expect(report.issues.some((i) => i.code === 'missing-preview')).toBe(true);
  });

  it('flags missing-title for an empty or whitespace-only title', () => {
    expect(validateSubmissionReadiness(readyRecord({ patternId: 'p1', marketplaceId: 'etsy', titleSnapshot: '' }), FULL_READY, []).issues.some((i) => i.code === 'missing-title')).toBe(true);
    expect(validateSubmissionReadiness(readyRecord({ patternId: 'p1', marketplaceId: 'etsy', titleSnapshot: '   ' }), FULL_READY, []).issues.some((i) => i.code === 'missing-title')).toBe(true);
  });

  it('flags missing-description when the marketplace requires one', () => {
    const record = readyRecord({ patternId: 'p1', marketplaceId: 'etsy', descriptionSnapshot: '' });
    const report = validateSubmissionReadiness(record, FULL_READY, []);
    expect(report.issues.some((i) => i.code === 'missing-description')).toBe(true);
  });

  it('does not require a description for a marketplace with requiresDescription: false', () => {
    registerMarketplaceProfile({ id: 'no-desc-market', label: 'No Desc Market', builtin: false, minKeywords: 1, maxKeywords: 50, requiresDescription: false, requiresCategory: true });
    const record = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'no-desc-market', titleSnapshot: 'T', descriptionSnapshot: '', keywordSnapshot: ['a'], category: 'C' });
    const report = validateSubmissionReadiness(record, FULL_READY, []);
    expect(report.issues.some((i) => i.code === 'missing-description')).toBe(false);
  });

  it('flags insufficient-keywords below the marketplace minimum (Etsy: 5)', () => {
    const record = readyRecord({ patternId: 'p1', marketplaceId: 'etsy', keywordSnapshot: ['only', 'two'] });
    const report = validateSubmissionReadiness(record, FULL_READY, []);
    expect(report.issues.some((i) => i.code === 'insufficient-keywords')).toBe(true);
  });

  it('flags too-many-keywords above the marketplace maximum (Etsy: 13)', () => {
    const record = readyRecord({ patternId: 'p1', marketplaceId: 'etsy', keywordSnapshot: Array.from({ length: 14 }, (_, i) => `kw${i}`) });
    const report = validateSubmissionReadiness(record, FULL_READY, []);
    expect(report.issues.some((i) => i.code === 'too-many-keywords')).toBe(true);
  });

  it('flags missing-category when the marketplace requires one', () => {
    const record = readyRecord({ patternId: 'p1', marketplaceId: 'etsy', category: null });
    const report = validateSubmissionReadiness(record, FULL_READY, []);
    expect(report.issues.some((i) => i.code === 'missing-category')).toBe(true);
  });

  it('flags unknown-marketplace and stops early (no marketplace-relative checks make sense without a profile)', () => {
    const record = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'not-a-real-marketplace' });
    const report = validateSubmissionReadiness(record, FULL_READY, []);
    expect(report.valid).toBe(false);
    expect(report.issues).toEqual([{ severity: 'error', code: 'unknown-marketplace', message: expect.any(String) }]);
  });

  it('reports every simultaneous issue, not just the first one found', () => {
    const bare = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' });
    const report = validateSubmissionReadiness(bare, { hasSvg: false, hasPreview: false }, []);
    const codes = report.issues.map((i) => i.code).sort();
    expect(codes).toEqual(['insufficient-keywords', 'missing-category', 'missing-description', 'missing-preview', 'missing-svg', 'missing-title']);
  });
});

describe('validateSubmissionReadiness — duplicate integration', () => {
  it('flags duplicate-submission when detectDuplicateSubmission would flag a conflict', () => {
    const existing = readyRecord();
    const candidate = readyRecord(); // same patternId/marketplaceId/version as existing, different submissionId
    const report = validateSubmissionReadiness(candidate, FULL_READY, [existing]);
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'duplicate-submission')).toBe(true);
  });

  it('does not flag its own already-persisted record as a duplicate of itself', () => {
    const record = readyRecord();
    const report = validateSubmissionReadiness(record, FULL_READY, [record]);
    expect(report.issues.some((i) => i.code === 'duplicate-submission')).toBe(false);
  });
});
