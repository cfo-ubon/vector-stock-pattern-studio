import type { FactoryTask } from '../../factory/domain/types';
import type { PortfolioAsset } from '../../catalog/domain/types';

interface Props {
  repairTasks: FactoryTask[];
  assets: PortfolioAsset[];
}

/** Hotfix v1.0.2, BUG-004 — the Session Summary's "Repair" count previously
 * had no owner-facing destination: the Review tab only ever showed
 * REVIEW-decision items, so REJECT-decision assets with a real `repair`-type
 * `FactoryTask` (Build 031C's own dependency-chain repair step) were
 * counted but never visible or actionable anywhere. This panel reads the
 * exact same `FactoryTask` records `factoryReview.ts`'s `repairCount`
 * already counts — no new data model, no new repair logic. */
export function RepairActivityPanel({ repairTasks, assets }: Props) {
  if (repairTasks.length === 0) return null;

  const assetName = (assetId: string | null) => (assetId ? assets.find((a) => a.assetId === assetId)?.displayName ?? assetId : '—');
  const lastNote = (task: FactoryTask) => task.history[task.history.length - 1]?.note ?? task.reason;

  return (
    <section aria-label="Repair Activity" className="pe-repair-activity" style={{ marginTop: '1.5rem' }}>
      <h3>Repair Activity ({repairTasks.length})</h3>
      <p className="pe-empty">
        Every generated asset gets an automatic repair check; most pass through with nothing to do. This lists what actually happened, asset by asset.
      </p>
      <div className="pe-list">
        {repairTasks.map((task) => (
          <div className="pe-review-item" key={task.id}>
            <strong>{assetName(task.assetId)}</strong>
            <span className="pe-review-item-meta">
              {task.status}
              {lastNote(task) ? ` — ${lastNote(task)}` : ''}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
