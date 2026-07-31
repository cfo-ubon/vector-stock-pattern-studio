import { useEffect, useState } from 'react';
import type { DesignDirectorData } from './AIDesignDirectorView';
import type { CreativeBrief } from '../../design-director/domain/creativeBrief';
import { COLLECTION_PATTERN_TYPE_VALUES, COLLECTION_PATTERN_TYPE_LABELS, type CollectionPlan, type PatternTypeCounts } from '../../design-director/domain/collectionPlan';
import { buildCollectionPlan, defaultPatternTypeRatios } from '../../design-director/planner/collectionPlanner';
import { putCollectionPlan } from '../../design-director/storage/collectionPlanStore';
import type { RecommendColorwayPlansResult } from '../../design-director/colorway/colorwayStrategist';
import type { MarketingDesignHandoff } from '../../design-director/domain/marketingDesignHandoff';
import type { WorkflowStatus } from '../../design-director/domain/workflowStatus';
import type { MarketOpportunity } from '../../marketing/domain/marketOpportunity';
import { WorkflowStatusCard } from './WorkflowStatusCard';

interface Props {
  data: DesignDirectorData;
  reload: () => Promise<void>;
  activeBrief: CreativeBrief | null;
  activePlan: CollectionPlan | null;
  colorwayResult: RecommendColorwayPlansResult | null;
  /** Build 028C — the Marketing -> Creative Director workflow record for
   * this brief, so creating a plan can transition it to COLLECTION_PLANNED. */
  activeMarketingHandoff: MarketingDesignHandoff | null;
  onUpdateMarketingHandoff: (patch: Partial<MarketingDesignHandoff>, status: WorkflowStatus, note?: string) => Promise<void>;
  activeOpportunity: MarketOpportunity | null;
  onViewSourceOpportunity?: (opportunityId: string) => void;
  /** Build 028C, requirement #13 — Collection Plan -> Generator
   * cross-navigation. */
  onGoToHandoffTab: () => void;
}

/** Section 2 (Collection Planner) + Section 9 (Colorway Strategist, folded
 * into this tab since the UI spec lists 10 pages, not 11 — Colorway
 * Strategist has no dedicated page). The pattern-type ratio is always
 * editable per the module's own requirement; `defaultPatternTypeRatios`
 * only supplies the starting point. */
export function CollectionPlannerTab({
  data,
  reload,
  activeBrief,
  activePlan,
  colorwayResult,
  activeMarketingHandoff,
  onUpdateMarketingHandoff,
  activeOpportunity,
  onViewSourceOpportunity,
  onGoToHandoffTab,
}: Props) {
  const [counts, setCounts] = useState<PatternTypeCounts | null>(null);
  const [colorwayCount, setColorwayCount] = useState(3);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (activePlan) {
      setCounts(activePlan.patternTypeCounts);
      setColorwayCount(activePlan.colorwayCount);
    } else if (activeBrief) {
      setCounts(defaultPatternTypeRatios(activeBrief.collectionSize));
      setColorwayCount(3);
    } else {
      setCounts(null);
    }
  }, [activePlan, activeBrief]);

  if (!activeBrief) {
    return (
      <div className="design-director-tab collection-planner-tab">
        <p>Select or generate a Creative Brief first (see the Creative Brief tab).</p>
      </div>
    );
  }

  const total = counts ? COLLECTION_PATTERN_TYPE_VALUES.reduce((sum, t) => sum + counts[t], 0) : 0;

  const handleSave = async () => {
    if (!counts) return;
    setBusy(true);
    try {
      const plan = buildCollectionPlan(activeBrief, { patternTypeCounts: counts, colorwayCount });
      await putCollectionPlan(plan);
      if (activeMarketingHandoff) {
        await onUpdateMarketingHandoff({ collectionPlanId: plan.id }, 'COLLECTION_PLANNED');
      } else {
        await reload();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="design-director-tab collection-planner-tab">
      {activeMarketingHandoff && (
        <WorkflowStatusCard
          handoff={activeMarketingHandoff}
          opportunity={activeOpportunity}
          onViewSourceOpportunity={onViewSourceOpportunity}
          generatorReady={!!activeMarketingHandoff.generatorHandoffId}
        />
      )}
      <h2>{activeBrief.collectionName} — Collection Plan</h2>
      {counts && (
        <>
          <table className="pattern-type-table">
            <thead>
              <tr>
                <th scope="col">Pattern type</th>
                <th scope="col">Count</th>
              </tr>
            </thead>
            <tbody>
              {COLLECTION_PATTERN_TYPE_VALUES.map((type) => (
                <tr key={type}>
                  <th scope="row">{COLLECTION_PATTERN_TYPE_LABELS[type]}</th>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={counts[type]}
                      onChange={(e) => setCounts((prev) => (prev ? { ...prev, [type]: Math.max(0, Number(e.target.value)) } : prev))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pattern-type-total">Total planned: {total} (brief target: {activeBrief.collectionSize})</p>
          <label>
            Colorway count:{' '}
            <input type="number" min={1} value={colorwayCount} onChange={(e) => setColorwayCount(Math.max(1, Number(e.target.value)))} />
          </label>
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void handleSave()}>
            {activePlan ? 'Save Updated Plan' : 'Create Collection Plan'}
          </button>
          {activePlan && (
            <button type="button" className="btn" onClick={onGoToHandoffTab}>
              Go to Generator Handoff →
            </button>
          )}
        </>
      )}

      {colorwayResult && (
        <section className="colorway-strategist">
          <h2>Colorway Strategist</h2>
          {colorwayResult.note && <p className="no-data-banner">{colorwayResult.note}</p>}
          <div className="colorway-plan-cards">
            {colorwayResult.plans.map((p) => (
              <div key={p.id} className="colorway-plan-card">
                <strong>{p.label}</strong>
                <div className="colorway-swatches">
                  {p.colors.map((c, i) => (
                    <span key={i} className="colorway-swatch" style={{ background: c }} title={c} />
                  ))}
                </div>
                <p>{p.rationale}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.plans.filter((p) => p.briefId === activeBrief.id).length > 1 && (
        <p className="plan-history-note">{data.plans.filter((p) => p.briefId === activeBrief.id).length} plan versions saved for this brief — the most recent is shown.</p>
      )}
    </div>
  );
}
