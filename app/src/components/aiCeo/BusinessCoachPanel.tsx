import { useEffect, useState } from 'react';
import { generateAndSaveBusinessCoachRun } from '../../aiCeo/businessCoach';
import type { BusinessCoachRun, AiCeoAutopilotHandoff, DecisionTrace } from '../../aiCeo/domain/types';

/** Build 031B Hardening (Section 4/7) — every card's underlying Decision OS
 * trace, when it has one, so a card can be verified without leaving this
 * panel. Purely additive: renders nothing beyond the existing title/value/
 * detail/action for cards with no `decisionTrace` (e.g. weekly-progress). */
function CardDecisionTrace({ trace }: { trace: DecisionTrace }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="aiceo-coach-card-trace">
      <button type="button" className="btn btn--link" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        {expanded ? 'Hide Why' : 'Why?'}
      </button>
      {expanded && (
        <dl>
          <dt>Policies</dt>
          <dd>{trace.policyIds.length > 0 ? trace.policyIds.join(', ') : 'None fired.'}</dd>
          <dt>Evidence</dt>
          <dd>{trace.evidenceIds.length > 0 ? trace.evidenceIds.join(', ') : 'None gathered.'}</dd>
          <dt>Confidence</dt>
          <dd>{trace.confidenceBand} ({trace.confidenceScore})</dd>
          <dt>Business Impact</dt>
          <dd>{trace.businessImpact}</dd>
          {trace.alternative && (
            <>
              <dt>Alternative</dt>
              <dd>
                {trace.alternative.action} — {trace.alternative.reason}
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}

// Build 030 Part 2, Module 3 — Business Coach panel. Self-contained (loads
// its own real data on mount), mirroring every other Mission Control
// section's own `reload()` pattern.

export type AiCeoNavigateTarget = 'portfolio' | 'marketing' | 'autopilotHistory' | 'advancedMode' | 'designDirector';

interface Props {
  requestedCount: number;
  onAction: (autopilotAction: AiCeoAutopilotHandoff | null, navigateTarget: AiCeoNavigateTarget | null) => void;
}

export function BusinessCoachPanel({ requestedCount, onAction }: Props) {
  const [run, setRun] = useState<BusinessCoachRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    generateAndSaveBusinessCoachRun(requestedCount)
      .then((r) => {
        if (!cancelled) setRun(r);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [requestedCount]);

  return (
    <section className="aiceo-business-coach">
      <h3>Business Coach</h3>
      {error && (
        <p role="alert" className="aiceo-error">
          Could not load Business Coach: {error}
        </p>
      )}
      {!run && !error && <p className="aiceo-loading">Loading Business Coach…</p>}
      {run && (
        <div className="aiceo-coach-grid">
          {run.cards.map((card) => (
            <div className="aiceo-coach-card" key={card.code}>
              <span className="aiceo-coach-title">{card.title}</span>
              <span className="aiceo-coach-value">{card.value}</span>
              <p className="aiceo-coach-detail">{card.detail}</p>
              {card.decisionTrace && <CardDecisionTrace trace={card.decisionTrace} />}
              {card.actionLabel && (
                <button type="button" className="btn" onClick={() => onAction(card.autopilotAction, card.navigateTarget)}>
                  {card.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
