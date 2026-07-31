import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadMarketSnapshots } from '../../marketing/storage/marketSnapshotStore';
import { loadMarketObservations } from '../../marketing/storage/marketObservationStore';
import { loadMarketKeywords } from '../../marketing/storage/marketKeywordStore';
import { loadMarketOpportunities } from '../../marketing/storage/marketOpportunityStore';
import { loadDailyMissions } from '../../marketing/storage/dailyMissionStore';
import { loadSeasonalEvents, ensureGlobalSeasonalEventsSeeded } from '../../marketing/storage/seasonalEventStore';
import { loadScoringProfiles, ensureDefaultScoringProfile } from '../../marketing/storage/scoringProfileStore';
import { getMostRecentSnapshotForOfflineUse, type OfflineSnapshotResult } from '../../marketing/snapshot/snapshotService';
import { seedSampleMarketData } from '../../marketing/sampleData/seedSampleMarketData';
import type { MarketSnapshot } from '../../marketing/domain/marketSnapshot';
import type { MarketObservation } from '../../marketing/domain/marketObservation';
import type { MarketKeyword } from '../../marketing/domain/marketKeyword';
import type { MarketOpportunity } from '../../marketing/domain/marketOpportunity';
import type { DailyMission } from '../../marketing/domain/dailyMission';
import type { SeasonalEvent } from '../../marketing/domain/seasonalEvent';
import type { ScoringProfile } from '../../marketing/domain/scoringProfile';
import {
  buildMarketingHandoffApplication,
  buildMarketingHandoffApplicationFromGap,
  buildMarketingDesignHandoffInput,
  buildCreativeBriefDraftInput,
  type MarketingHandoffApplication,
  type MarketingHandoffField,
} from '../../design-director/handoff/buildMarketingHandoffApplication';
import { createMarketingDesignHandoff, transitionMarketingDesignHandoffWorkflow } from '../../design-director/domain/marketingDesignHandoff';
import { putMarketingDesignHandoff } from '../../design-director/storage/marketingDesignHandoffStore';
import { createCreativeBrief } from '../../design-director/domain/creativeBrief';
import { putCreativeBrief } from '../../design-director/storage/creativeBriefStore';

import { TodaysMissionTab } from './TodaysMissionTab';
import { AIMarketAdvisorTab } from './AIMarketAdvisorTab';
import { OpportunityExplorerTab } from './OpportunityExplorerTab';
import { CommercialScoreDetailsTab } from './CommercialScoreDetailsTab';
import { KeywordIntelligenceTab } from './KeywordIntelligenceTab';
import { SeasonalPlannerTab } from './SeasonalPlannerTab';
import { MarketGapFinderTab } from './MarketGapFinderTab';
import { MarketplaceComparisonTab } from './MarketplaceComparisonTab';
import { DailyMissionsTab } from './DailyMissionsTab';
import { MarketingHandoffReviewScreen } from './MarketingHandoffReviewScreen';
import './marketingCenter.css';

// Build 028 Phase 4 — Marketing Intelligence Center (📈 นักการตลาด). This is
// the ONE React component tree that reads every store Phase 2-3 built
// (marketSnapshots, marketObservations, marketKeywords, marketOpportunities,
// dailyMissions, seasonalEvents, scoringProfiles) and renders it through
// the real backend modules (opportunityScoring, dailyMissionGenerator,
// marketGapFinder, marketplaceComparison, keywordClustering) — no panel in
// this tree computes a score, a gap, or a mission recommendation itself;
// every number displayed traces back to one of those modules.

interface Props {
  onClose: () => void;
  /** Build 028C — fires once a Marketing record has been reviewed and sent
   * to the Creative Director, with the real, just-created Creative Brief's
   * id so `App.tsx` can switch straight to the AI Creative Director view
   * with that brief pre-selected (mirroring `onSendToGenerator`'s
   * callback-ownership convention from Build 028B Hardening). */
  onSentToCreativeDirector?: (briefId: string) => void;
  /** Build 028C, requirement #13 — Creative Director -> Source Opportunity
   * cross-navigation: preselects an opportunity and jumps straight to its
   * score breakdown, mirroring `onViewScore`'s own existing behavior. */
  initialSelectedOpportunityId?: string | null;
}

