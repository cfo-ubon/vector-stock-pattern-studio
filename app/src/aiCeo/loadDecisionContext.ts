import type { MarketOpportunity } from '../marketing/domain/marketOpportunity';
import type { DailyMission } from '../marketing/domain/dailyMission';
import type { SeasonalEvent } from '../marketing/domain/seasonalEvent';
import type { PortfolioAsset } from '../catalog/domain/types';
import type { AutonomousDesignRun } from '../autopilot/domain/autonomousDesignRun';
import type { DashboardSnapshot } from '../catalog/dashboard/dashboardSnapshot';
import type { OfflineSnapshotResult } from '../marketing/snapshot/snapshotService';
import type { AiMemory } from './domain/types';
import { loadMarketOpportunities } from '../marketing/storage/marketOpportunityStore';
import { loadDailyMissions } from '../marketing/storage/dailyMissionStore';
import { loadSeasonalEvents } from '../marketing/storage/seasonalEventStore';
import { loadPortfolioAssets } from '../catalog/storage/portfolioStore';
import { loadAutonomousDesignRuns } from '../autopilot/storage/autonomousDesignRunStore';
import { loadDashboardSnapshot } from '../catalog/dashboard/portfolioDashboardService';
import { getMostRecentSnapshotForOfflineUse } from '../marketing/snapshot/snapshotService';
import { loadConfirmedAiMemories } from './storage/aiMemoryStore';

// Build 030 Part 2 — the one shared "load everything the Decision Engine
// needs" loader, reused by the Morning Brief, Business Coach, and the
// Conversation Panel so each doesn't re-implement the same 8-source
// Promise.all (mirrors `MissionControlView.tsx`'s own `reload()` — every
// screen loads real, current data rather than caching stale results).

export interface AiCeoLoadedContext {
  opportunities: MarketOpportunity[];
  missions: DailyMission[];
  seasonalEvents: SeasonalEvent[];
  portfolioAssets: PortfolioAsset[];
  autonomousRuns: AutonomousDesignRun[];
  dashboard: DashboardSnapshot;
  offline: OfflineSnapshotResult;
  confirmedMemories: AiMemory[];
}

export async function loadAiCeoDecisionContext(now: number = Date.now()): Promise<AiCeoLoadedContext> {
  const [opportunities, missions, seasonalEvents, portfolioAssets, autonomousRuns, dashboard, offline, confirmedMemories] = await Promise.all([
    loadMarketOpportunities(),
    loadDailyMissions(),
    loadSeasonalEvents(),
    loadPortfolioAssets(),
    loadAutonomousDesignRuns(),
    loadDashboardSnapshot(),
    getMostRecentSnapshotForOfflineUse(now),
    loadConfirmedAiMemories(),
  ]);
  return { opportunities, missions, seasonalEvents, portfolioAssets, autonomousRuns, dashboard, offline, confirmedMemories };
}
