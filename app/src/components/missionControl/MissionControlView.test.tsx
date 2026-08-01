import { describe, it, expect, beforeEach, vi } from 'vitest';
import { File as NodeFile } from 'node:buffer';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MissionControlView, type MissionControlAutopilotAction } from './MissionControlView';
import { clearPortfolioStores } from '../../catalog/storage/portfolioStore';
import { clearAutonomousDesignRuns } from '../../autopilot/storage/autonomousDesignRunStore';
import { clearMarketOpportunities } from '../../marketing/storage/marketOpportunityStore';
import { clearDailyMissions } from '../../marketing/storage/dailyMissionStore';
import { clearSeasonalEvents } from '../../marketing/storage/seasonalEventStore';
import { clearMarketSnapshots } from '../../marketing/storage/marketSnapshotStore';
import { clearCollectionsStore } from '../../catalog/storage/collectionStore';
import { clearSubmissionStore } from '../../catalog/submission/submissionStore';
import { clearProductionQueueItems } from '../../catalog/queue/productionQueueStore';

// Same jsdom-File workaround AutopilotView.test.tsx uses.
beforeEach(() => {
  vi.stubGlobal('File', NodeFile);
});

async function clearAllStores() {
  await Promise.all([
    clearPortfolioStores(),
    clearAutonomousDesignRuns(),
    clearMarketOpportunities(),
    clearDailyMissions(),
    clearSeasonalEvents(),
    clearMarketSnapshots(),
    clearCollectionsStore(),
    clearProductionQueueItems(),
  ]);
  clearSubmissionStore();
}

beforeEach(async () => {
  await clearAllStores();
});

function renderView(overrides: Partial<Parameters<typeof MissionControlView>[0]> = {}) {
  const onStartAutopilot = vi.fn();
  const onOpenPortfolio = vi.fn();
  const onOpenMarketing = vi.fn();
  const onOpenDesignDirector = vi.fn();
  const onOpenAutopilotHistory = vi.fn();
  const onOpenAdvancedMode = vi.fn();
  render(
    <MissionControlView
      onStartAutopilot={onStartAutopilot}
      onOpenPortfolio={onOpenPortfolio}
      onOpenMarketing={onOpenMarketing}
      onOpenDesignDirector={onOpenDesignDirector}
      onOpenAutopilotHistory={onOpenAutopilotHistory}
      onOpenAdvancedMode={onOpenAdvancedMode}
      {...overrides}
    />,
  );
  return { onStartAutopilot, onOpenPortfolio, onOpenMarketing, onOpenDesignDirector, onOpenAutopilotHistory, onOpenAdvancedMode };
}

describe('MissionControlView', () => {
  it('shows an honest fallback opportunity (no fabricated commercial score) with zero market data seeded', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('✨ Good Morning')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/Estimated Commercial Score/)).toBeInTheDocument());
    // No opportunities/missions seeded -> honest null score, shown as em dash, not a fabricated number.
    const scoreValue = screen.getByText(/Estimated Commercial Score/).closest('.mc-hero-metric')?.querySelector('.mc-hero-metric-value');
    expect(scoreValue?.textContent).toBe('—');
  });

  it('"Start Today\'s Mission" hands off a real TODAYS_MISSION action to the parent', async () => {
    const { onStartAutopilot } = renderView();
    await waitFor(() => expect(screen.getByText("✨ Start Today's Mission")).toBeInTheDocument());
    fireEvent.click(screen.getByText("✨ Start Today's Mission"));
    expect(onStartAutopilot).toHaveBeenCalledTimes(1);
    const action = onStartAutopilot.mock.calls[0][0] as MissionControlAutopilotAction;
    expect(action.mode).toBe('TODAYS_MISSION');
  });

  it('clicking a Goal Mode button hands off the correctly-resolved action', async () => {
    const { onStartAutopilot } = renderView();
    await waitFor(() => expect(screen.getByText('Fill Portfolio Gaps')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Fill Portfolio Gaps'));
    expect(onStartAutopilot).toHaveBeenCalledWith(expect.objectContaining({ mode: 'PORTFOLIO_GAP' }));
  });

  it('the AI Command Bar interprets "Analyze my portfolio" as real navigation, not a generation goal', async () => {
    const { onOpenPortfolio, onStartAutopilot } = renderView();
    await waitFor(() => expect(screen.getByPlaceholderText(/Ask AI/)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/Ask AI/), { target: { value: 'Analyze my portfolio' } });
    fireEvent.submit(screen.getByPlaceholderText(/Ask AI/).closest('form')!);
    expect(onOpenPortfolio).toHaveBeenCalledTimes(1);
    expect(onStartAutopilot).not.toHaveBeenCalled();
  });

  it('Today\'s Business Status shows real zero counts for a fresh install, never fabricated placeholders', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText("Today's Business Status")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Portfolio Health')).toBeInTheDocument());
    const healthValue = screen.getByText('Portfolio Health').closest('.mc-status-item')?.querySelector('.mc-status-value');
    expect(healthValue?.textContent).toBe('0');
  });
});
