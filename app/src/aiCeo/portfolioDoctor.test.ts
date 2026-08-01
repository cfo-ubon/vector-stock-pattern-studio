import { describe, it, expect } from 'vitest';
import { buildPortfolioDiagnosis, defaultPortfolioDoctorPreferences, type PortfolioDoctorInput } from './portfolioDoctor';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { createQualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import { createAutonomousDesignRun } from '../autopilot/domain/autonomousDesignRun';
import { buildDashboardSnapshot } from '../catalog/dashboard/dashboardSnapshot';

const EMPTY_DASHBOARD = buildDashboardSnapshot({ collections: [], assets: [], submissions: [], now: 1000 });

function baseInput(overrides: Partial<PortfolioDoctorInput> = {}): PortfolioDoctorInput {
  return {
    portfolioAssets: [],
    qualitySnapshots: [],
    autonomousRuns: [],
    dashboard: EMPTY_DASHBOARD,
    preferences: defaultPortfolioDoctorPreferences(),
    now: 100000,
    ...overrides,
  };
}

describe('buildPortfolioDiagnosis — honest empty-portfolio state', () => {
  it('an empty Portfolio is diagnosed INSUFFICIENT_DATA, never HEALTHY or UNBALANCED by guesswork', () => {
    const diagnosis = buildPortfolioDiagnosis(baseInput());
    expect(diagnosis.overallVerdict).toBe('INSUFFICIENT_DATA');
    expect(diagnosis.findings.length).toBeGreaterThan(0);
    // Findings that genuinely have nothing to evaluate (category
    // concentration, review/reject rate, submission prep) are all
    // INSUFFICIENT_DATA; "0 empty collections" is a real, trivially true
    // fact even on an empty Portfolio, so it legitimately reads HEALTHY —
    // the overall roll-up still reports INSUFFICIENT_DATA (asserted above)
    // because it is honest about the majority having nothing to evaluate.
    const insufficientCount = diagnosis.findings.filter((f) => f.verdict === 'INSUFFICIENT_DATA').length;
    expect(insufficientCount * 2).toBeGreaterThanOrEqual(diagnosis.findings.length);
  });
});

describe('buildPortfolioDiagnosis — category concentration is evidence-based and configurable', () => {
  it('flags UNBALANCED only once a category crosses the configured oversupply share', () => {
    const heavy = Array.from({ length: 6 }, (_, i) => createPortfolioAsset({ displayName: `B${i}`, originalFilename: `b${i}.svg`, sourceFileReferences: [], previewReference: null, metadataReference: null, presetId: 'botanical' }));
    const other = createPortfolioAsset({ displayName: 'G', originalFilename: 'g.svg', sourceFileReferences: [], previewReference: null, metadataReference: null, presetId: 'geometric' });
    const diagnosis = buildPortfolioDiagnosis(baseInput({ portfolioAssets: [...heavy, other] }));
    const finding = diagnosis.findings.find((f) => f.code === 'category-concentration')!;
    expect(finding.verdict).toBe('UNBALANCED');
    expect(finding.affectedCount).toBe(6);
    expect(finding.sendToAutopilotAction?.mode).toBe('PORTFOLIO_GAP');
  });

  it('a higher configured oversupply threshold can turn the same Portfolio HEALTHY (user-configurable rule)', () => {
    const heavy = Array.from({ length: 6 }, (_, i) => createPortfolioAsset({ displayName: `B${i}`, originalFilename: `b${i}.svg`, sourceFileReferences: [], previewReference: null, metadataReference: null, presetId: 'botanical' }));
    const other = createPortfolioAsset({ displayName: 'G', originalFilename: 'g.svg', sourceFileReferences: [], previewReference: null, metadataReference: null, presetId: 'geometric' });
    const diagnosis = buildPortfolioDiagnosis(baseInput({ portfolioAssets: [...heavy, other], preferences: { oversupplyShare: 0.95 } }));
    expect(diagnosis.findings.find((f) => f.code === 'category-concentration')!.verdict).toBe('HEALTHY');
  });
});

describe('buildPortfolioDiagnosis — real REVIEW/REJECT rate from QualitySnapshot', () => {
  it('a high REVIEW/REJECT rate is NEEDS_ATTENTION with a real count, never fabricated', () => {
    const assets = Array.from({ length: 4 }, (_, i) => createPortfolioAsset({ displayName: `A${i}`, originalFilename: `a${i}.svg`, sourceFileReferences: [], previewReference: null, metadataReference: null, presetId: 'botanical' }));
    const snapshots = assets.map((a, i) =>
      createQualitySnapshot({ assetId: a.assetId, beautyScore: 50, commercialScore: 50, fragmented: false, deadSpace: false, decision: i < 2 ? 'REJECT' : 'READY', generatorVersion: 'test', now: 1 }),
    );
    const diagnosis = buildPortfolioDiagnosis(baseInput({ portfolioAssets: assets, qualitySnapshots: snapshots }));
    const finding = diagnosis.findings.find((f) => f.code === 'review-reject-rate')!;
    expect(finding.verdict).toBe('NEEDS_ATTENTION');
    expect(finding.affectedCount).toBe(2);
  });
});

describe('buildPortfolioDiagnosis — real un-imported READY items from AutonomousDesignRun', () => {
  it('counts real READY items with no portfolioAssetId across runs', () => {
    let run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 1, now: 1 });
    run = { ...run, items: [{ collectionItemId: 'CI-1', generatorHandoffId: null, portfolioAssetId: null, qualitySnapshotId: null, decision: 'READY', repairAttempts: 0, error: null, completedAt: 4 }] };
    const diagnosis = buildPortfolioDiagnosis(baseInput({ autonomousRuns: [run] }));
    const finding = diagnosis.findings.find((f) => f.code === 'ready-not-imported')!;
    expect(finding.verdict).toBe('NEEDS_ATTENTION');
    expect(finding.affectedCount).toBe(1);
  });
});

describe('buildPortfolioDiagnosis — submission-prep readiness from PortfolioAsset.workflowStatus', () => {
  it('counts real DRAFT/READY_FOR_REVIEW assets as not prepared for submission', () => {
    const draft = createPortfolioAsset({ displayName: 'D', originalFilename: 'd.svg', sourceFileReferences: [], previewReference: null, metadataReference: null, presetId: 'botanical' });
    const diagnosis = buildPortfolioDiagnosis(baseInput({ portfolioAssets: [draft] }));
    const finding = diagnosis.findings.find((f) => f.code === 'not-prepared-for-submission')!;
    expect(finding.verdict).toBe('NEEDS_ATTENTION');
    expect(finding.affectedCount).toBe(1);
  });
});
