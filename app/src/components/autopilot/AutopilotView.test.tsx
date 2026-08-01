import { describe, it, expect, beforeEach, vi } from 'vitest';
import { File as NodeFile } from 'node:buffer';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AutopilotView } from './AutopilotView';
import { clearPortfolioStores, loadPortfolioAssets } from '../../catalog/storage/portfolioStore';
import { clearAutonomousDesignRuns } from '../../autopilot/storage/autonomousDesignRunStore';
import { clearMarketOpportunities } from '../../marketing/storage/marketOpportunityStore';
import { clearDailyMissions } from '../../marketing/storage/dailyMissionStore';
import { clearSeasonalEvents } from '../../marketing/storage/seasonalEventStore';
import { clearMarketSnapshots } from '../../marketing/storage/marketSnapshotStore';

// Same jsdom-File / fake-indexeddb workaround `generationOrchestrator.test.ts`
// and `batchProductionService.test.ts` use — this component drives real
// generation, which constructs real `File` objects internally.
beforeEach(() => {
  vi.stubGlobal('File', NodeFile);
});

async function clearAllStores() {
  await Promise.all([clearPortfolioStores(), clearAutonomousDesignRuns(), clearMarketOpportunities(), clearDailyMissions(), clearSeasonalEvents(), clearMarketSnapshots()]);
}

beforeEach(async () => {
  await clearAllStores();
});

describe('AutopilotView', () => {
  it('completes the full "ออกแบบให้ฉันวันนี้" flow end-to-end with no manual field selection, and imports results into Portfolio', async () => {
    render(<AutopilotView onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText('Autopilot Mode')).toBeInTheDocument());

    // Module 12 offline honesty — no market data seeded, so Full Autopilot
    // honestly falls back to an evergreen default rather than fabricating.
    fireEvent.click(screen.getByText('สร้าง 5 ลาย'));
    fireEvent.click(screen.getByText(/สร้างแผนการออกแบบ/));

    await waitFor(() => expect(screen.getByText('เหตุผลของแต่ละการตัดสินใจ')).toBeInTheDocument());
    expect(screen.getAllByText(/ระบบเลือกค่านี้เพราะ/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('สร้างทันที'));

    await waitFor(() => expect(screen.getByText('ผลลัพธ์การสร้างลวดลาย')).toBeInTheDocument(), { timeout: 60000 });

    const assets = await loadPortfolioAssets();
    expect(assets.length).toBe(5);

    fireEvent.click(screen.getByText('นำ READY เข้า Portfolio'));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
  }, 60000);

  it('shows the Guided Autopilot constraint panel instead of the full advanced generator UI, and applying it rebuilds the plan', async () => {
    render(<AutopilotView onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Autopilot Mode')).toBeInTheDocument());

    fireEvent.click(screen.getByText('สร้าง 5 ลาย'));
    fireEvent.click(screen.getByText(/สร้างแผนการออกแบบ/));
    await waitFor(() => expect(screen.getByText('เหตุผลของแต่ละการตัดสินใจ')).toBeInTheDocument());

    fireEvent.click(screen.getByText('ปรับข้อจำกัด'));
    await waitFor(() => expect(screen.getByText('ใช้ข้อจำกัดนี้ใหม่')).toBeInTheDocument());
    expect(screen.queryByText('Style DNA')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('ใช้ข้อจำกัดนี้ใหม่'));
    await waitFor(() => expect(screen.getByText('เหตุผลของแต่ละการตัดสินใจ')).toBeInTheDocument());
  });

  it('cancelling the plan returns to the goal screen without generating anything', async () => {
    render(<AutopilotView onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Autopilot Mode')).toBeInTheDocument());

    fireEvent.click(screen.getByText('สร้าง 5 ลาย'));
    fireEvent.click(screen.getByText(/สร้างแผนการออกแบบ/));
    await waitFor(() => expect(screen.getByText('เหตุผลของแต่ละการตัดสินใจ')).toBeInTheDocument());

    fireEvent.click(screen.getByText('ยกเลิก'));
    await waitFor(() => expect(screen.getByText('Autopilot Mode')).toBeInTheDocument());
    expect(await loadPortfolioAssets()).toHaveLength(0);
  });

  it('Build 030 — an initialAction (from Mission Control) skips the goal screen and lands straight on the reviewed plan', async () => {
    render(<AutopilotView onClose={() => {}} initialAction={{ mode: 'FULL_AUTOPILOT', requestedCount: 5 }} />);
    await waitFor(() => expect(screen.getByText('เหตุผลของแต่ละการตัดสินใจ')).toBeInTheDocument());
    expect(screen.queryByText('Autopilot Mode')).not.toBeInTheDocument();
  });
});
