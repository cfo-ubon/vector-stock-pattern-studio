import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { loadMarketOpportunities } from '../../marketing/storage/marketOpportunityStore';
import { loadDailyMissions } from '../../marketing/storage/dailyMissionStore';
import { loadSeasonalEvents } from '../../marketing/storage/seasonalEventStore';
import { loadPortfolioAssets } from '../../catalog/storage/portfolioStore';
import { loadQualitySnapshots } from '../../catalog/quality/qualitySnapshotStore';
import { loadAutonomousDesignRuns } from '../../autopilot/storage/autonomousDesignRunStore';
import { getMostRecentSnapshotForOfflineUse, type OfflineSnapshotResult } from '../../marketing/snapshot/snapshotService';
import { buildHeroOpportunity, type HeroOpportunity } from '../../missionControl/heroOpportunity';
import { loadBusinessStatus, type BusinessStatus } from '../../missionControl/businessStatus';
import { MISSION_GOAL_MODE_VALUES, MISSION_GOAL_MODE_LABEL_EN, MISSION_GOAL_MODE_LABEL_TH, resolveMissionGoalMode, type MissionGoalMode } from '../../missionControl/goalModes';
import { parseCommandBarInput } from '../../missionControl/commandBarParser';
import type { AutopilotMode } from '../../autopilot/domain/autopilotMode';
import type { AutopilotProductionGoal } from '../../autopilot/collectionRolePlanner';
import './missionControl.css';

// Build 030 ("AI CEO & Mission Control") — the new home screen. Every
// number shown here comes from `missionControl/heroOpportunity.ts` and
// `missionControl/businessStatus.ts`, both pure reshapes of Build 028/029
// data — no new scoring, no new generation logic lives in this file.
// "Start Today's Mission" and every Goal Mode button hand off to the
// existing Autopilot (`AutopilotView`'s `initialAction` prop, Build 030) —
// Mission Control decides WHAT to run, Autopilot still runs it.

export interface MissionControlAutopilotAction {
  mode: AutopilotMode;
  requestedCount: number;
  marketplace?: string | null;
  productionGoal?: AutopilotProductionGoal;
  userInstruction?: string;
}

interface Props {
  onStartAutopilot: (action: MissionControlAutopilotAction | null) => void;
  onOpenPortfolio: () => void;
  onOpenMarketing: () => void;
  onOpenDesignDirector: () => void;
}

const DEFAULT_REQUESTED_COUNT = 10;

