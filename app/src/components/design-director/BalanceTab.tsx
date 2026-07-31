import type { CollectionBalance } from '../../design-director/analysis/balance';

interface Props {
  balance: CollectionBalance | null;
}

/** Section 5 — Collection Balance. Pure display of an already-computed
 * `CollectionBalance` — no ratio comparison happens in this file. */
export function BalanceTab({ balance }: Props) {
  if (!balance) {
    return (
      <div className="design-director-tab balance-tab">
        <p>Create a Collection Plan first (see the Collection Planner tab).</p>
      </div>
    );
  }

  return (
    <div className="design-director-tab balance-tab">
      <h2>Collection Balance</h2>
      <table className="balance-table">
        <thead>
          <tr>
            <th scope="col">Pattern type</th>
            <th scope="col">Count</th>
            <th scope="col">Actual %</th>
            <th scope="col">Target %</th>
            <th scope="col">Within tolerance</th>
          </tr>
        </thead>
        <tbody>
          {balance.entries.map((entry) => (
            <tr key={entry.patternType} className={entry.withinTolerance ? undefined : 'balance-row--warning'}>
              <th scope="row">{entry.label}</th>
              <td>{entry.count}</td>
              <td>{entry.actualPercent}%</td>
              <td>{entry.targetPercent}%</td>
              <td>{entry.withinTolerance ? '✓' : '⚠'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {balance.warnings.length > 0 && (
        <div className="balance-warnings">
          <strong>Warnings</strong>
          <ul>
            {balance.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {balance.warnings.length === 0 && <p>No balance warnings — the collection follows the typical balanced ratio.</p>}
    </div>
  );
}
