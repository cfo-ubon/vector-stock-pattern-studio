import { describe, it, expect } from 'vitest';
import { computeCommercialReadiness } from './readinessEngine';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { createQualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import { createSubmissionRecord } from '../catalog/submission/submissionRecord';
import type { PortfolioAsset, SourceFileReference } from '../catalog/domain/types';

function fileRef(role: SourceFileReference['role'], fileId = `${role}-file`): SourceFileReference {
  return { fileId, role, filename: `${role}.file`, mimeType: 'application/octet-stream', fileSize: 100, sha256: `hash-${fileId}` };
}

function makeAsset(overrides: Partial<PortfolioAsset> = {}): PortfolioAsset {
  const asset = createPortfolioAsset({
    displayName: 'Test Pattern',
    originalFilename: 'test.svg',
    sourceFileReferences: [fileRef('svg'), fileRef('eps'), fileRef('preview'), fileRef('json')],
    previewReference: 'preview-file',
    metadataReference: 'json-file',
    generatorVersion: 'v1.0',
    presetId: 'luxuryFloral',
    productionAssetId: 'PA-1',
  });
  return { ...asset, ...overrides };
}

describe('computeCommercialReadiness', () => {
  it('scores a fully-complete asset as READY with every check PASS', () => {
    const asset = makeAsset({ collectionIds: ['col-1'] });
    const snapshot = createQualitySnapshot({ assetId: asset.assetId, beautyScore: 90, commercialScore: 88, fragmented: false, deadSpace: false, decision: 'READY', generatorVersion: 'v1.0' });
    const submission = { ...createSubmissionRecord({ patternId: asset.assetId, marketplaceId: 'etsy' }), titleSnapshot: 'A lovely floral pattern', keywordSnapshot: ['floral', 'seamless', 'botanical'] };

    const report = computeCommercialReadiness({ asset, qualitySnapshot: snapshot, submissionsForAsset: [submission], siblingAssets: [], now: 5000 });

    expect(report.band).toBe('READY');
    expect(report.failingChecks).toEqual([]);
    expect(report.score).toBeGreaterThanOrEqual(95);
    expect(report.computedAt).toBe(5000);
    expect(report.checks).toHaveLength(14);
  });

  it('reports FAIL, not a fabricated PASS, when there is no quality snapshot at all', () => {
    const asset = makeAsset({ collectionIds: ['col-1'] });
    const report = computeCommercialReadiness({ asset, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: [] });

    const qa = report.checks.find((c) => c.id === 'qaPassed')!;
    const commercial = report.checks.find((c) => c.id === 'commercialScoreAvailable')!;
    const beauty = report.checks.find((c) => c.id === 'beautyScoreAvailable')!;
    expect(qa.status).toBe('FAIL');
    expect(commercial.status).toBe('FAIL');
    expect(beauty.status).toBe('FAIL');
  });

  it('is BLOCKED when a fundamental check fails even if the score is otherwise high', () => {
    const asset = makeAsset({ collectionIds: [] }); // no collection assignment
    const snapshot = createQualitySnapshot({ assetId: asset.assetId, beautyScore: 95, commercialScore: 95, fragmented: false, deadSpace: false, decision: 'READY', generatorVersion: 'v1.0' });
    const submission = { ...createSubmissionRecord({ patternId: asset.assetId, marketplaceId: 'etsy' }), titleSnapshot: 'Title', keywordSnapshot: ['a', 'b'] };

    const report = computeCommercialReadiness({ asset, qualitySnapshot: snapshot, submissionsForAsset: [submission], siblingAssets: [] });

    expect(report.band).toBe('BLOCKED');
    expect(report.failingChecks).toContain('collectionAssignment');
  });

  it('flags duplicateCheckComplete as FAIL when a sibling shares the same production fingerprint', () => {
    const asset = makeAsset({ collectionIds: ['col-1'], productionAssetId: 'PA-DUP' });
    const sibling = makeAsset({ collectionIds: ['col-1'], productionAssetId: 'PA-DUP' });

    const report = computeCommercialReadiness({ asset, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: [sibling] });

    const dup = report.checks.find((c) => c.id === 'duplicateCheckComplete')!;
    expect(dup.status).toBe('FAIL');
    expect(dup.detail).toContain(sibling.displayName);
  });

  it('never fabricates a duplicate PASS when no production fingerprint exists — reports WARNING instead', () => {
    const asset = makeAsset({ collectionIds: ['col-1'], productionAssetId: null });
    const report = computeCommercialReadiness({ asset, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: [] });
    const dup = report.checks.find((c) => c.id === 'duplicateCheckComplete')!;
    expect(dup.status).toBe('WARNING');
  });

  it('reports seoExists as FAIL when no submission exists, WARNING when incomplete, PASS when complete', () => {
    const asset = makeAsset({ collectionIds: ['col-1'] });

    const noSubmission = computeCommercialReadiness({ asset, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: [] });
    expect(noSubmission.checks.find((c) => c.id === 'seoExists')!.status).toBe('FAIL');

    const incomplete = { ...createSubmissionRecord({ patternId: asset.assetId, marketplaceId: 'etsy' }), titleSnapshot: '', keywordSnapshot: [] };
    const withIncomplete = computeCommercialReadiness({ asset, qualitySnapshot: null, submissionsForAsset: [incomplete], siblingAssets: [] });
    expect(withIncomplete.checks.find((c) => c.id === 'seoExists')!.status).toBe('WARNING');

    const complete = { ...createSubmissionRecord({ patternId: asset.assetId, marketplaceId: 'etsy' }), titleSnapshot: 'Title', keywordSnapshot: ['a', 'b'] };
    const withComplete = computeCommercialReadiness({ asset, qualitySnapshot: null, submissionsForAsset: [complete], siblingAssets: [] });
    expect(withComplete.checks.find((c) => c.id === 'seoExists')!.status).toBe('PASS');
  });
});