function formatStars(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

function formatGapLabel(gap: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  if (gap === 'HIGH') return 'High';
  if (gap === 'MEDIUM') return 'Medium';
  return 'Low';
}

export function MissionControlView({ onStartAutopilot, onOpenPortfolio, onOpenMarketing, onOpenDesignDirector }: Props) {
  const [hero, setHero] = useState<HeroOpportunity | null>(null);
  const [status, setStatus] = useState<BusinessStatus | null>(null);
  const [offline, setOffline] = useState<OfflineSnapshotResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [commandText, setCommandText] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [opportunities, missions, seasonalEvents, portfolioAssets, qualitySnapshots, autonomousRuns, offlineResult, businessStatus] = await Promise.all([
        loadMarketOpportunities(),
        loadDailyMissions(),
        loadSeasonalEvents(),
        loadPortfolioAssets(),
        loadQualitySnapshots(),
        loadAutonomousDesignRuns(),
        getMostRecentSnapshotForOfflineUse(),
        loadBusinessStatus(),
      ]);
      setHero(
        buildHeroOpportunity({
          opportunities,
          missions,
          seasonalEvents,
          portfolioAssets,
          qualitySnapshots,
          autonomousRuns,
          offline: offlineResult,
          requestedCount: DEFAULT_REQUESTED_COUNT,
          now: Date.now(),
        }),
      );
      setStatus(businessStatus);
      setOffline(offlineResult);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleStartMission = useCallback(() => {
    onStartAutopilot({
      mode: 'TODAYS_MISSION',
      requestedCount: hero?.requestedCount ?? DEFAULT_REQUESTED_COUNT,
      marketplace: hero?.marketplace ?? null,
      productionGoal: 'auto',
    });
  }, [onStartAutopilot, hero]);

  const handleGoalMode = useCallback(
    (goalMode: MissionGoalMode) => {
      const resolved = resolveMissionGoalMode(goalMode);
      onStartAutopilot({
        mode: resolved.mode,
        requestedCount: DEFAULT_REQUESTED_COUNT,
        marketplace: resolved.marketplace,
        productionGoal: resolved.productionGoal,
      });
    },
    [onStartAutopilot],
  );

  const handleCommandSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = commandText.trim();
      if (!trimmed) return;
      const action = parseCommandBarInput(trimmed);
      if (action.kind === 'navigate') {
        if (action.target === 'portfolio') onOpenPortfolio();
        else if (action.target === 'marketing') onOpenMarketing();
        else if (action.target === 'designDirector') onOpenDesignDirector();
        else onStartAutopilot(null);
      } else if (action.kind === 'goalMode') {
        handleGoalMode(action.goalMode);
      } else {
        onStartAutopilot({
          mode: 'CUSTOM_GOAL',
          requestedCount: action.parsed.count ?? DEFAULT_REQUESTED_COUNT,
          userInstruction: trimmed,
        });
      }
      setCommandText('');
    },
    [commandText, onOpenPortfolio, onOpenMarketing, onOpenDesignDirector, onStartAutopilot, handleGoalMode],
  );

  const isOffline = offline !== null && offline.classification === 'SAVED_SNAPSHOT';

  return (
    <div className="mission-control">
      {loadError && (
        <div className="mission-control-error" role="alert">
          Could not load today's data: {loadError}
        </div>
      )}

      <section className="mc-hero-card">
        <div className="mc-hero-header">
          <span className="mc-hero-greeting">✨ Good Morning</span>
          <p className="mc-hero-sub">AI has completed today's market analysis.</p>
        </div>
        {hero ? (
          <div className="mc-hero-body">
            <div className="mc-hero-main">
              <div className="mc-hero-theme-row">
                <span className="mc-hero-label">Today's best opportunity</span>
                <h2 className="mc-hero-theme">{hero.theme}</h2>
                <span className="mc-hero-marketplace">{hero.marketplace}</span>
              </div>
              <div className="mc-hero-stars" aria-label={`${hero.stars} out of 5 stars`}>
                {formatStars(hero.stars)}
              </div>
            </div>
            <div className="mc-hero-metrics">
              <div className="mc-hero-metric">
                <span className="mc-hero-metric-label">Estimated Commercial Score</span>
                <span className="mc-hero-metric-value">{hero.estimatedCommercialScore ?? '—'}</span>
              </div>
              <div className="mc-hero-metric">
                <span className="mc-hero-metric-label">Estimated Beauty Score</span>
                <span className="mc-hero-metric-value">{hero.estimatedBeautyScore ?? 'No data yet'}</span>
              </div>
              <div className="mc-hero-metric">
                <span className="mc-hero-metric-label">Portfolio Gap</span>
                <span className="mc-hero-metric-value">{formatGapLabel(hero.portfolioGap)}</span>
              </div>
              <div className="mc-hero-metric">
                <span className="mc-hero-metric-label">Estimated Production Time</span>
                <span className="mc-hero-metric-value">{hero.estimatedProductionMinutes !== null ? `${hero.estimatedProductionMinutes} minutes` : 'Not yet estimated'}</span>
              </div>
            </div>
            <div className="mc-hero-actions">
              <button type="button" className="btn btn--primary mc-hero-cta" onClick={handleStartMission}>
                ✨ Start Today's Mission
              </button>
              <button type="button" className="btn btn--link" onClick={() => setShowExplanation((v) => !v)}>
                View Explanation
              </button>
            </div>
            {showExplanation && (
              <div className="mc-explanation">
                <ul>
                  {hero.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="mc-hero-loading">Loading today's analysis…</p>
        )}
        {isOffline && <p className="mc-hero-offline-note">Offline — using the most recent saved market data ({offline?.freshnessLabel}).</p>}
      </section>

      <section className="mc-ceo-panel">
        <p>Good morning.</p>
        <p>I analyzed your portfolio.</p>
        {hero && (
          <>
            <p>
              Today's best opportunity is <strong>{hero.theme}</strong>.
            </p>
            <p className="mc-ceo-reason-label">Reason</p>
            <ul>
              {hero.reasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </>
        )}
        <p>Would you like me to create a collection?</p>
        <div className="mc-ceo-actions">
          <button type="button" className="btn btn--primary" onClick={handleStartMission}>
            Start
          </button>
          <button type="button" className="btn" onClick={() => onStartAutopilot(null)}>
            Adjust Goal
          </button>
          <button type="button" className="btn" onClick={() => document.getElementById('mc-command-input')?.focus()}>
            Ask AI
          </button>
        </div>
      </section>

      <section className="mc-business-status">
        <h3>Today's Business Status</h3>
        {status ? (
          <div className="mc-status-grid">
            <div className="mc-status-item">
              <span className="mc-status-label">Portfolio Health</span>
              <span className="mc-status-value">{status.portfolioHealthScore}</span>
            </div>
            <div className="mc-status-item">
              <span className="mc-status-label">Submission Queue — READY</span>
              <span className="mc-status-value">{status.submissionQueue.ready}</span>
            </div>
            <div className="mc-status-item">
              <span className="mc-status-label">Pending Review</span>
              <span className="mc-status-value">{status.submissionQueue.pendingReview}</span>
            </div>
            <div className="mc-status-item">
              <span className="mc-status-label">Pending Upload</span>
              <span className="mc-status-value">{status.submissionQueue.pendingUpload}</span>
            </div>
            <div className="mc-status-item">
              <span className="mc-status-label">Monthly Progress</span>
              <span className="mc-status-value">{status.monthlyProgress.patternsThisMonth} patterns this month</span>
            </div>
            <div className="mc-status-item">
              <span className="mc-status-label">Commercial Readiness</span>
              <span className="mc-status-value">{status.commercialReadiness}%</span>
            </div>
          </div>
        ) : (
          <p className="mc-status-loading">Loading business status…</p>
        )}
      </section>

      <section className="mc-goal-modes">
        <h3>What would you like to do?</h3>
        <div className="mc-goal-grid">
          {MISSION_GOAL_MODE_VALUES.map((goalMode) => (
            <button key={goalMode} type="button" className="btn mc-goal-btn" onClick={() => handleGoalMode(goalMode)}>
              <span className="mc-goal-en">{MISSION_GOAL_MODE_LABEL_EN[goalMode]}</span>
              <span className="mc-goal-th">{MISSION_GOAL_MODE_LABEL_TH[goalMode]}</span>
            </button>
          ))}
        </div>
      </section>

      <form className="mc-command-bar" onSubmit={handleCommandSubmit}>
        <input
          id="mc-command-input"
          type="text"
          className="mc-command-input"
          placeholder="Ask AI... e.g. Create 20 Botanical patterns, Analyze my portfolio, Help me earn faster"
          value={commandText}
          onChange={(e) => setCommandText(e.target.value)}
        />
        <button type="submit" className="btn btn--primary">
          Ask AI
        </button>
      </form>
    </div>
  );
}
