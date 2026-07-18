import { describe, it, expect } from 'vitest';
import { computePortfolioHealth, countDuplicateConflictingSubmissions } from './portfolioHealthCalculator';
import { computeSeoAnalytics } from './seoAnalytics';
import { computeCollectionAnalytics } from './collectionAnalytics';
import { computeReadinessAnalytics } from './readinessAnalytics';
import { createSubmissionRecord } from '../submission/submissionRecord';
import type { CreateSubmissionInput } from '../submission/submissionRecord';
import { createCollection } from '../domain/collection';
import { createPortfolioAsset } from '../domain/asset';
import type { PortfolioAsset } from '../domain/types';

const GOOD_CONTENT = {
  marketplaceId: 'shutterstock',
  titleSnapshot: 'Seamless Pastel Floral Spring Pattern With Botanical Motifs',
  descriptionSnapshot: 'This seamless floral pattern brings a soft, pastel spring feel to any project. It works beautifully on fabric and wallpaper.',
  keywordSnapshot: ['seamless', 'floral', 'pastel', 'fabric', 'wallpaper', 'spring', 'botanical', 'vector', 'editable'],
  category: 'Patterns',
};

function goodSubmission(patternId: string, overrides: Partial<CreateSubmissionInput> = {}) {
  return createSubmissionRecord({ patternId, ...GOOD_CONTENT, ...overrides } as CreateSubmissionInput);
}

function asset(): PortfolioAsset {
  return createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
}

describe('computePortfolioHealth — empty portfolio', () => {
  it('returns 0 for overall and every component when there is nothing to score', () => {
    const seo = computeSeoAnalytics([]);
    const collections = computeCollectionAnalytics([], []);
    const readiness = computeReadinessAnalytics([], []);
    const health = computePortfolioHealth([], seo, collections, readiness);
    expect(health.overall).toBe(0);
    expect(health.components).toEqual({ seoScore: 0, submissionReadiness: 0, metadataCompleteness: 0, duplicateRisk: 0, collectionOrganization: 0, validationStatus: 0 });
  });
});

describe('computePortfolioHealth — overall is the average of the 6 components', () => {
  it('matches its own component sum, for a real mixed portfolio', () => {
    const a1 = asset();
    const a2 = asset();
    const collection = createCollection({ name: 'Spring 2026' });
    const records = [{ ...goodSubmission(a1.assetId), status: 'READY' as const }, goodSubmission(a2.assetId)];
    const seo = computeSeoAnalytics(records);
    const collections = computeCollectionAnalytics([collection], [{ ...a1, collectionIds: [collection.id] }, a2]);
    const readiness = computeReadinessAnalytics([a1, a2], records);
    const health = computePortfolioHealth(records, seo, collections, readiness);
    const expected = Math.round((health.components.seoScore + health.components.submissionReadiness + health.components.metadataCompleteness + health.components.duplicateRisk + health.components.collectionOrganization + health.components.validationStatus) / 6);
    expect(health.overall).toBe(expected);
  });
});

