import { useState } from 'react';
import type { ReviewWorkspaceItem } from '../../productionExperience/reviewWorkspace';

interface Props {
  items: ReviewWorkspaceItem[];
  onApprove: (assetIds: string[]) => void;
  onReject: (assetIds: string[]) => void;
  onRepair: (assetIds: string[]) => void;
  busy?: boolean;
}

/** Part 5 — Review Workspace. Shows only REVIEW-decision items (READY
 * items are filtered out already by `buildReviewWorkspaceItems`, before
 * this component ever sees them). Approve/Reject/Repair act on the real
 * `PortfolioAsset.workflowStatus` / a real `repair`-type `FactoryTask` —
 * both handled by the caller, this component only collects the owner's
 * choice. */
export function ReviewWorkspacePanel({ items, onApprove, onReject, onRepair, busy = false }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(assetId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }

  if (items.length === 0) {
    return <p className="pe-empty">Nothing waiting for review right now.</p>;
  }

  const selectedIds = [...selected];

  return (
    <section aria-label="Review Workspace">
      <div className="pe-review-actions" style={{ marginBottom: '0.75rem' }}>
        <button type="button" className="btn" onClick={() => setSelected(new Set(items.map((i) => i.asset.assetId)))} disabled={busy}>
          Select all
        </button>
        <button type="button" className="btn" onClick={() => setSelected(new Set())} disabled={busy || selected.size === 0}>
          Clear selection
        </button>
        <button type="button" className="btn btn--primary" onClick={() => onApprove(selectedIds)} disabled={busy || selected.size === 0}>
          Approve selected ({selected.size})
        </button>
        <button type="button" className="btn" onClick={() => onReject(selectedIds)} disabled={busy || selected.size === 0}>
          Reject selected
        </button>
        <button type="button" className="btn" onClick={() => onRepair(selectedIds)} disabled={busy || selected.size === 0}>
          Repair selected
        </button>
      </div>
      <div className="pe-list">
        {items.map(({ asset, snapshot }) => (
          <div className="pe-review-item" key={asset.assetId}>
            <label>
              <input type="checkbox" checked={selected.has(asset.assetId)} onChange={() => toggle(asset.assetId)} disabled={busy} />{' '}
              <strong>{asset.displayName}</strong>
            </label>
            <span className="pe-review-item-meta">
              Beauty {Math.round(snapshot.beautyScore)} · Commercial {Math.round(snapshot.commercialScore)}
              {snapshot.fragmented ? ' · fragmented' : ''}
              {snapshot.deadSpace ? ' · dead space' : ''}
            </span>
            <div className="pe-review-actions">
              <button type="button" className="btn btn--small" onClick={() => onApprove([asset.assetId])} disabled={busy}>
                Approve
              </button>
              <button type="button" className="btn btn--small" onClick={() => onReject([asset.assetId])} disabled={busy}>
                Reject
              </button>
              <button type="button" className="btn btn--small" onClick={() => onRepair([asset.assetId])} disabled={busy}>
                Repair
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
