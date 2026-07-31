import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MarketingIntelligenceView } from './MarketingIntelligenceView';
import { clearMarketSnapshots } from '../../marketing/storage/marketSnapshotStore';
import { clearMarketObservations } from '../../marketing/storage/marketObservationStore';
import { clearMarketKeywords } from '../../marketing/storage/marketKeywordStore';
import { clearMarketOpportunities } from '../../marketing/storage/marketOpportunityStore';
import { clearDailyMissions } from '../../marketing/storage/dailyMissionStore';
import { clearSeasonalEvents } from '../../marketing/storage/seasonalEventStore';
import { clearResearchSources } from '../../marketing/storage/researchSourceStore';
import { clearScoringProfiles } from '../../marketing/storage/scoringProfileStore';
import { clearMarketingDesignHandoffs } from '../../design-director/storage/marketingDesignHandoffStore';
import { clearCreativeBriefs, loadCreativeBriefs } from '../../design-director/storage/creativeBriefStore';

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
    clearMarketingDesignHandoffs(),
    clearCreativeBriefs(),
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

  // Build 028C — the Marketing -> Creative Director handoff: "Send to
  // Creative Director" opens the review screen, confirming it persists a
  // real MarketingDesignHandoff + Creative Brief and notifies the parent.
  it('sending Today\'s Mission to the Creative Director opens the review screen and confirming it creates a linked Creative Brief', async () => {
    const onSentToCreativeDirector = vi.fn();
    render(<MarketingIntelligenceView onClose={() => {}} onSentToCreativeDirector={onSentToCreativeDirector} />);
    await waitFor(() => expect(screen.getByText(/Load Sample Data/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Load Sample Data/));
    await waitFor(() => expect(screen.getByText('OFFLINE ANALYSIS')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /ส่งให้นักออกแบบ/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Review before sending to Creative Director' });
    expect(within(dialog).getByText('Review — Send to Creative Director')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Send to Creative Director' }));

    await waitFor(() => expect(onSentToCreativeDirector).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog', { name: 'Review before sending to Creative Director' })).not.toBeInTheDocument();

    const briefId = onSentToCreativeDirector.mock.calls[0][0] as string;
    const briefs = await loadCreativeBriefs();
    expect(briefs.some((b) => b.id === briefId)).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
