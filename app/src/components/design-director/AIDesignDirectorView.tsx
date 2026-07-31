import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadMarketOpportunities } from '../../marketing/storage/marketOpportunityStore';
import { loadMarketSnapshots } from '../../marketing/storage/marketSnapshotStore';
import { loadCreativeBriefs } from '../../design-director/storage/creativeBriefStore';
import { loadCollectionPlans } from '../../design-director/storage/collectionPlanStore';
import { loadGeneratorHandoffs } from '../../design-director/storage/generatorHandoffStore';
import { loadMarketingDesignHandoffs, putMarketingDesignHandoff } from '../../design-director/storage/marketingDesignHandoffStore';
import type { MarketingDesignHandoff } from '../../design-director/domain/marketingDesignHandoff';
import { transitionMarketingDesignHandoffWorkflow } from '../../design-director/domain/marketingDesignHandoff';
import type { WorkflowStatus } from '../../design-director/domain/workflowStatus';
import { loadPortfolioAssets } from '../../catalog/storage/portfolioStore';
import { computeCollectionCompleteness } from '../../design-director/analysis/completeness';
import { computeCollectionBalance } from '../../design-director/analysis/balance';
import { computeCollectionDiversity } from '../../design-director/analysis/diversity';
import { computeArtDirectorReview } from '../../design-director/analysis/artDirector';
import { computeCommercialQA } from '../../design-director/analysis/commercialQA';
import { recommendColorwayPlans } from '../../design-director/colorway/colorwayStrategist';
import { estimatePortfolioImpact } from '../../design-director/portfolioImpact/portfolioImpactEstimator';
import type { MarketOpportunity } from '../../marketing/domain/marketOpportunity';
import type { MarketSnapshot } from '../../marketing/domain/marketSnapshot';
import type { CreativeBrief } from '../../design-director/domain/creativeBrief';
import type { CollectionPlan } from '../../design-director/domain/collectionPlan';
import type { GeneratorHandoff } from '../../design-director/domain/generatorHandoff';
import type { PortfolioAsset } from '../../catalog/domain/types';
import type { GeneratorHandoffApplication, MappedGeneratorField } from '../../design-director/handoff/applyGeneratorHandoff';

import { CreativeBriefTab } from './CreativeBriefTab';
import { CollectionPlannerTab } from './CollectionPlannerTab';
import { RoadmapTab } from './RoadmapTab';
import { CompletenessTab } from './CompletenessTab';
import { BalanceTab } from './BalanceTab';
import { DiversityTab } from './DiversityTab';
import { ArtDirectorTab } from './ArtDirectorTab';
import { CommercialQATab } from './CommercialQATab';
import { PortfolioImpactTab } from './PortfolioImpactTab';
import { GeneratorHandoffTab } from './GeneratorHandoffTab';
import './designDirector.css';

// Build 028B — 🎨 นักออกแบบ / AI Creative Director. Reads every store the
// approved-opportunity → brief → plan → handoff workflow needs, computes
// each analysis module exactly once per render (Completeness/Balance/
// Diversity/Colorway are inputs to Art Director and Commercial QA, so this
// container computes them once and hands the same real result to every tab
// that needs it — no tab recomputes a score itself), and passes one shared
// `DesignDirectorData` object down, mirroring the Marketing Intelligence
// Center's `MarketingData` container convention exactly.

interface Props {
  onClose: () => void;
  onSendToGenerator: (application: GeneratorHandoffApplication, selectedFields: MappedGeneratorField[]) => void;
  /** Build 028C — preselects a brief when the app switches here right
   * after "ส่งให้นักออกแบบ" (Send to Creative Director) creates one. */
  initialSelectedBriefId?: string | null;
  /** Build 028C, requirement #13 — Creative Director -> Source Opportunity
   * cross-navigation, owned by `App.tsx` (it owns the view-switching
   * state this needs). */
  onViewSourceOpportunity?: (opportunityId: string) => void;
}

export type DesignDirectorTab =
  | 'brief'
  | 'planner'
  | 'roadmap'
  | 'completeness'
  | 'balance'
  | 'diversity'
  | 'artDirector'
  | 'commercialQA'
  | 'portfolioImpact'
  | 'handoff';

