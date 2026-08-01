import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadMarketOpportunities } from '../../marketing/storage/marketOpportunityStore';
import { loadDailyMissions } from '../../marketing/storage/dailyMissionStore';
import { loadSeasonalEvents } from '../../marketing/storage/seasonalEventStore';
import { getMostRecentSnapshotForOfflineUse, type OfflineSnapshotResult } from '../../marketing/snapshot/snapshotService';
import { loadPortfolioAssets } from '../../catalog/storage/portfolioStore';
import { loadQualitySnapshots } from '../../catalog/quality/qualitySnapshotStore';
import type { PortfolioAsset } from '../../catalog/domain/types';

import { AUTOPILOT_MODE_VALUES, AUTOPILOT_MODE_LABEL_TH, AUTOPILOT_MODE_LABEL_EN, GUIDED_MODES, type AutopilotMode } from '../../autopilot/domain/autopilotMode';
import { emptyAutopilotConstraints, detectConstraintConflicts, type AutopilotConstraints } from '../../autopilot/domain/constraints';
import type { AutopilotProductionGoal } from '../../autopilot/collectionRolePlanner';
import { buildAutonomousDesignPlan, selectEvidence, type DecisionEngineInput } from '../../autopilot/decisionEngine';
import { supportedCategoryIds } from '../../autopilot/categoryInference';
import type { DesignPlan } from '../../autopilot/domain/designPlan';
import { createAutonomousDesignRun, transitionAutonomousDesignRun, type AutonomousDesignRun } from '../../autopilot/domain/autonomousDesignRun';
import { putAutonomousDesignRun } from '../../autopilot/storage/autonomousDesignRunStore';
import { prepareRunForGeneration } from '../../autopilot/runPreparation';
import { putMarketingDesignHandoff } from '../../design-director/storage/marketingDesignHandoffStore';
import { putCreativeBrief, getCreativeBrief } from '../../design-director/storage/creativeBriefStore';
import { putCollectionPlan, getCollectionPlan } from '../../design-director/storage/collectionPlanStore';
import type { CreativeBrief } from '../../design-director/domain/creativeBrief';
import type { CollectionPlan } from '../../design-director/domain/collectionPlan';
import type { MarketOpportunity } from '../../marketing/domain/marketOpportunity';
import { runAutonomousGeneration, type GenerationProgressEvent } from '../../autopilot/generationOrchestrator';
import { buildAutopilotResultSummary, type AutopilotResultSummary } from '../../autopilot/resultSummary';
import { promoteReadyToPortfolio, promoteAllToPortfolioWithStatus } from '../../autopilot/portfolioPromotion';
import { loadGenerateParamsForAsset, prepareAutopilotSeoForItem } from '../../autopilot/seoPreparation';
import { AutopilotHistoryView } from './AutopilotHistoryView';
import './autopilot.css';

// Build 029 — Autonomous Design Autopilot. The one screen that satisfies
// the spec's "no more than: (1) choose pattern count, (2) optionally
// choose marketplace or Auto, (3) review one final plan, (4) press
// Generate" requirement. Every step below calls the same real domain/
// storage modules the manual Marketing/Creative Director/Generator/QA/
// Portfolio screens already use — this view builds no parallel pipeline,
// it only sequences the existing one automatically.

type AutopilotStep = 'goal' | 'plan' | 'constraints' | 'generating' | 'review' | 'history';

interface Props {
  onClose: () => void;
  /** Build 030 (Mission Control) — when set, the view skips the goal
   * screen and builds the Design Plan immediately with this mode/count/
   * marketplace already chosen, landing straight on "review one final
   * plan, press Generate" (still 2 of the spec's 4 allowed decisions, not
   * a new bypass of them) — the same `handleQuickAction` +
   * `handleBuildPlan` a manual click on a Start Screen quick action would
   * trigger, just invoked once automatically on mount. Never re-triggers
   * on a prop identity change after the initial mount, so returning to an
   * already-in-progress Autopilot session never resets it. */
  initialAction?: { mode: AutopilotMode; requestedCount: number; marketplace?: string | null; productionGoal?: AutopilotProductionGoal; userInstruction?: string } | null;
  /** Build 030 Part 2, Module 11 ("Continue Yesterday") — when set to
   * `'history'`, lands directly on the real Autopilot History screen
   * instead of the Start Screen, so a Mission Control "Continue" action
   * doesn't make the user re-navigate there themselves. Ignored whenever
   * `initialAction` is also set (a real new plan takes priority). */
  initialStep?: 'history';
}

