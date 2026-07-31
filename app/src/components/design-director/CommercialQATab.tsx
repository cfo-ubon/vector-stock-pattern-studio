import type { CommercialQAResult } from '../../design-director/analysis/commercialQA';

interface Props {
  qa: CommercialQAResult | null;
}

/** Section 8 — Commercial QA. Pure display of an already-computed
 * `CommercialQAResult` covering the whole planned collection (never a
 * single pattern) — no dimension is scored in this file. */
export function CommercialQATab({ qa }: Props) {
  if (!qa) {
    return (
      <div className="design-director-tab commercial-qa-tab">
        <p>Create a Collection Plan first (see the Collection Planner tab).</p>
      </div>
    );
  }

  return (
    <div className="design-director-tab commercial-qa-tab">
      <h2>Commercial QA</h2>
      <p className="commercial-qa-overall">{qa.overall}/100</p>
      <table className="commercial-qa-table">
        <thead>
          <tr>
            <th scope="col">Dimension</th>
            <th scope="col">Score</th>
            <th scope="col">Explanation</th>
          </tr>
        </thead>
        <tbody>
          {qa.components.map((c) => (
            <tr key={c.dimension}>
              <th scope="row">{c.dimension}</th>
              <td>{c.score}/100</td>
              <td>{c.explanation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
