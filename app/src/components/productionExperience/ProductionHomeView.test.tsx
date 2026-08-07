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

  // Mission 7.5 Part 2 — a brand-new session with zero backlog (the
  // GENERATE recommendation) must be able to reach Completed without an
  // Autopilot detour. Covers the full real path: Start Factory -> Approve
  // -> "Generate Now" (real Autopilot generation + real Factory Batch) ->
  // Mark Session Complete.
  it('a brand-new session with zero backlog reaches Completed via "Generate Now", with no Autopilot detour required', async () => {
    render(<ProductionHomeView onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('▶ START FACTORY')).toBeInTheDocument());
    fireEvent.click(screen.getByText('▶ START FACTORY'));
    await waitFor(() => expect(screen.getByText('Production Progress')).toBeInTheDocument());

    const approveButton = await screen.findByText("Approve today's production session");
    fireEvent.click(approveButton);

    const generateNowButton = await screen.findByText('✨ Generate Now', {}, { timeout: 10000 });
    fireEvent.click(generateNowButton);

    // AI-SBOS Part 5 — a successful generation now auto-navigates to the
    // Preview Gallery (real produced assets, shown immediately, no extra
    // navigation needed to see them). Wait for that real navigation, then
    // go back to Progress to continue this test's real completion flow.
    await waitFor(() => expect(screen.getByRole('button', { name: /Gallery \(\d/ })).toBeInTheDocument(), { timeout: 30000 });
    fireEvent.click(screen.getByRole('button', { name: 'Progress' }));
    await waitFor(() => expect(screen.getByText('Production Progress')).toBeInTheDocument());

    // Real generation can legitimately leave some patterns below the
    // Commercial Readiness safety threshold (Build 031A Phase 9) — those
    // package/exportValidation tasks stay honestly BLOCKED rather than
    // being silently exported, in which case "Skip these and continue"
    // must be used before the session can complete. The app's own
    // established pattern (used by every handler in this file) clears
    // `busy` right before its final `await reload()`, so a button can
    // render enabled for one render with data from just before that
    // reload finishes — retry the click loop rather than assuming the
    // first enabled render already has fully fresh data.
    let completed = false;
    for (let attempt = 0; attempt < 10 && !completed; attempt++) {
      await waitFor(() => expect(screen.getByText('Mark Session Complete')).not.toBeDisabled(), { timeout: 30000 });
      const skipButton = screen.queryByText('Skip these and continue');
      if (skipButton && !skipButton.closest('button')?.disabled) {
        fireEvent.click(skipButton);
        await waitFor(() => expect(screen.getByText('Mark Session Complete')).not.toBeDisabled(), { timeout: 15000 });
        continue;
      }
      fireEvent.click(screen.getByText('Mark Session Complete'));
      try {
        await waitFor(() => expect(screen.queryByText('Mark Session Complete')).not.toBeInTheDocument(), { timeout: 3000 });
        completed = true;
      } catch {
        // Clicked during the stale-data window described above — the
        // completion review legitimately found un-terminal tasks it
        // hadn't seen yet. Loop back and re-observe the real state.
      }
    }
    expect(completed).toBe(true);
  }, 60000);
});