const MARKETPLACE_OPTIONS = ['Auto', 'Shutterstock', 'Adobe Stock', 'Freepik', 'Getty-iStock', 'Etsy'];
const PRODUCTION_GOAL_OPTIONS: Array<[AutopilotProductionGoal, string]> = [
  ['auto', 'Auto'],
  ['single', 'Single Pattern'],
  ['collection', 'Coordinated Collection'],
  ['portfolioExpansion', 'Portfolio Expansion'],
  ['seasonal', 'Seasonal Collection'],
];

export function AutopilotView({ onClose, initialAction = null, initialStep }: Props) {
  const [step, setStep] = useState<AutopilotStep>(initialAction ? 'goal' : (initialStep ?? 'goal'));

  // Real, already-verified data every mode's evidence selection reads —
  // loaded once on mount, exactly like every other screen's `reload()`.
  const [opportunities, setOpportunities] = useState<Awaited<ReturnType<typeof loadMarketOpportunities>>>([]);
  const [missions, setMissions] = useState<Awaited<ReturnType<typeof loadDailyMissions>>>([]);
  const [seasonalEvents, setSeasonalEvents] = useState<Awaited<ReturnType<typeof loadSeasonalEvents>>>([]);
  const [portfolioAssets, setPortfolioAssets] = useState<PortfolioAsset[]>([]);
  const [offline, setOffline] = useState<OfflineSnapshotResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [opps, miss, seasonal, assets, offlineResult] = await Promise.all([
        loadMarketOpportunities(),
        loadDailyMissions(),
        loadSeasonalEvents(),
        loadPortfolioAssets(),
        getMostRecentSnapshotForOfflineUse(),
      ]);
      setOpportunities(opps);
      setMissions(miss);
      setSeasonalEvents(seasonal);
      setPortfolioAssets(assets);
      setOffline(offlineResult);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Module 1 — Autopilot Start Screen state.
  const [mode, setMode] = useState<AutopilotMode>('FULL_AUTOPILOT');
  const [requestedCount, setRequestedCount] = useState(10);
  const [colorwayCount, setColorwayCount] = useState(3);
  const [marketplaceChoice, setMarketplaceChoice] = useState('Auto');
  const [productionGoal, setProductionGoal] = useState<AutopilotProductionGoal>('auto');
  const [userInstruction, setUserInstruction] = useState('');
  const [constraints, setConstraints] = useState<AutopilotConstraints>(emptyAutopilotConstraints());

  const [plan, setPlan] = useState<DesignPlan | null>(null);
  const [run, setRun] = useState<AutonomousDesignRun | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const [progress, setProgress] = useState<GenerationProgressEvent | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pauseRequestedRef = useRef(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [summary, setSummary] = useState<AutopilotResultSummary | null>(null);
  const [promotionMessage, setPromotionMessage] = useState<string | null>(null);
  const [seoStatus, setSeoStatus] = useState<Record<string, string>>({});

  const buildDecisionInput = useCallback(
    (overrideConstraints: AutopilotConstraints = constraints): DecisionEngineInput => ({
      mode,
      requestedCount,
      colorwayCount,
      marketplacePreference: marketplaceChoice === 'Auto' ? null : marketplaceChoice,
      productionGoal,
      userInstruction,
      constraints: overrideConstraints,
      opportunities,
      missions,
      seasonalEvents,
      portfolioAssets,
      offline: offline ?? { snapshot: null, freshnessLabel: '', classification: 'NO_DATA', message: '' },
      now: Date.now(),
    }),
    [mode, requestedCount, colorwayCount, marketplaceChoice, productionGoal, userInstruction, constraints, opportunities, missions, seasonalEvents, portfolioAssets, offline],
  );

  const handleBuildPlan = useCallback(() => {
    try {
      const input = buildDecisionInput();
      const newPlan = buildAutonomousDesignPlan(input);
      setPlan(newPlan);
      setPlanError(null);
      setStep('plan');
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : String(err));
    }
  }, [buildDecisionInput]);

  // Build 030 (Mission Control) — `initialAction`'s one-shot auto-start.
  // Builds the input directly from `initialAction` (never from `mode`/
  // `requestedCount`/`marketplaceChoice` state, which a `setMode(...)`
  // call in this same effect would not have updated yet for
  // `buildDecisionInput`'s closure) so the very first plan build is
  // correct on the first render — the `setMode`/`setRequestedCount`/
  // `setMarketplaceChoice` calls alongside it only keep the visible
  // fields and every *later* action (Generate, Adjust Goal) consistent
  // with what was actually planned. Waits for `reload()`'s data before
  // running (an empty `opportunities`/`missions` would silently produce
  // the offline evergreen fallback instead of real evidence), and the
  // `autoStartedRef` guard means it fires exactly once per mount even
  // though its dependencies change again once loading finishes.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!initialAction || autoStartedRef.current || loadError) return;
    if (opportunities.length === 0 && missions.length === 0 && seasonalEvents.length === 0 && !offline) return;
    autoStartedRef.current = true;
    const resolvedMarketplace = initialAction.marketplace ?? 'Auto';
    const resolvedProductionGoal = initialAction.productionGoal ?? 'auto';
    const resolvedInstruction = initialAction.userInstruction ?? '';
    setMode(initialAction.mode);
    setRequestedCount(initialAction.requestedCount);
    setMarketplaceChoice(resolvedMarketplace);
    setProductionGoal(resolvedProductionGoal);
    setUserInstruction(resolvedInstruction);
    try {
      const input: DecisionEngineInput = {
        mode: initialAction.mode,
        requestedCount: initialAction.requestedCount,
        colorwayCount,
        marketplacePreference: resolvedMarketplace === 'Auto' ? null : resolvedMarketplace,
        productionGoal: resolvedProductionGoal,
        userInstruction: resolvedInstruction,
        constraints,
        opportunities,
        missions,
        seasonalEvents,
        portfolioAssets,
        offline: offline ?? { snapshot: null, freshnessLabel: '', classification: 'NO_DATA', message: '' },
        now: Date.now(),
      };
      const newPlan = buildAutonomousDesignPlan(input);
      setPlan(newPlan);
      setPlanError(null);
      setStep('plan');
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : String(err));
    }
  }, [initialAction, opportunities, missions, seasonalEvents, portfolioAssets, offline, loadError, colorwayCount, userInstruction, constraints]);

  const handleQuickAction = useCallback((newMode: AutopilotMode, count: number, goal: AutopilotProductionGoal = 'auto') => {
    setMode(newMode);
    setRequestedCount(count);
    setProductionGoal(goal);
  }, []);

  const handleApplyConstraints = useCallback(
    (updated: AutopilotConstraints) => {
      setConstraints(updated);
      try {
        const input = buildDecisionInput(updated);
        const newPlan = buildAutonomousDesignPlan(input);
        setPlan(newPlan);
        setPlanError(null);
        setStep('plan');
      } catch (err) {
        setPlanError(err instanceof Error ? err.message : String(err));
      }
    },
    [buildDecisionInput],
  );

  const handleCancelPlan = useCallback(async () => {
    if (run && (run.status === 'PLAN_DRAFT' || run.status === 'PLAN_READY')) {
      const cancelled = transitionAutonomousDesignRun(run, 'CANCELLED', Date.now(), 'Cancelled before generation.');
      await putAutonomousDesignRun(cancelled);
    }
    setRun(null);
    setPlan(null);
    setStep('goal');
  }, [run]);

  /** The actual generation loop invocation — shared by a fresh run (after
   * `prepareRunForGeneration`) and a resumed run loaded from History
   * (Module 11), which must never re-run `prepareRunForGeneration` (that
   * step only belongs at PLAN_READY -> GENERATING, once per run). */
  const executeGeneration = useCallback(async (runToProcess: AutonomousDesignRun, brief: CreativeBrief, collectionPlan: CollectionPlan, opportunity: MarketOpportunity | null) => {
    abortControllerRef.current = new AbortController();
    pauseRequestedRef.current = false;
    setGenerationError(null);
    setStep('generating');

    try {
      const existingAssets = await loadPortfolioAssets();
      const finalRun = await runAutonomousGeneration({
        run: runToProcess,
        brief,
        plan: collectionPlan,
        opportunity,
        existingAssets,
        signal: abortControllerRef.current.signal,
        shouldPause: () => pauseRequestedRef.current,
        persistRun: async (r) => {
          await putAutonomousDesignRun(r);
          setRun(r);
        },
        onProgress: (event) => setProgress(event),
      });

      if (finalRun.status === 'COMPLETED') {
        const snapshots = await loadQualitySnapshots();
        setSummary(buildAutopilotResultSummary(finalRun, collectionPlan, snapshots));
        setStep('review');
      }
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const runGeneration = useCallback(
    async (startingRun: AutonomousDesignRun) => {
      const input = buildDecisionInput();
      const evidence = selectEvidence(input);
      try {
        const prepared = prepareRunForGeneration(startingRun);
        await putAutonomousDesignRun(prepared.run);
        await putMarketingDesignHandoff(prepared.marketingHandoff);
        await putCreativeBrief(prepared.brief);
        await putCollectionPlan(prepared.collectionPlan);
        setRun(prepared.run);
        await executeGeneration(prepared.run, prepared.brief, prepared.collectionPlan, evidence.opportunity);
      } catch (err) {
        setGenerationError(err instanceof Error ? err.message : String(err));
      }
    },
    [buildDecisionInput, executeGeneration],
  );

  const handleGenerateNow = useCallback(async () => {
    if (!plan) return;
    const input = buildDecisionInput();
    const evidence = selectEvidence(input);
    let newRun = createAutonomousDesignRun({
      mode,
      requestedCount,
      sourceEvidence: {
        marketOpportunityId: evidence.opportunity?.id ?? null,
        dailyMissionId: evidence.mission?.id ?? null,
        marketSnapshotId: offline?.snapshot?.id ?? null,
      },
      constraints,
    });
    newRun = { ...newRun, designPlan: plan };
    newRun = transitionAutonomousDesignRun(newRun, 'PLAN_READY', Date.now(), 'Design Plan approved by user.');
    await putAutonomousDesignRun(newRun);
    setRun(newRun);
    await runGeneration(newRun);
  }, [plan, buildDecisionInput, mode, requestedCount, constraints, offline, runGeneration]);

  const handlePause = useCallback(() => {
    pauseRequestedRef.current = true;
  }, []);

  const handleResume = useCallback(async () => {
    if (!run || run.status !== 'PAUSED') return;
    const resumed = transitionAutonomousDesignRun(run, 'GENERATING', Date.now(), 'Resumed by user.');
    await putAutonomousDesignRun(resumed);
    setRun(resumed);
    await runGeneration(resumed);
  }, [run, runGeneration]);

  const handleCancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handlePromoteReady = useCallback(async () => {
    if (!run) return;
    const result = await promoteReadyToPortfolio(run);
    setPromotionMessage(`นำ READY เข้า Portfolio แล้ว ${result.promoted.length} ชิ้น`);
  }, [run]);

  const handlePromoteAll = useCallback(async () => {
    if (!run) return;
    const result = await promoteAllToPortfolioWithStatus(run);
    setPromotionMessage(`นำเข้า Portfolio พร้อมสถานะแล้ว ${result.promoted.length} ชิ้น`);
  }, [run]);

  const handlePrepareSeo = useCallback(async () => {
    if (!run || !plan) return;
    const readyItems = run.items.filter((i) => i.decision === 'READY' && i.portfolioAssetId);
    const statuses: Record<string, string> = {};
    for (const item of readyItems) {
      const asset = portfolioAssets.find((a) => a.assetId === item.portfolioAssetId) ?? { metadataReference: null } as PortfolioAsset;
      const freshAsset = (await loadPortfolioAssets()).find((a) => a.assetId === item.portfolioAssetId) ?? asset;
      const params = await loadGenerateParamsForAsset(freshAsset);
      if (!params) {
        statuses[item.portfolioAssetId!] = 'Needs marketplace profile verification — no metadata sidecar found.';
        continue;
      }
      const seoResult = prepareAutopilotSeoForItem(item.portfolioAssetId!, params, plan.targetMarketplace);
      statuses[item.portfolioAssetId!] =
        seoResult.status === 'ready'
          ? `SEO ready: "${seoResult.results[0].package.title}" (${seoResult.results[0].package.keywords.length} keywords)`
          : seoResult.reason;
    }
    setSeoStatus(statuses);
  }, [run, plan, portfolioAssets]);

  const handleResumeFromHistory = useCallback(
    async (historyRun: AutonomousDesignRun) => {
      try {
        const [brief, collectionPlan] = await Promise.all([
          historyRun.creativeBriefId ? getCreativeBrief(historyRun.creativeBriefId) : undefined,
          historyRun.collectionPlanId ? getCollectionPlan(historyRun.collectionPlanId) : undefined,
        ]);
        if (!brief || !collectionPlan) {
          setGenerationError('Cannot resume — the run is missing its Creative Brief or Collection Plan.');
          setStep('generating');
          return;
        }
        setPlan(historyRun.designPlan);
        let resumed = historyRun;
        if (resumed.status === 'PAUSED') {
          resumed = transitionAutonomousDesignRun(resumed, 'GENERATING', Date.now(), 'Resumed from Autopilot History.');
          await putAutonomousDesignRun(resumed);
        }
        setRun(resumed);
        const opportunity = resumed.sourceEvidence.marketOpportunityId ? opportunities.find((o) => o.id === resumed.sourceEvidence.marketOpportunityId) ?? null : null;
        await executeGeneration(resumed, brief, collectionPlan, opportunity);
      } catch (err) {
        setGenerationError(err instanceof Error ? err.message : String(err));
        setStep('generating');
      }
    },
    [opportunities, executeGeneration],
  );

  const handleOpenCompletedFromHistory = useCallback(async (historyRun: AutonomousDesignRun) => {
    try {
      const collectionPlan = historyRun.collectionPlanId ? await getCollectionPlan(historyRun.collectionPlanId) : undefined;
      if (!collectionPlan) {
        setGenerationError('Cannot open — the run is missing its Collection Plan.');
        setStep('generating');
        return;
      }
      const snapshots = await loadQualitySnapshots();
      setRun(historyRun);
      setPlan(historyRun.designPlan);
      setSummary(buildAutopilotResultSummary(historyRun, collectionPlan, snapshots));
      setStep('review');
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleDuplicateFromHistory = useCallback(async (historyRun: AutonomousDesignRun) => {
    if (!historyRun.designPlan) return;
    let duplicated = createAutonomousDesignRun({
      mode: historyRun.mode,
      requestedCount: historyRun.requestedCount,
      sourceEvidence: historyRun.sourceEvidence,
      constraints: historyRun.constraints,
    });
    duplicated = { ...duplicated, designPlan: historyRun.designPlan };
    duplicated = transitionAutonomousDesignRun(duplicated, 'PLAN_READY', Date.now(), `Duplicated from run ${historyRun.id} with a new seed — not yet regenerated.`);
    await putAutonomousDesignRun(duplicated);
    setMode(historyRun.mode);
    setRequestedCount(historyRun.requestedCount);
    setRun(duplicated);
    setPlan(historyRun.designPlan);
    setStep('plan');
  }, []);

  const availableCategories = useMemo(() => supportedCategoryIds(), []);
  const constraintConflicts = useMemo(() => detectConstraintConflicts(constraints, availableCategories), [constraints, availableCategories]);

  const offlineBanner = plan?.offline ? (
    <div className="autopilot-offline-banner" role="status">
      🔌 OFFLINE AUTOPILOT — {offline?.snapshot ? `Using Market Snapshot dated: ${new Date(offline.snapshot.createdAt).toISOString().slice(0, 10)}` : plan.dataFreshness}
    </div>
  ) : null;

  return (
    <div className="autopilot">
      <div className="autopilot-header">
        <h1>✨ ออกแบบให้ฉันวันนี้ / Design for Me Today</h1>
        <div>
          {step !== 'history' && (
            <button type="button" className="btn" onClick={() => setStep('history')}>
              📜 ประวัติ
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            ← กลับ
          </button>
        </div>
      </div>

      {loadError && (
        <div className="autopilot-error" role="alert">
          Could not load Autopilot data: {loadError}
        </div>
      )}

      {step === 'history' && (
        <AutopilotHistoryView
          onResume={handleResumeFromHistory}
          onOpenCompleted={handleOpenCompletedFromHistory}
          onDuplicate={handleDuplicateFromHistory}
          onClose={() => setStep('goal')}
        />
      )}

      {step === 'goal' && (
        <div className="autopilot-step">
          <div className="autopilot-quick-actions">
            <button type="button" className="btn" onClick={() => handleQuickAction('FULL_AUTOPILOT', 5)}>
              สร้าง 5 ลาย
            </button>
            <button type="button" className="btn" onClick={() => handleQuickAction('FULL_AUTOPILOT', 10)}>
              สร้าง 10 ลาย
            </button>
            <button type="button" className="btn" onClick={() => handleQuickAction('SELLABLE_COLLECTION', 20, 'collection')}>
              สร้าง Collection 20 ลาย
            </button>
            <button type="button" className="btn" onClick={() => handleQuickAction('TODAYS_MISSION', requestedCount)}>
              ใช้คำแนะนำของนักการตลาดวันนี้
            </button>
            <button type="button" className="btn" onClick={() => handleQuickAction('PORTFOLIO_GAP', requestedCount)}>
              เติมหมวดที่ Portfolio ยังขาด
            </button>
          </div>

          <div className="autopilot-field-grid">
            <label>
              Autopilot Mode
              <select value={mode} onChange={(e) => setMode(e.target.value as AutopilotMode)}>
                {AUTOPILOT_MODE_VALUES.map((m) => (
                  <option key={m} value={m}>
                    {AUTOPILOT_MODE_LABEL_EN[m]} — {AUTOPILOT_MODE_LABEL_TH[m]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Number of Patterns
              <input type="number" min={1} max={200} value={requestedCount} onChange={(e) => setRequestedCount(Math.max(1, Number(e.target.value) || 1))} />
            </label>
            <label>
              Number of Colorways
              <input type="number" min={1} max={10} value={colorwayCount} onChange={(e) => setColorwayCount(Math.max(1, Number(e.target.value) || 1))} />
            </label>
            <label>
              Marketplace
              <select value={marketplaceChoice} onChange={(e) => setMarketplaceChoice(e.target.value)}>
                {MARKETPLACE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Production Goal
              <select value={productionGoal} onChange={(e) => setProductionGoal(e.target.value as AutopilotProductionGoal)}>
                {PRODUCTION_GOAL_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {mode === 'CUSTOM_GOAL' && (
              <label className="autopilot-field-full">
                คำสั่งของคุณ (เช่น "สร้างลาย Botanical สำหรับขาย Adobe Stock จำนวน 10 ลาย")
                <textarea value={userInstruction} onChange={(e) => setUserInstruction(e.target.value)} rows={2} />
              </label>
            )}
          </div>

          {planError && (
            <div className="autopilot-error" role="alert">
              {planError}
            </div>
          )}

          <button type="button" className="btn btn--primary autopilot-primary-action" onClick={handleBuildPlan}>
            สร้างแผนการออกแบบ →
          </button>
        </div>
      )}

      {step === 'plan' && plan && (
        <div className="autopilot-step">
          {offlineBanner}
          <div className="autopilot-plan-card">
            <h2>{plan.summary}</h2>
            <p className="autopilot-plan-meta">
              Confidence: {plan.confidence} · Data freshness: {plan.dataFreshness}
            </p>

            <h3>เหตุผลของแต่ละการตัดสินใจ</h3>
            <ul className="autopilot-decision-list">
              {plan.decisions.map((d) => (
                <li key={d.key}>
                  <strong>
                    {d.label}: {d.value}
                  </strong>
                  {d.userLocked && <span className="autopilot-locked-chip">locked</span>}
                  <div className="autopilot-rationale">
                    ระบบเลือกค่านี้เพราะ {d.rationaleTh}
                    <br />
                    <span className="autopilot-rationale-en">{d.rationaleEn}</span>
                  </div>
                </li>
              ))}
            </ul>

            <h3>โครงสร้าง Collection</h3>
            <ul className="autopilot-collection-structure">
              {plan.collectionStructure.map((c) => (
                <li key={c.role}>
                  {c.role}: {c.count}
                </li>
              ))}
            </ul>

            <div className="autopilot-plan-details">
              <p>Target customer: {plan.targetCustomer}</p>
              <p>Target products: {plan.targetProducts.length > 0 ? plan.targetProducts.join(', ') : 'Not Provided'}</p>
              <p>Visual direction: {plan.visualDirection}</p>
              <p>Palette direction: {plan.paletteDirection}</p>
              <p>Estimated production effort: {plan.estimatedProductionEffort}</p>
            </div>

            {plan.risks.length > 0 && (
              <div className="autopilot-risks">
                <h3>Risks</h3>
                <ul>
                  {plan.risks.map((r) => (
                    <li key={r.label}>
                      <strong>{r.label}:</strong> {r.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="autopilot-plan-actions">
            <button type="button" className="btn btn--primary" onClick={handleGenerateNow}>
              สร้างทันที
            </button>
            <button type="button" className="btn" onClick={() => setStep('constraints')}>
              ปรับข้อจำกัด
            </button>
            <button type="button" className="btn" onClick={handleCancelPlan}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {step === 'constraints' && (
        <ConstraintPanel
          constraints={constraints}
          conflicts={constraintConflicts}
          availableCategories={availableCategories}
          guided={GUIDED_MODES.has(mode)}
          onApply={handleApplyConstraints}
          onCancel={() => setStep('plan')}
        />
      )}

      {step === 'generating' && (
        <div className="autopilot-step">
          <h2>กำลังสร้างลวดลาย…</h2>
          {run && (
            <>
              <div className="autopilot-progress-bar" role="progressbar" aria-valuenow={run.completedCount} aria-valuemin={0} aria-valuemax={run.requestedCount}>
                <div className="autopilot-progress-fill" style={{ width: `${(run.completedCount / Math.max(1, run.requestedCount)) * 100}%` }} />
              </div>
              <p>
                {run.completedCount} / {run.requestedCount} — READY {run.readyCount} · REVIEW {run.reviewCount} · REJECT {run.rejectCount}
              </p>
              {progress && (
                <p className="autopilot-progress-detail">
                  {progress.stage}: {progress.itemLabel} ({progress.itemIndex + 1}/{progress.totalItems})
                </p>
              )}
              <div className="autopilot-generation-actions">
                {run.status === 'GENERATING' && (
                  <button type="button" className="btn" onClick={handlePause}>
                    หยุดชั่วคราว
                  </button>
                )}
                {run.status === 'PAUSED' && (
                  <button type="button" className="btn btn--primary" onClick={handleResume}>
                    ดำเนินการต่อ
                  </button>
                )}
                <button type="button" className="btn" onClick={handleCancelGeneration}>
                  ยกเลิก
                </button>
              </div>
            </>
          )}
          {generationError && (
            <div className="autopilot-error" role="alert">
              {generationError}
            </div>
          )}
        </div>
      )}

      {step === 'review' && summary && (
        <div className="autopilot-step">
          <h2>ผลลัพธ์การสร้างลวดลาย</h2>
          <p>
            {summary.completedCount} / {summary.requestedCount} generated — READY {summary.readyCount} · REVIEW {summary.reviewCount} · REJECT {summary.rejectCount}
          </p>
          <p>Collection complete: {summary.collectionComplete ? 'Yes' : 'No'}</p>

          <h3>Collection Balance</h3>
          <ul className="autopilot-collection-structure">
            {summary.collectionBalance.map((b) => (
              <li key={b.role}>
                {b.role}: {b.generated}/{b.planned}
              </li>
            ))}
          </ul>

          <h3>Best READY patterns</h3>
          <ul className="autopilot-collection-structure">
            {summary.bestReadyAssetIds.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>

          {summary.rejectionReasons.length > 0 && (
            <div className="autopilot-risks">
              <h3>Rejection reasons</h3>
              <ul>
                {summary.rejectionReasons.map((r) => (
                  <li key={r.collectionItemId}>
                    {r.portfolioAssetId}: {r.reasons.join('; ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="autopilot-plan-actions">
            <button type="button" className="btn btn--primary" onClick={handlePromoteReady}>
              นำ READY เข้า Portfolio
            </button>
            <button type="button" className="btn" onClick={handlePromoteAll}>
              นำทั้งหมดเข้า Portfolio พร้อมสถานะ
            </button>
            <button type="button" className="btn" onClick={handlePrepareSeo}>
              เตรียม SEO สำหรับ READY
            </button>
          </div>

          {promotionMessage && <p role="status">{promotionMessage}</p>}

          {Object.keys(seoStatus).length > 0 && (
            <ul className="autopilot-collection-structure">
              {Object.entries(seoStatus).map(([assetId, status]) => (
                <li key={assetId}>
                  {assetId}: {status}
                </li>
              ))}
            </ul>
          )}

          <button type="button" className="btn" onClick={onClose}>
            เสร็จสิ้น — กลับหน้าหลัก
          </button>
        </div>
      )}
    </div>
  );
}

interface ConstraintPanelProps {
  constraints: AutopilotConstraints;
  conflicts: ReturnType<typeof detectConstraintConflicts>;
  availableCategories: string[];
  guided: boolean;
  onApply: (constraints: AutopilotConstraints) => void;
  onCancel: () => void;
}

/** Module 4 — compact constraint panel, never the full advanced generator
 * UI. Edits a local draft and only commits (rebuilding the Design Plan)
 * when "ใช้ข้อจำกัดนี้ใหม่" is pressed. */
function ConstraintPanel({ constraints, availableCategories, guided, onApply, onCancel }: ConstraintPanelProps) {
  const [draft, setDraft] = useState<AutopilotConstraints>(constraints);
  const conflicts = useMemo(() => detectConstraintConflicts(draft, availableCategories), [draft, availableCategories]);

  return (
    <div className="autopilot-step">
      <h2>ปรับข้อจำกัด{guided ? ' (Guided Autopilot)' : ''}</h2>
      <div className="autopilot-field-grid">
        <label>
          Exclude category
          <select
            multiple
            value={draft.excludeCategoryIds}
            onChange={(e) => setDraft({ ...draft, excludeCategoryIds: Array.from(e.target.selectedOptions).map((o) => o.value) })}
          >
            {availableCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prefer marketplace
          <input type="text" value={draft.preferredMarketplace ?? ''} onChange={(e) => setDraft({ ...draft, preferredMarketplace: e.target.value || null })} />
        </label>
        <label>
          Prefer density
          <select value={draft.preferredDensity ?? ''} onChange={(e) => setDraft({ ...draft, preferredDensity: (e.target.value || null) as AutopilotConstraints['preferredDensity'] })}>
            <option value="">Auto</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label>
          Prefer style
          <select value={draft.preferredStyle ?? ''} onChange={(e) => setDraft({ ...draft, preferredStyle: (e.target.value || null) as AutopilotConstraints['preferredStyle'] })}>
            <option value="">Auto</option>
            <option value="minimal">Minimal</option>
            <option value="premium">Premium</option>
            <option value="playful">Playful</option>
          </select>
        </label>
        <label>
          Max production quantity
          <input type="number" min={1} value={draft.maxQuantity ?? ''} onChange={(e) => setDraft({ ...draft, maxQuantity: e.target.value ? Number(e.target.value) : null })} />
        </label>
        <label>
          Required product targets (comma-separated)
          <input
            type="text"
            value={draft.requiredProductTargets.join(', ')}
            onChange={(e) => setDraft({ ...draft, requiredProductTargets: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
          />
        </label>
      </div>

      {conflicts.length > 0 && (
        <div className="autopilot-error" role="alert">
          {conflicts.map((c) => (
            <p key={c.field}>
              {c.reason} — {c.suggestedResolution}
            </p>
          ))}
        </div>
      )}

      <div className="autopilot-plan-actions">
        <button type="button" className="btn btn--primary" disabled={conflicts.length > 0} onClick={() => onApply(draft)}>
          ใช้ข้อจำกัดนี้ใหม่
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
