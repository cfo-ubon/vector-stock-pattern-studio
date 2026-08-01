import { useState } from 'react';
import type { AiCeoExplanation } from '../../aiCeo/domain/types';

// Build 030 Part 2, Module 12 — AI CEO Explanation. One shared expandable
// component every proactive statement (Morning Brief, a single
// recommendation card, a Portfolio Doctor finding) renders through, so
// "no hidden recommendation logic" is one reusable UI contract instead of
// each panel inventing its own partial explanation.

interface Props {
  explanation: AiCeoExplanation;
}

export function ExplanationBlock({ explanation }: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="aiceo-explanation-block">
      <button type="button" className="btn btn--link" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        {expanded ? 'Hide Explanation' : 'View Explanation'}
      </button>
      {expanded && (
        <dl className="aiceo-explanation-detail">
          <dt>Recommendation</dt>
          <dd>{explanation.recommendation}</dd>

          <dt>Why</dt>
          <dd>
            <ul>
              {explanation.why.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </dd>

          <dt>Evidence</dt>
          <dd>{explanation.evidence.length > 0 ? explanation.evidence.join(', ') : 'No verified evidence references — local analysis only.'}</dd>

          <dt>Confidence</dt>
          <dd>{explanation.confidence}</dd>

          <dt>Data Freshness</dt>
          <dd>{explanation.freshnessLabel}</dd>

          {explanation.assumptions.length > 0 && (
            <>
              <dt>Assumptions</dt>
              <dd>
                <ul>
                  {explanation.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </dd>
            </>
          )}

          {explanation.risks.length > 0 && (
            <>
              <dt>Risks</dt>
              <dd>
                <ul>
                  {explanation.risks.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </dd>
            </>
          )}

          {explanation.alternative && (
            <>
              <dt>Alternative</dt>
              <dd>{explanation.alternative}</dd>
            </>
          )}

          {explanation.memoryUsed.length > 0 && (
            <>
              <dt>Memory Used</dt>
              <dd>
                <ul>
                  {explanation.memoryUsed.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </dd>
            </>
          )}

          {explanation.missingData.length > 0 && (
            <>
              <dt>Missing Information</dt>
              <dd>
                <ul>
                  {explanation.missingData.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
