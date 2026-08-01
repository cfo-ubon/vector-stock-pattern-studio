import { useEffect, useState } from 'react';
import { generateAndSaveBusinessCoachRun } from '../../aiCeo/businessCoach';
import type { BusinessCoachRun, AiCeoAutopilotHandoff } from '../../aiCeo/domain/types';

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
