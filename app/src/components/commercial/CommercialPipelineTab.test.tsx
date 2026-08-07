import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommercialPipelineTab } from './CommercialPipelineTab';
import { clearPortfolioStores, putPortfolioAsset } from '../../catalog/storage/portfolioStore';
import { clearCollectionsStore } from '../../catalog/storage/collectionStore';
import { resetSubmissionStoreForTest } from '../../catalog/submission/submissionStore';
import { createPortfolioAsset } from '../../catalog/domain/asset';
import { putQualitySnapshot, createQualitySnapshot } from '../../catalog/quality/qualitySnapshotStore';
import { loadCommercialPackageHistory } from '../../commercial/storage/commercialPackageHistoryStore';
import type { PortfolioAsset } from '../../catalog/domain/types';

beforeEach(async () => {
  await clearPortfolioStores();
  await clearCollectionsStore();
  await resetSubmissionStoreForTest();
});

function makeAsset(overrides: Partial<PortfolioAsset> = {}): PortfolioAsset {
  const asset = createPortfolioAsset({
    displayName: 'My Pattern',
    originalFilename: 'a.svg',
    sourceFileReferences: [{ fileId: 'f1', role: 'svg', filename: 'a.svg', mimeType: 'image/svg+xml', fileSize: 10, sha256: 'h' }],
    previewReference: 'f1',
    metadataReference: null,
    generatorVersion: 'v1.0',
    presetId: 'luxuryFloral',
  });
  return { ...asset, ...overrides };
}

describe('CommercialPipelineTab', () => {
  it('shows an honest zero state when nothing is in the portfolio', async () => {
    render(<CommercialPipelineTab assets={[]} />);
    await waitFor(() => expect(screen.getByText(/ทั้งหมด 0 ชิ้นงาน/)).toBeInTheDocument());
  });

  it('loads real readiness data for a stored asset and shows its score/checks', async () => {
    const asset = makeAsset();
    await putPortfolioAsset(asset);
    const snapshot = createQualitySnapshot({ assetId: asset.assetId, beautyScore: 90, commercialScore: 90, fragmented: false, deadSpace: false, decision: 'READY', generatorVersion: 'v1.0' });
    await putQualitySnapshot(snapshot);

    render(<CommercialPipelineTab assets={[asset]} />);
    await waitFor(() => expect(screen.getByText(/Commercial Readiness \d+%/)).toBeInTheDocument());
  });

  it('blocks the build when the readiness score is below the safety threshold, and records history only after a successful build', async () => {
    const asset = makeAsset({ collectionIds: [] });
    await putPortfolioAsset(asset);

    render(<CommercialPipelineTab assets={[asset]} />);
    await waitFor(() => expect(screen.getByText(/Commercial Readiness \d+%/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Build Commercial Package/ }));

    await waitFor(() => expect(screen.getByText(/⚠️/)).toBeInTheDocument());
    const history = await loadCommercialPackageHistory();
    expect(history).toHaveLength(0);
  });
});
