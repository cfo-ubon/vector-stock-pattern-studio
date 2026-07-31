import type { OpportunityScoreResult } from '../../marketing/scoring/opportunityScoring';
import { EvidenceBadge, ConfidenceBadge } from './evidenceDisplay';

// Build 028 Phase 4 — the shared explainability panel for
// OpportunityScoreResult, satisfying Module 1 Section 9's "never hide the
// scoring formula" requirement and the brief's "every recommendation must
// show why it was recommended / evidence / confidence" rule. Every number
// shown here is read directly off the already-computed score object —
// this component performs no scoring math of its own.

export function ScoreBreakdownPanel({ score }: { score: OpportunityScoreResult }) {
  return (
    <div className="score-breakdown">
      <div className="score-breakdown-header">
        <span className="score-breakdown-overall">{score.overall}/100</span>
        <span className={`score-breakdown-band score-breakdown-band--${score.band.toLowerCase().replace(/\s+/g, '-')}`}>{score.band}</span>
        <ConfidenceBadge confidence={score.confidence} />
      </div>
      {score.missingDimensions.length > 0 && (
        <p className="score-breakdown-missing">
          Missing evidence for {score.missingDimensions.length} dimension(s): {score.missingDimensions.join(', ')} — these were excluded from the
          weighted average, not treated as zero.
        </p>
      )}
      <table className="score-breakdown-table">
        <caption className="sr-only">Scoring dimension breakdown</caption>
        <thead>
          <tr>
            <th scope="col">Dimension</th>
            <th scope="col">Raw value</th>
            <th scope="col">Weight</th>
            <th scope="col">Weighted contribution</th>
            <th scope="col">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {score.components.map((component) => (
            <tr key={component.dimension} className={component.missingData ? 'score-breakdown-row--missing' : undefined}>
              <th scope="row">{component.dimension}</th>
              <td>{component.missingData ? '— no evidence yet' : component.rawValue}</td>
              <td>{component.weight}</td>
              <td>{component.missingData ? '—' : component.weightedContribution.toFixed(1)}</td>
              <td>{component.evidenceSource ? <EvidenceBadge status={component.evidenceSource} /> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
