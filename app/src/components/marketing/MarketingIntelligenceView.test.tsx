import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MarketingIntelligenceView } from './MarketingIntelligenceView';
import { clearMarketSnapshots } from '../../marketing/storage/marketSnapshotStore';
import { clearMarketObservations } from '../../marketing/storage/marketObservationStore';
import { clearMarketKeywords } from '../../marketing/storage/marketKeywordStore';
import { clearMarketOpportunities } from '../../marketing/storage/marketOpportunityStore';
import { clearDailyMissions } from '../../marketing/storage/dailyMissionStore';
import { clearSeasonalEvents } from '../../marketing/storage/seasonalEventStore';
import { clearResearchSources } from '../../marketing/storage/researchSourceStore';
import { clearScoringProfiles } from '../../marketing/storage/scoringProfileStore';

async function clearAllMarketingStores() {
  await Promise.all([
    clearMarketSnapshots(),
    clearMarketObservations(),
    clearMarketKeywords(),
    clearMarketOpportunities(),
    clearDailyMissions(),
    clearSeasonalEvents(),
    clearResearchSources(),
    clearScoringProfiles(),
  ]);
}

describe('MarketingIntelligenceView', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await clearAllMarketingStores();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('shows an honest empty state (no fabricated data) when no snapshot exists yet', async () => {
    render(<MarketingIntelligenceView onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Load Sample Data/)).toBeInTheDocument());
    expect(screen.getByText(/No verified live market data is available/)).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('loading sample data seeds real IndexedDB records and populates Today\'s Mission with a visible SAMPLE DATA badge', async () => {
    render(<MarketingIntelligenceView onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Load Sample Data/)).toBeInTheDocument());

    fireEvent.click(screen.getByText(/Load Sample Data/));

    await waitFor(() => expect(screen.getByText('OFFLINE ANALYSIS')).toBeInTheDocument());
    expect(screen.getAllByText(/⚠ SAMPLE DATA/).length).toBeGreaterThan(0);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('tab navigation switches the active panel and marks the selected tab with aria-pressed', async () => {
    render(<MarketingIntelligenceView onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Load Sample Data/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Load Sample Data/));
    await waitFor(() => expect(screen.getByText('OFFLINE ANALYSIS')).toBeInTheDocument());

    const missionTab = screen.getByRole('button', { name: "Today's Mission" });
    expect(missionTab).toHaveAttribute('aria-pressed', 'true');

    const keywordTab = screen.getByRole('button', { name: 'Keyword Intelligence' });
    fireEvent.click(keywordTab);

    expect(keywordTab).toHaveAttribute('aria-pressed', 'true');
    expect(missionTab).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(screen.getByText('Portfolio coverage by cluster')).toBeInTheDocument());
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('the close button calls onClose', async () => {
    const onClose = vi.fn();
    render(<MarketingIntelligenceView onClose={onClose} />);
    await waitFor(() => expect(screen.getByText(/Load Sample Data/)).toBeInTheDocument());
    fireEvent.click(screen.getByText('← กลับ'));
    expect(onClose).toHaveBeenCalled();
  });

  it('viewing the Commercial Score Details tab shows the real evidence-provenance breakdown, not a placeholder', async () => {
    render(<MarketingIntelligenceView onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Load Sample Data/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Load Sample Data/));
    await waitFor(() => expect(screen.getByText('OFFLINE ANALYSIS')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Commercial Score Details' }));
    await waitFor(() => expect(screen.getByText(/Scoring profile:/)).toBeInTheDocument());
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
