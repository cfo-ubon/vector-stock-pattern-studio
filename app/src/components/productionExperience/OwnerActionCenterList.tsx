import type { OwnerActionItem, OwnerActionType } from '../../productionExperience/ownerActionCenter';

interface Props {
  items: OwnerActionItem[];
  onAction: (type: OwnerActionType) => void;
  busy?: boolean;
}

const ACTION_BUTTON_LABEL: Record<OwnerActionType, string> = {
  APPROVE_SESSION: 'Approve',
  APPROVE_OVERRIDE: 'Review',
  REVIEW_IMAGES: 'Open Review',
  EXPORT_PACKAGES: 'Open Export',
};

/** Part 4 — Owner Action Center. Shows only real items; renders nothing
 * (not even a heading) when there is nothing requiring attention. */
export function OwnerActionCenterList({ items, onAction, busy = false }: Props) {
  if (items.length === 0) return null;
  return (
    <section className="pe-action-center" aria-label="Owner Action Center">
      <h2>Needs your attention</h2>
      {items.map((item) => (
        <div className="pe-action-item" key={item.type}>
          <div>
            <strong>{item.label}</strong>
            <p className="pe-action-item-detail">{item.detail}</p>
          </div>
          <button type="button" className="btn btn--primary" onClick={() => onAction(item.type)} disabled={busy}>
            {ACTION_BUTTON_LABEL[item.type]}
          </button>
        </div>
      ))}
    </section>
  );
}
