import type { CollectionCompleteness } from '../../design-director/analysis/completeness';

interface Props {
  completeness: CollectionCompleteness | null;
}

/** Section 4 — Collection Completeness. Pure display of an already-computed
 * `CollectionCompleteness` — no check is (re)evaluated here. */
export function CompletenessTab({ completeness }: Props) {
  if (!completeness) {
    return (
      <div className="design-director-tab completeness-tab">
        <p>Create a Collection Plan first (see the Collection Planner tab).</p>
      </div>
    );
  }

  return (
    <div className="design-director-tab completeness-tab">
      <h2>Collection Completeness</h2>
      <p className="completeness-percent">{completeness.percent}%</p>
      <p>{completeness.commercialReadiness}</p>
      <ul className="completeness-checks">
        {completeness.checks.map((check) => (
          <li key={check.id} className={check.passed ? 'completeness-check--passed' : 'completeness-check--failed'}>
            <strong>{check.passed ? '✓' : '✗'} {check.label}</strong>
            <p>{check.explanation}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
