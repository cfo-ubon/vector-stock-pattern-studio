import type { PortfolioImpactStatement } from '../../design-director/portfolioImpact/portfolioImpactEstimator';

interface Props {
  statements: PortfolioImpactStatement[] | null;
}

/** Section 10 — Portfolio Impact. Qualitative-only statements (never a
 * revenue estimate, per the module's own requirement), each with real
 * evidence from the stored portfolio — no statement is generated here. */
export function PortfolioImpactTab({ statements }: Props) {
  if (!statements) {
    return (
      <div className="design-director-tab portfolio-impact-tab">
        <p>Create a Collection Plan first (see the Collection Planner tab).</p>
      </div>
    );
  }

  return (
    <div className="design-director-tab portfolio-impact-tab">
      <h2>Portfolio Impact</h2>
      <ul className="portfolio-impact-list">
        {statements.map((s) => (
          <li key={s.statement}>
            <strong>{s.statement}</strong>
            <p>{s.evidence}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