const TABS: Array<[DesignDirectorTab, string]> = [
  ['brief', 'Creative Brief'],
  ['planner', 'Collection Planner'],
  ['roadmap', 'Roadmap'],
  ['completeness', 'Completeness'],
  ['balance', 'Balance'],
  ['diversity', 'Diversity'],
  ['artDirector', 'Art Director'],
  ['commercialQA', 'Commercial QA'],
  ['portfolioImpact', 'Portfolio Impact'],
  ['handoff', 'Generator Handoff'],
];

export interface DesignDirectorData {
  opportunities: MarketOpportunity[];
  snapshots: MarketSnapshot[];
  briefs: CreativeBrief[];
  plans: CollectionPlan[];
  handoffs: GeneratorHandoff[];
  portfolioAssets: PortfolioAsset[];
  marketingHandoffs: MarketingDesignHandoff[];
}

export function AIDesignDirectorView({ onClose, onSendToGenerator, initialSelectedBriefId, onViewSourceOpportunity }: Props) {
  const [tab, setTab] = useState<DesignDirectorTab>('brief');
  const [data, setData] = useState<DesignDirectorData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [opportunities, snapshots, briefs, plans, handoffs, portfolioAssets, marketingHandoffs] = await Promise.all([
        loadMarketOpportunities(),
        loadMarketSnapshots(),
        loadCreativeBriefs(),
        loadCollectionPlans(),
        loadGeneratorHandoffs(),
        loadPortfolioAssets(),
        loadMarketingDesignHandoffs(),
      ]);
      setData({ opportunities, snapshots, briefs, plans, handoffs, portfolioAssets, marketingHandoffs });
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (initialSelectedBriefId) setSelectedBriefId(initialSelectedBriefId);
  }, [initialSelectedBriefId]);

  const activeBrief = useMemo(() => data?.briefs.find((b) => b.id === selectedBriefId) ?? null, [data, selectedBriefId]);
  const activePlan = useMemo(() => {
    if (!data || !activeBrief) return null;
    const plans = data.plans.filter((p) => p.briefId === activeBrief.id);
    return plans.length > 0 ? [...plans].sort((a, b) => b.createdAt - a.createdAt)[0] : null;
  }, [data, activeBrief]);
  const activeHandoff = useMemo(() => {
    if (!data || !activePlan) return null;
    const handoffs = data.handoffs.filter((h) => h.collectionPlanId === activePlan.id);
    return handoffs.length > 0 ? [...handoffs].sort((a, b) => b.createdAt - a.createdAt)[0] : null;
  }, [data, activePlan]);
  const activeOpportunity = useMemo(
    () => (data && activeBrief?.sourceOpportunityId ? (data.opportunities.find((o) => o.id === activeBrief.sourceOpportunityId) ?? null) : null),
    [data, activeBrief],
  );
  /** Build 028C — the one `MarketingDesignHandoff` record spanning this
   * brief's whole Marketing -> Creative Director workflow, found via the
   * `creativeBriefId` link set the moment "ส่งให้นักออกแบบ" created it. A
   * brief created the old way (directly from the Creative Brief tab's own
   * "Generate from an approved Market Opportunity" flow, with no Marketing
   * Handoff review) honestly has none. */
  const activeMarketingHandoff = useMemo(
    () => (data && activeBrief ? (data.marketingHandoffs.find((h) => h.creativeBriefId === activeBrief.id) ?? null) : null),
    [data, activeBrief],
  );

  const handleUpdateMarketingHandoff = useCallback(
    async (patch: Partial<MarketingDesignHandoff>, status: WorkflowStatus, note?: string) => {
      if (!activeMarketingHandoff) return;
      const updated = transitionMarketingDesignHandoffWorkflow({ ...activeMarketingHandoff, ...patch }, status, Date.now(), note);
      await putMarketingDesignHandoff(updated);
      await reload();
    },
    [activeMarketingHandoff, reload],
  );

  const completeness = useMemo(() => (activePlan ? computeCollectionCompleteness(activePlan) : null), [activePlan]);
  const balance = useMemo(() => (activePlan ? computeCollectionBalance(activePlan) : null), [activePlan]);
  const diversity = useMemo(
    () => (activePlan && activeBrief && data ? computeCollectionDiversity(activePlan, activeBrief, data.portfolioAssets) : null),
    [activePlan, activeBrief, data],
  );
  const colorwayResult = useMemo(() => (activeBrief ? recommendColorwayPlans(activeBrief) : null), [activeBrief]);
  const artDirectorReview = useMemo(
    () => (activeBrief && completeness && balance && diversity ? computeArtDirectorReview(activeBrief, completeness, balance, diversity) : null),
    [activeBrief, completeness, balance, diversity],
  );
  const commercialQA = useMemo(
    () => (activeBrief && activePlan && completeness && balance && diversity ? computeCommercialQA(activeBrief, activePlan, completeness, balance, diversity) : null),
    [activeBrief, activePlan, completeness, balance, diversity],
  );
  const portfolioImpact = useMemo(
    () => (activePlan && activeBrief && data ? estimatePortfolioImpact(activePlan, activeBrief, data.portfolioAssets) : null),
    [activePlan, activeBrief, data],
  );

  return (
    <div className="design-director">
      <div className="design-director-header">
        <h1>🎨 AI Creative Director (นักออกแบบ)</h1>
        <button type="button" className="btn" onClick={onClose}>
          ← กลับ
        </button>
      </div>

      <nav className="design-director-tab-nav" aria-label="แท็บ AI Creative Director">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" className={`btn${tab === key ? ' btn--primary' : ''}`} aria-pressed={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {loadError && (
        <div className="design-director-error" role="alert">
          Could not load AI Creative Director data: {loadError}
        </div>
      )}

      {!data && !loadError && <div className="design-director-loading">Loading AI Creative Director data…</div>}

      {data && (
        <>
          {tab === 'brief' && (
            <CreativeBriefTab
              data={data}
              reload={reload}
              selectedBriefId={selectedBriefId}
              onSelectBrief={setSelectedBriefId}
              activeBrief={activeBrief}
              activeMarketingHandoff={activeMarketingHandoff}
              activeOpportunity={activeOpportunity}
              onUpdateMarketingHandoff={handleUpdateMarketingHandoff}
              onViewSourceOpportunity={onViewSourceOpportunity}
            />
          )}
          {tab === 'planner' && (
            <CollectionPlannerTab
              data={data}
              reload={reload}
              activeBrief={activeBrief}
              activePlan={activePlan}
              colorwayResult={colorwayResult}
              activeMarketingHandoff={activeMarketingHandoff}
              onUpdateMarketingHandoff={handleUpdateMarketingHandoff}
              activeOpportunity={activeOpportunity}
              onViewSourceOpportunity={onViewSourceOpportunity}
              onGoToHandoffTab={() => setTab('handoff')}
            />
          )}
          {tab === 'roadmap' && <RoadmapTab activePlan={activePlan} />}
          {tab === 'completeness' && <CompletenessTab completeness={completeness} />}
          {tab === 'balance' && <BalanceTab balance={balance} />}
          {tab === 'diversity' && <DiversityTab diversity={diversity} />}
          {tab === 'artDirector' && <ArtDirectorTab review={artDirectorReview} />}
          {tab === 'commercialQA' && <CommercialQATab qa={commercialQA} />}
          {tab === 'portfolioImpact' && <PortfolioImpactTab statements={portfolioImpact} />}
          {tab === 'handoff' && (
            <GeneratorHandoffTab
              data={data}
              reload={reload}
              activeBrief={activeBrief}
              activePlan={activePlan}
              activeHandoff={activeHandoff}
              activeOpportunity={activeOpportunity}
              colorwayResult={colorwayResult}
              onSendToGenerator={onSendToGenerator}
              activeMarketingHandoff={activeMarketingHandoff}
              onUpdateMarketingHandoff={handleUpdateMarketingHandoff}
              onViewSourceOpportunity={onViewSourceOpportunity}
            />
          )}
        </>
      )}
    </div>
  );
}