type MarketingHandoffTarget = { opportunity: MarketOpportunity; mission: DailyMission | null } | { gapKeyword: MarketKeyword };

export type MarketingTab =
  | 'mission'
  | 'advisor'
  | 'opportunities'
  | 'scoreDetails'
  | 'keywords'
  | 'seasonal'
  | 'gaps'
  | 'marketplaces'
  | 'missionHistory';

const TABS: Array<[MarketingTab, string]> = [
  ['mission', "Today's Mission"],
  ['advisor', 'AI Market Advisor'],
  ['opportunities', 'Opportunity Explorer'],
  ['scoreDetails', 'Commercial Score Details'],
  ['keywords', 'Keyword Intelligence'],
  ['seasonal', 'Seasonal Planner'],
  ['gaps', 'Market Gap Finder'],
  ['marketplaces', 'Marketplace Comparison'],
  ['missionHistory', 'Daily Missions'],
];

export interface MarketingData {
  snapshots: MarketSnapshot[];
  observations: MarketObservation[];
  keywords: MarketKeyword[];
  opportunities: MarketOpportunity[];
  missions: DailyMission[];
  seasonalEvents: SeasonalEvent[];
  scoringProfiles: ScoringProfile[];
  offline: OfflineSnapshotResult;
}

export function MarketingIntelligenceView({ onClose, onSentToCreativeDirector, initialSelectedOpportunityId }: Props) {
  const [tab, setTab] = useState<MarketingTab>('mission');
  const [data, setData] = useState<MarketingData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [handoffTarget, setHandoffTarget] = useState<MarketingHandoffTarget | null>(null);

  useEffect(() => {
    if (initialSelectedOpportunityId) {
      setSelectedOpportunityId(initialSelectedOpportunityId);
      setTab('scoreDetails');
    }
  }, [initialSelectedOpportunityId]);

  const reload = useCallback(async () => {
    try {
      await ensureGlobalSeasonalEventsSeeded();
      await ensureDefaultScoringProfile();
      const [snapshots, observations, keywords, opportunities, missions, seasonalEvents, scoringProfiles, offline] = await Promise.all([
        loadMarketSnapshots(),
        loadMarketObservations(),
        loadMarketKeywords(),
        loadMarketOpportunities(),
        loadDailyMissions(),
        loadSeasonalEvents(),
        loadScoringProfiles(),
        getMostRecentSnapshotForOfflineUse(),
      ]);
      setData({ snapshots, observations, keywords, opportunities, missions, seasonalEvents, scoringProfiles, offline });
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleLoadSampleData = useCallback(async () => {
    setSeeding(true);
    try {
      await seedSampleMarketData();
      await reload();
    } finally {
      setSeeding(false);
    }
  }, [reload]);

  const handoffApplication: MarketingHandoffApplication | null = useMemo(() => {
    if (!handoffTarget) return null;
    return 'gapKeyword' in handoffTarget
      ? buildMarketingHandoffApplicationFromGap(handoffTarget.gapKeyword)
      : buildMarketingHandoffApplication(handoffTarget.opportunity, data?.snapshots.find((s) => s.id === handoffTarget.opportunity.snapshotId) ?? null, handoffTarget.mission);
  }, [handoffTarget, data]);

  /** Requirement #3/#4 — confirming the review screen: persists the formal
   * `MarketingDesignHandoff` record (requirement #2's preserved provenance
   * + requirement #10/#11's workflow status/audit history) and
   * auto-creates the Creative Brief DRAFT (requirement #3), then hands the
   * new brief's id up to `App.tsx` so it can switch straight to the AI
   * Creative Director view with it pre-selected. */
  const handleConfirmSendToCreativeDirector = useCallback(
    async (fields: MarketingHandoffField[]) => {
      if (!handoffApplication) return;
      const handoffInput = buildMarketingDesignHandoffInput(fields, handoffApplication.handoffSeed);
      const handoff = createMarketingDesignHandoff(handoffInput);
      const brief = createCreativeBrief(buildCreativeBriefDraftInput(fields, handoffInput.marketOpportunityId ?? null, handoffInput.confidence ?? 'unknown'));
      const linkedHandoff = transitionMarketingDesignHandoffWorkflow({ ...handoff, creativeBriefId: brief.id }, 'BRIEF_DRAFT');
      await putCreativeBrief(brief);
      await putMarketingDesignHandoff(linkedHandoff);
      setHandoffTarget(null);
      await reload();
      onSentToCreativeDirector?.(brief.id);
    },
    [handoffApplication, reload, onSentToCreativeDirector],
  );

  return (
    <div className="marketing-center">
      <div className="marketing-center-header">
        <h1>📈 Marketing Intelligence Center (นักการตลาด)</h1>
        <button type="button" className="btn" onClick={onClose}>
          ← กลับ
        </button>
      </div>

      <nav className="marketing-tab-nav" aria-label="แท็บ Marketing Intelligence Center">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" className={`btn${tab === key ? ' btn--primary' : ''}`} aria-pressed={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {loadError && (
        <div className="marketing-error" role="alert">
          Could not load Marketing Intelligence data: {loadError}
        </div>
      )}

      {!data && !loadError && <div className="marketing-loading">Loading marketing intelligence data…</div>}

      {data && data.snapshots.length === 0 && (
        <div className="marketing-empty-state">
          <p>
            No verified live market data is available, and no research has been captured yet. Load a labeled sample dataset to see the Marketing
            Intelligence Center fully populated, or start capturing real research in future phases.
          </p>
          <button type="button" className="btn btn--primary" onClick={() => void handleLoadSampleData()} disabled={seeding}>
            {seeding ? 'Loading sample data…' : '⚠ Load Sample Data'}
          </button>
        </div>
      )}

      {data && data.snapshots.length > 0 && (
        <>
          {tab === 'mission' && (
            <TodaysMissionTab
              data={data}
              reload={reload}
              onViewScore={(id) => { setSelectedOpportunityId(id); setTab('scoreDetails'); }}
              onSendToCreativeDirector={(opportunity, mission) => setHandoffTarget({ opportunity, mission })}
            />
          )}
          {tab === 'advisor' && <AIMarketAdvisorTab data={data} onViewScore={(id) => { setSelectedOpportunityId(id); setTab('scoreDetails'); }} />}
          {tab === 'opportunities' && (
            <OpportunityExplorerTab
              data={data}
              onViewScore={(id) => { setSelectedOpportunityId(id); setTab('scoreDetails'); }}
              onSendToCreativeDirector={(opportunity) => setHandoffTarget({ opportunity, mission: null })}
            />
          )}
          {tab === 'scoreDetails' && (
            <CommercialScoreDetailsTab data={data} selectedOpportunityId={selectedOpportunityId} onSelectOpportunity={setSelectedOpportunityId} />
          )}
          {tab === 'keywords' && <KeywordIntelligenceTab data={data} reload={reload} />}
          {tab === 'seasonal' && <SeasonalPlannerTab data={data} reload={reload} />}
          {tab === 'gaps' && (
            <MarketGapFinderTab
              data={data}
              onSendToCreativeDirector={(keyword) => setHandoffTarget({ gapKeyword: keyword })}
            />
          )}
          {tab === 'marketplaces' && <MarketplaceComparisonTab data={data} />}
          {tab === 'missionHistory' && (
            <DailyMissionsTab
              data={data}
              reload={reload}
              onSendToCreativeDirector={(opportunity, mission) => setHandoffTarget({ opportunity, mission })}
            />
          )}
        </>
      )}

      {handoffApplication && (
        <MarketingHandoffReviewScreen
          application={handoffApplication}
          onConfirm={(fields) => void handleConfirmSendToCreativeDirector(fields)}
          onCancel={() => setHandoffTarget(null)}
        />
      )}
    </div>
  );
}
