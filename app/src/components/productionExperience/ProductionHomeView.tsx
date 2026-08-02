import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StartFactory,
  resumeInterruptedFactoryRun,
  loadOrchestrationRuns,
  putOrchestrationRun,
  approveFactoryRun,
  executeFactoryRun,
  cancelFactoryRun,
  completeFactoryRun,
  attachOrchestrationRunBatch,
} from '../../factoryOrchestrator';
import type { OrchestrationRun } from '../../factoryOrchestrator';
import { loadFactoryTasks, putFactoryTask } from '../../factory/storage/factoryQueueStore';
import { loadFactoryTimeline } from '../../factory/storage/factoryTimelineStore';
import { createFactoryTask } from '../../factory/domain/factoryTask';
import { drainFactoryQueue } from '../../factory/scheduler';
import type { FactoryTask, FactoryTimelineEntry } from '../../factory/domain/types';
import { computeFactoryHealth, type FactoryHealth } from '../../factory/factoryMetrics';
import { computeFactoryIntelligenceMetrics } from '../../factoryIntelligence/metricsEngine';
import { loadPortfolioAssets, putPortfolioAsset } from '../../catalog/storage/portfolioStore';
import { loadQualitySnapshots, putQualitySnapshot, createQualitySnapshot } from '../../catalog/quality/qualitySnapshotStore';
import type { PortfolioAsset } from '../../catalog/domain/types';
import type { QualitySnapshot } from '../../catalog/quality/qualitySnapshotStore';
import { latestQualitySnapshotsByAsset } from '../../productionExperience/reviewWorkspace';
import { loadAutonomousDesignRuns } from '../../autopilot/storage/autonomousDesignRunStore';
import type { AutonomousDesignRun } from '../../autopilot/domain/autonomousDesignRun';
import {
  generateProductionDailyBrief,
  checkContinueYesterday,
  recordOwnerDecision,
  reviewProductionCompletion,
  loadOwnerDecisionRecords,
  putOwnerDecisionRecord,
  getProductionSession,
  putProductionSession,
  attachProductionSessionBatch,
} from '../../productionAutopilot';
import type { ProductionDailyBrief, ContinueYesterdayCheck, ProductionSession, ProductionCompletionReview } from '../../productionAutopilot/domain/types';
import { loadCommercialPipelineContext } from '../../commercial/loadCommercialPipelineContext';
import { buildExportReadinessDashboard } from '../../commercial/exportReadinessDashboard';
import { deriveProductionProgress } from '../../productionExperience/progressStages';
import { buildOwnerActionCenter } from '../../productionExperience/ownerActionCenter';
import { buildReviewWorkspaceItems, countReviewWaiting } from '../../productionExperience/reviewWorkspace';
import type { OwnerActionType } from '../../productionExperience/ownerActionCenter';
import { ProgressStepper } from './ProgressStepper';
import { OwnerActionCenterList } from './OwnerActionCenterList';
import { ReviewWorkspacePanel } from './ReviewWorkspacePanel';
import { FactoryDashboardPanel } from './FactoryDashboardPanel';
import { SessionSummaryPanel } from './SessionSummaryPanel';
import { CommercialPipelineTab } from '../commercial/CommercialPipelineTab';
import './productionExperience.css';

// Mission 6 — Production Experience Layer. `StartFactory()` is the only
// production entry point this screen ever calls (Part 1) — every other
// action here (Approve, Complete, Review, Export) calls an already-real
// Factory Orchestrator / Production Autopilot / Commercial Pipeline
// function, never a second implementation. See
// `productionExperience/*.ts` for the pure display-reshaping logic and
// `factoryOrchestrator/index.ts` / `productionAutopilot/index.ts` for
// every real engine this view composes.

type Screen = 'home' | 'progress' | 'review' | 'export' | 'dashboard' | 'summary';

interface Props {
  onClose: () => void;
}