describe('computePortfolioHealth — components respond to real signals', () => {
  it('metadataCompleteness drops when submissions are missing fields', () => {
    const complete = goodSubmission('p1');
    const incomplete = createSubmissionRecord({ patternId: 'p2', marketplaceId: 'shutterstock' }); // bare, nothing filled in
    const seoComplete = computeSeoAnalytics([complete]);
    const seoMixed = computeSeoAnalytics([complete, incomplete]);
    const readiness = computeReadinessAnalytics([], []);
    const collections = computeCollectionAnalytics([], []);
    const healthComplete = computePortfolioHealth([complete], seoComplete, collections, readiness);
    const healthMixed = computePortfolioHealth([complete, incomplete], seoMixed, collections, readiness);
    expect(healthMixed.components.metadataCompleteness).toBeLessThan(healthComplete.components.metadataCompleteness);
  });

  it('duplicateRisk drops when submissions have real duplicate conflicts', () => {
    const clean = [goodSubmission('p1'), goodSubmission('p2')];
    const approved = { ...goodSubmission('p3'), status: 'APPROVED' as const };
    const conflicting = [...clean, approved, goodSubmission('p3', { version: 2 })]; // p3 already approved, resubmitted
    const seoClean = computeSeoAnalytics(clean);
    const seoConflicting = computeSeoAnalytics(conflicting);
    const readiness = computeReadinessAnalytics([], []);
    const collections = computeCollectionAnalytics([], []);
    const healthClean = computePortfolioHealth(clean, seoClean, collections, readiness);
    const healthConflicting = computePortfolioHealth(conflicting, seoConflicting, collections, readiness);
    expect(healthConflicting.components.duplicateRisk).toBeLessThan(healthClean.components.duplicateRisk);
    expect(healthClean.components.duplicateRisk).toBe(100);
  });

  it('collectionOrganization reflects the ratio of organized to total patterns', () => {
    const a1 = asset();
    const a2 = asset();
    const collection = createCollection({ name: 'Spring' });
    const collections = computeCollectionAnalytics([collection], [{ ...a1, collectionIds: [collection.id] }, a2]);
    const readiness = computeReadinessAnalytics([a1, a2], []);
    const seo = computeSeoAnalytics([]);
    const health = computePortfolioHealth([], seo, collections, readiness);
    expect(health.components.collectionOrganization).toBe(50); // 1 of 2 organized
  });

  it('submissionReadiness matches readinessAnalytics.readinessRate exactly', () => {
    const a1 = asset();
    const readiness = computeReadinessAnalytics([a1], [{ ...goodSubmission(a1.assetId), status: 'READY' as const }]);
    const seo = computeSeoAnalytics([]);
    const collections = computeCollectionAnalytics([], []);
    const health = computePortfolioHealth([], seo, collections, readiness);
    expect(health.components.submissionReadiness).toBe(readiness.readinessRate);
  });

  it('validationStatus is 100 when every submission validates cleanly', () => {
    const records = [goodSubmission('p1'), goodSubmission('p2')];
    const seo = computeSeoAnalytics(records);
    const readiness = computeReadinessAnalytics([], []);
    const collections = computeCollectionAnalytics([], []);
    const health = computePortfolioHealth(records, seo, collections, readiness);
    expect(health.components.validationStatus).toBe(100);
  });

  it('validationStatus drops when a submission fails marketplace validation', () => {
    const valid = goodSubmission('p1');
    const invalid = createSubmissionRecord({ patternId: 'p2', marketplaceId: 'shutterstock' }); // fails every rule
    const seo = computeSeoAnalytics([valid, invalid]);
    const readiness = computeReadinessAnalytics([], []);
    const collections = computeCollectionAnalytics([], []);
    const health = computePortfolioHealth([valid, invalid], seo, collections, readiness);
    expect(health.components.validationStatus).toBe(50);
  });
});

describe('countDuplicateConflictingSubmissions', () => {
  it('returns 0 for an empty or conflict-free list', () => {
    expect(countDuplicateConflictingSubmissions([])).toBe(0);
    expect(countDuplicateConflictingSubmissions([goodSubmission('p1'), goodSubmission('p2')])).toBe(0);
  });

  it('counts the new attempt that conflicts with an already-approved original, not the original itself', () => {
    // Matches detectDuplicateSubmission's own asymmetric semantics
    // (submissionDuplicateDetection.test.ts): the APPROVED original has
    // nothing blocking IT specifically; the new draft attempt is the one
    // that would be blocked from becoming Ready/Submitted.
    const approved = { ...goodSubmission('p1'), status: 'APPROVED' as const };
    const newAttempt = goodSubmission('p1', { version: 2 });
    expect(countDuplicateConflictingSubmissions([approved, newAttempt])).toBe(1);
  });
});
