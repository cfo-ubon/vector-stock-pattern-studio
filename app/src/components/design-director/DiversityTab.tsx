import type { CollectionDiversity } from '../../design-director/analysis/diversity';

interface Props {
  diversity: CollectionDiversity | null;
}

/** Section 6 — Collection Diversity. Pure display of an already-computed
 * `CollectionDiversity` — signals marked `available: false` are shown
 * honestly as "not yet available", never as a fabricated number. */
export function DiversityTab({ diversity }: Props) {
  if (!diversity) {
    return (
      <div className="design-director-tab diversity-tab">
        <p>Create a Collection Plan first (see the Collection Planner tab).</p>
      </div>
    );
  }

  return (
    <div className="design-director-tab diversity-tab">
      <h2>Collection Diversity</h2>
      <ul className="diversity-signal-list">
        {diversity.signals.map((signal) => (
          <li key={signal.id} className={signal.available ? undefined : 'diversity-signal--unavailable'}>
            <strong>
              {signal.label}
              {signal.available && signal.value !== undefined ? `: ${signal.value}` : ''}
            </strong>
            <p>{signal.note}</p>
          </li>
        ))}
      </ul>
      {diversity.warnings.length > 0 && (
        <div className="diversity-warnings">
          <strong>Suggested improvements</strong>
          <ul>
            {diversity.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {diversity.warnings.length === 0 && <p>No repetition concerns found against the current portfolio.</p>}
    </div>
  );
}