export function ProductionHomeView({ onClose }: Props) {
  const [screen, setScreen] = useState<Screen>('home');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<FactoryTask[]>([]);
  const [timeline, setTimeline] = useState<FactoryTimelineEntry[]>([]);
  const [portfolioAssets, setPortfolioAssets] = useState<PortfolioAsset[]>([]);
  const [qualitySnapshots, setQualitySnapshots] = useState<QualitySnapshot[]>([]);
  const [autonomousRuns, setAutonomousRuns] = useState<AutonomousDesignRun[]>([]);

  const [run, setRun] = useState<OrchestrationRun | null>(null);
  const [session, setSession] = useState<ProductionSession | null>(null);
  const [factoryHealth, setFactoryHealth] = useState<FactoryHealth | null>(null);
  const [factoryEfficiency, setFactoryEfficiency] = useState<number | null>(null);
  const [exportReadyCount, setExportReadyCount] = useState(0);
  const [dailyBrief, setDailyBrief] = useState<ProductionDailyBrief | null>(null);
  const [continueYesterday, setContinueYesterday] = useState<ContinueYesterdayCheck | null>(null);
  const [completionReview, setCompletionReview] = useState<ProductionCompletionReview | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedTasks, loadedTimeline, assets, snapshots, autoRuns, ownerRecords, runs, pipelineCtx] = await Promise.all([
        loadFactoryTasks(),
        loadFactoryTimeline(),
        loadPortfolioAssets(),
        loadQualitySnapshots(),
        loadAutonomousDesignRuns(),
        loadOwnerDecisionRecords(),
        loadOrchestrationRuns(),
        loadCommercialPipelineContext(),
      ]);
      if (!mountedRef.current) return;
      const now = Date.now();
      const latestRun = runs[0] ?? null;
      const currentSession = latestRun?.sessionId ? ((await getProductionSession(latestRun.sessionId)) ?? null) : null;
      const dashboard = buildExportReadinessDashboard(pipelineCtx.readinessReports);
      if (!mountedRef.current) return;

      setTasks(loadedTasks);
      setTimeline(loadedTimeline);
      setPortfolioAssets(assets);
      setQualitySnapshots(snapshots);
      setAutonomousRuns(autoRuns);
      setRun(latestRun);
      setSession(currentSession);
      setFactoryHealth(computeFactoryHealth(loadedTasks, loadedTimeline, now));
      setFactoryEfficiency(computeFactoryIntelligenceMetrics(loadedTasks, loadedTimeline, now).factoryEfficiency);
      setExportReadyCount(dashboard.buckets.find((b) => b.id === 'ready')?.count ?? 0);
      setDailyBrief(generateProductionDailyBrief(loadedTasks, loadedTimeline, ownerRecords, assets, snapshots, autoRuns, now));
      setContinueYesterday(checkContinueYesterday(loadedTasks));
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleStartFactory() {
    setBusy(true);
    setError(null);
    try {
      const result = await StartFactory();
      if (!mountedRef.current) return;
      setRun(result.run);
      setSession(result.context.session);
      setScreen('progress');
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) setBusy(false);
      await reload();
    }
  }

  async function handleContinueYesterday() {
    setBusy(true);
    setError(null);
    try {
      const result = await resumeInterruptedFactoryRun();
      if (!mountedRef.current) return;
      if (result.recovered && result.run) {
        setRun(result.run);
        setSession(result.context?.session ?? null);
        setScreen('progress');
      } else {
        setError("No orchestrated run was found for yesterday's unfinished work — click START FACTORY to create one.");
      }
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  async function handleApproveSession() {
    if (!run || !session) return;
    setBusy(true);
    setError(null);
    const decisionStart = Date.now();
    try {
      const approved = approveFactoryRun(run, session, Date.now());
      if (!approved.ok) {
        setError(approved.error.message);
        return;
      }
      const executed = executeFactoryRun(approved.value.run, approved.value.session, Date.now());
      if (!executed.ok) {
        setError(executed.error.message);
        return;
      }
      let nextRun = executed.value.run;
      let nextSession = executed.value.session;

      // Mission 7 (Release Candidate hardening) — StartFactory() never
      // attaches a real batchId (see RELEASE_CANDIDATE_REPORT.md); if the
      // plan is actually continuing real, already-queued work, attach
      // that real batchId now so the Factory Controller Scheduler
      // (already-existing, already-tested — see factory/scheduler.ts)
      // has something to drain. Never invents a batch — only ever
      // attaches one that genuinely already exists in the queue.
      if (!nextRun.batchId && dailyBrief) {
        const targetTaskId = dailyBrief.topRecommendation.sourceTaskIds[0];
        const targetBatchId = targetTaskId ? (tasks.find((t) => t.id === targetTaskId)?.batchId ?? null) : null;
        if (targetBatchId) {
          nextRun = attachOrchestrationRunBatch(nextRun, targetBatchId, Date.now());
          nextSession = attachProductionSessionBatch(nextSession, targetBatchId, Date.now());
        }
      }

      const decision = recordOwnerDecision('APPROVE_SESSION', session.id, Date.now() - decisionStart, Date.now());
      await Promise.all([putOrchestrationRun(nextRun), putProductionSession(nextSession), putOwnerDecisionRecord(decision)]);
      if (nextRun.batchId) {
        await drainFactoryQueue(Date.now());
      }
      if (!mountedRef.current) return;
      setRun(nextRun);
      setSession(nextSession);
      setScreen('progress');
    } finally {
      if (mountedRef.current) setBusy(false);
      await reload();
    }
  }

  async function handleCancelBlockedRun() {
    if (!run) return;
    setBusy(true);
    setError(null);
    const decisionStart = Date.now();
    try {
      const result = cancelFactoryRun(run, session, run.blockedReason ?? 'Owner cancelled a blocked run.', Date.now());
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      const decision = recordOwnerDecision('APPROVE_OVERRIDE', session?.id ?? null, Date.now() - decisionStart, Date.now());
      await Promise.all([putOrchestrationRun(result.value.run), result.value.session ? putProductionSession(result.value.session) : Promise.resolve(), putOwnerDecisionRecord(decision)]);
      if (!mountedRef.current) return;
      setRun(result.value.run);
      setSession(result.value.session);
    } finally {
      if (mountedRef.current) setBusy(false);
      await reload();
    }
  }

  async function handleCompleteSession() {
    if (!run || !session || !run.batchId) return;
    setBusy(true);
    setError(null);
    try {
      const now = Date.now();
      const outcome = reviewProductionCompletion(run.batchId, tasks, timeline, portfolioAssets, qualitySnapshots, autonomousRuns, now);
      if (!outcome) {
        setError('This batch is not fully finished yet — nothing to complete.');
        return;
      }
      const result = completeFactoryRun(run, session, outcome, tasks, timeline, now);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      await Promise.all([putOrchestrationRun(result.value.run), putProductionSession(result.value.session)]);
      if (!mountedRef.current) return;
      setRun(result.value.run);
      setSession(result.value.session);
      setCompletionReview(outcome);
      setScreen('summary');
    } finally {
      if (mountedRef.current) setBusy(false);
      await reload();
    }
  }

  function handleOwnerAction(type: OwnerActionType) {
    if (type === 'APPROVE_SESSION') void handleApproveSession();
    else if (type === 'APPROVE_OVERRIDE') setScreen('progress');
    else if (type === 'REVIEW_IMAGES') setScreen('review');
    else if (type === 'EXPORT_PACKAGES') setScreen('export');
  }

  async function reclassifyReviewItems(assetIds: string[], decision: 'READY' | 'REJECT'): Promise<void> {
    const now = Date.now();
    const latestByAsset = latestQualitySnapshotsByAsset(qualitySnapshots);
    const targets = portfolioAssets.filter((a) => assetIds.includes(a.assetId));
    const workflowStatus = decision === 'READY' ? 'APPROVED' : 'REJECTED';
    await Promise.all(targets.map((a) => putPortfolioAsset({ ...a, workflowStatus, updatedAt: now })));
    await Promise.all(
      assetIds.map((assetId) => {
        const latest = latestByAsset.get(assetId);
        if (!latest) return Promise.resolve();
        return putQualitySnapshot(
          createQualitySnapshot({
            assetId,
            productionAssetId: latest.productionAssetId,
            beautyScore: latest.beautyScore,
            commercialScore: latest.commercialScore,
            thumbnailScore: latest.thumbnailScore,
            fragmented: latest.fragmented,
            deadSpace: latest.deadSpace,
            decision,
            generatorVersion: latest.generatorVersion,
            now,
          }),
        );
      }),
    );
  }

  async function handleReviewApprove(assetIds: string[]) {
    setBusy(true);
    try {
      await reclassifyReviewItems(assetIds, 'READY');
    } finally {
      setBusy(false);
      await reload();
    }
  }

  async function handleReviewReject(assetIds: string[]) {
    setBusy(true);
    try {
      await reclassifyReviewItems(assetIds, 'REJECT');
    } finally {
      setBusy(false);
      await reload();
    }
  }

  async function handleReviewRepair(assetIds: string[]) {
    setBusy(true);
    try {
      const now = Date.now();
      const repairTasks = assetIds.map((assetId) => createFactoryTask({ type: 'repair', reason: 'Owner requested repair from the Review Workspace.', assetId, batchId: run?.batchId ?? null, now }));
      await Promise.all(repairTasks.map((t) => putFactoryTask(t)));
    } finally {
      setBusy(false);
      await reload();
    }
  }

  if (loading && !dailyBrief) {
    return (
      <div className="pe">
        <p>Loading today's production…</p>
      </div>
    );
  }

  const progress = run ? deriveProductionProgress(run, tasks) : null;
  const reviewWaitingCount = countReviewWaiting(portfolioAssets, qualitySnapshots);
  const reviewItems = buildReviewWorkspaceItems(portfolioAssets, qualitySnapshots);
  const ownerActionItems = buildOwnerActionCenter(run, reviewWaitingCount, exportReadyCount);
  const canCompleteSession = run?.status === 'RUNNING' && !!run.batchId;

  return (
    <div className="pe">
      <div className="pe-header">
        <h1>Today's Production</h1>
        <button type="button" className="btn" onClick={onClose}>
          ← Back
        </button>
      </div>
      <nav className="pe-nav" aria-label="Production Experience navigation">
        <button type="button" className="btn" aria-current={screen === 'home'} onClick={() => setScreen('home')}>
          Home
        </button>
        <button type="button" className="btn" aria-current={screen === 'progress'} onClick={() => setScreen('progress')} disabled={!run}>
          Progress
        </button>
        <button type="button" className="btn" aria-current={screen === 'review'} onClick={() => setScreen('review')}>
          Review {reviewWaitingCount > 0 ? `(${reviewWaitingCount})` : ''}
        </button>
        <button type="button" className="btn" aria-current={screen === 'export'} onClick={() => setScreen('export')}>
          Export {exportReadyCount > 0 ? `(${exportReadyCount})` : ''}
        </button>
        <button type="button" className="btn" aria-current={screen === 'dashboard'} onClick={() => setScreen('dashboard')}>
          Dashboard
        </button>
      </nav>

      {error && <p className="pe-error" role="alert">{error}</p>}

      {screen === 'home' && dailyBrief && (
        <>
          <p className="pe-greeting">Good morning. {dailyBrief.todaysMission}</p>
          <div className="pe-tiles">
            <div className="pe-tile">
              <span className="pe-tile-label">Factory Status</span>
              <span className="pe-tile-value">{dailyBrief.factoryStatus}</span>
            </div>
            <div className="pe-tile">
              <span className="pe-tile-label">Estimated Owner Time</span>
              <span className="pe-tile-value">{Math.round(dailyBrief.estimatedOwnerTimeMinutes)} min</span>
            </div>
            <div className="pe-tile">
              <span className="pe-tile-label">Business Outcome</span>
              <span className="pe-tile-value">{dailyBrief.businessOutcomeScore !== null ? Math.round(dailyBrief.businessOutcomeScore) : '—'}</span>
            </div>
            <div className="pe-tile">
              <span className="pe-tile-label">Packages Ready</span>
              <span className="pe-tile-value">{dailyBrief.commercialPackagesReady}</span>
            </div>
            <div className="pe-tile">
              <span className="pe-tile-label">Review Waiting</span>
              <span className="pe-tile-value">{reviewWaitingCount}</span>
            </div>
            <div className="pe-tile">
              <span className="pe-tile-label">Factory Health</span>
              <span className="pe-tile-value">{factoryHealth?.queueHealth !== null && factoryHealth ? `${Math.round(factoryHealth.queueHealth ?? 0)}%` : '—'}</span>
            </div>
          </div>
          <div className="pe-primary-action">
            {continueYesterday?.hasUnfinishedWork ? (
              <>
                <p>{continueYesterday.reason}</p>
                <button type="button" className="btn btn--primary" onClick={handleContinueYesterday} disabled={busy}>
                  ▶ Continue Yesterday
                </button>
              </>
            ) : (
              <button type="button" className="btn btn--primary" onClick={handleStartFactory} disabled={busy}>
                ▶ START FACTORY
              </button>
            )}
          </div>
          <OwnerActionCenterList items={ownerActionItems} onAction={handleOwnerAction} busy={busy} />
        </>
      )}

      {screen === 'progress' && (
        <section aria-label="Production Progress">
          <h2>Production Progress</h2>
          {!run ? (
            <p className="pe-empty">No production run yet — click START FACTORY on Home.</p>
          ) : (
            <>
              <ProgressStepper progress={progress!} />
              {run.status === 'WAITING_OWNER_APPROVAL' && (
                <button type="button" className="btn btn--primary" onClick={handleApproveSession} disabled={busy}>
                  Approve today's production session
                </button>
              )}
              {run.status === 'BLOCKED' && (
                <button type="button" className="btn" onClick={handleCancelBlockedRun} disabled={busy}>
                  Cancel this run
                </button>
              )}
              {canCompleteSession && (
                <button type="button" className="btn btn--primary" onClick={handleCompleteSession} disabled={busy}>
                  Mark Session Complete
                </button>
              )}
              {run.status === 'RUNNING' && !run.batchId && (
                <>
                  <p className="pe-empty">
                    This session's plan is to generate new patterns — there is no existing batch to continue running here. Use "✨ ออกแบบให้ฉันวันนี้" (Autopilot) or Pattern Studio to generate the patterns, then
                    come back to Today's Production to review and export them.
                  </p>
                  <button type="button" className="btn" onClick={handleCancelBlockedRun} disabled={busy}>
                    Cancel this run
                  </button>
                </>
              )}
            </>
          )}
        </section>
      )}

      {screen === 'review' && <ReviewWorkspacePanel items={reviewItems} onApprove={handleReviewApprove} onReject={handleReviewReject} onRepair={handleReviewRepair} busy={busy} />}

      {screen === 'export' && <CommercialPipelineTab assets={[]} />}

      {screen === 'dashboard' && dailyBrief && (
        <FactoryDashboardPanel
          factoryStatus={dailyBrief.factoryStatus}
          businessOutcomeScore={dailyBrief.businessOutcomeScore}
          factoryEfficiency={factoryEfficiency}
          ownerDecisionsToday={dailyBrief.ownerDecisionsToday}
          withinDailyDecisionTarget={dailyBrief.withinDailyDecisionTarget}
          ownerTimeSavedMinutes={dailyBrief.estimatedOwnerTimeMinutes}
          commercialReadyCount={exportReadyCount}
          topRecommendationReason={dailyBrief.topRecommendation.reason}
        />
      )}

      {screen === 'summary' && completionReview && <SessionSummaryPanel review={completionReview} onDone={() => setScreen('home')} />}
    </div>
  );
}
