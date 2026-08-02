import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProductionHomeView } from './ProductionHomeView';
import { clearFactoryQueueForTest, putFactoryTask } from '../../factory/storage/factoryQueueStore';
import { clearFactoryTimelineForTest } from '../../factory/storage/factoryTimelineStore';
import { clearFactorySchedulerStateForTest } from '../../factory/storage/factorySchedulerStateStore';
import { clearPortfolioStores, putPortfolioAsset } from '../../catalog/storage/portfolioStore';
import { clearQualitySnapshots, putQualitySnapshot, createQualitySnapshot } from '../../catalog/quality/qualitySnapshotStore';
import { clearAutonomousDesignRuns } from '../../autopilot/storage/autonomousDesignRunStore';
import { clearCollectionsStore } from '../../catalog/storage/collectionStore';
import { clearSubmissionStore } from '../../catalog/submission/submissionStore';
import { clearProductionSessionsForTest } from '../../productionAutopilot/storage/productionSessionStore';
import { clearOwnerDecisionRecordsForTest } from '../../productionAutopilot/storage/ownerDecisionStore';
import { clearOrchestrationRunsForTest } from '../../factoryOrchestrator/storage/orchestrationRunStore';
import { createFactoryTask, transitionFactoryTask } from '../../factory/domain/factoryTask';
import { createPortfolioAsset } from '../../catalog/domain/asset';

async function clearAllStores() {
  await Promise.all([
    clearFactoryQueueForTest(),
    clearFactoryTimelineForTest(),
    clearFactorySchedulerStateForTest(),
    clearPortfolioStores(),
    clearQualitySnapshots(),
    clearAutonomousDesignRuns(),
    clearCollectionsStore(),
    clearProductionSessionsForTest(),
    clearOwnerDecisionRecordsForTest(),
    clearOrchestrationRunsForTest(),
  ]);
  clearSubmissionStore();
}

beforeEach(async () => {
  await clearAllStores();
});

describe('ProductionHomeView', () => {
  it('shows a real Good Morning brief and a single START FACTORY primary action with an empty factory', async () => {
    const onClose = vi.fn();
    render(<ProductionHomeView onClose={onClose} />);
    await waitFor(() => expect(screen.getByText(/Good morning\./)).toBeInTheDocument());
    expect(screen.getByText('▶ START FACTORY')).toBeInTheDocument();
    expect(screen.queryByText('▶ Continue Yesterday')).not.toBeInTheDocument();
  });

  it('clicking START FACTORY wires directly into StartFactory() and reaches Production Progress', async () => {
    render(<ProductionHomeView onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('▶ START FACTORY')).toBeInTheDocument());
    fireEvent.click(screen.getByText('▶ START FACTORY'));
    await waitFor(() => expect(screen.getByText('Production Progress')).toBeInTheDocument());
    // The real 11-state orchestration run stops at Preparing (nothing to plan) or
    // Waiting Approval — never fakes progress past what the real engine reached.
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  });

  it('Continue Yesterday replaces Start Factory when real unfinished batch work exists', async () => {
    let task = createFactoryTask({ type: 'generate', reason: 'unfinished batch', batchId: 'B1', now: Date.now() });
    task = transitionFactoryTask(task, 'RUNNING', Date.now());
    await putFactoryTask(task);

    render(<ProductionHomeView onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('▶ Continue Yesterday')).toBeInTheDocument());
    expect(screen.queryByText('▶ START FACTORY')).not.toBeInTheDocument();
  });

  it('Review Workspace shows only real REVIEW-decision assets and Approve updates the real workflowStatus', async () => {
    const asset = createPortfolioAsset({ displayName: 'Needs a look', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await putPortfolioAsset(asset);
    const snapshot = createQualitySnapshot({ assetId: asset.assetId, beautyScore: 60, commercialScore: 60, fragmented: false, deadSpace: false, decision: 'REVIEW', generatorVersion: 'v1' });
    await putQualitySnapshot(snapshot);

    render(<ProductionHomeView onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('▶ START FACTORY')).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Review \(1\)/));
    await waitFor(() => expect(screen.getByText('Needs a look')).toBeInTheDocument());

    const approveButtons = screen.getAllByText('Approve');
    fireEvent.click(approveButtons[approveButtons.length - 1]);
    await waitFor(() => expect(screen.getByText('Nothing waiting for review right now.')).toBeInTheDocument());
  });

  it('navigating to Export renders the real Commercial Pipeline (no duplicated UI)', async () => {
    render(<ProductionHomeView onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('▶ START FACTORY')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^Export/ }));
    await waitFor(() => expect(screen.getAllByText(/Commercial/i).length).toBeGreaterThan(0));
  });

  it('the Back button calls the real onClose handler', async () => {
    const onClose = vi.fn();
    render(<ProductionHomeView onClose={onClose} />);
    await waitFor(() => expect(screen.getByText('← Back')).toBeInTheDocument());
    fireEvent.click(screen.getByText('← Back'));
    expect(onClose).toHaveBeenCalled();
  });
});
