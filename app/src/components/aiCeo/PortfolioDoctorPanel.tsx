import { useEffect, useState, useCallback } from 'react';
import { generateAndSavePortfolioDiagnosis, defaultPortfolioDoctorPreferences, DEFAULT_OVERSUPPLY_SHARE, type PortfolioDoctorPreferences } from '../../aiCeo/portfolioDoctor';
import type { PortfolioDiagnosis, AiCeoAutopilotHandoff } from '../../aiCeo/domain/types';
import type { AiCeoNavigateTarget } from './BusinessCoachPanel';

// Build 030 Part 2, Module 4 — Portfolio Doctor panel. Exposes the
// user-configurable oversupply threshold directly in the UI (spec's own
// "allow the user to configure portfolio-balance preferences" requirement)
// rather than hiding it as a hardcoded constant.

interface Props {
  onAction: (autopilotAction: AiCeoAutopilotHandoff | null, navigateTarget: AiCeoNavigateTarget | null) => void;
}

const VERDICT_LABEL: Record<PortfolioDiagnosis['overallVerdict'], string> = {
  HEALTHY: 'Healthy',
  NEEDS_ATTENTION: 'Needs Attention',
  UNBALANCED: 'Unbalanced',
  INSUFFICIENT_DATA: 'Insufficient Data',
};

export function PortfolioDoctorPanel({ onAction }: Props) {
  const [diagnosis, setDiagnosis] = useState<PortfolioDiagnosis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [oversupplyPercent, setOversupplyPercent] = useState(Math.round(DEFAULT_OVERSUPPLY_SHARE * 100));

  const run = useCallback((preferences: PortfolioDoctorPreferences) => {
    generateAndSavePortfolioDiagnosis(preferences)
      .then((d) => setDiagnosis(d))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    run(defaultPortfolioDoctorPreferences());
  }, [run]);

  return (
    <section className="aiceo-portfolio-doctor">
      <h3>Portfolio Doctor</h3>
      <div className="aiceo-doctor-settings">
        <label htmlFor="aiceo-oversupply-threshold">Oversupply threshold</label>
        <input
          id="aiceo-oversupply-threshold"
          type="number"
          min={5}
          max={95}
          value={oversupplyPercent}
          onChange={(e) => setOversupplyPercent(Number(e.target.value))}
        />
        <span>%</span>
        <button type="button" className="btn" onClick={() => run({ oversupplyShare: oversupplyPercent / 100 })}>
          Re-run Diagnosis
        </button>
      </div>
      {error && (
        <p role="alert" className="aiceo-error">
          Could not load Portfolio Doctor: {error}
        </p>
      )}
      {!diagnosis && !error && <p className="aiceo-loading">Loading Portfolio Doctor…</p>}
      {diagnosis && (
        <div className="aiceo-doctor-body">
          <p className="aiceo-doctor-verdict">
            Overall: <strong>{VERDICT_LABEL[diagnosis.overallVerdict]}</strong>
          </p>
          <ul className="aiceo-doctor-findings">
            {diagnosis.findings.map((finding) => (
              <li key={finding.code} className={`aiceo-finding aiceo-finding--${finding.verdict.toLowerCase()}`}>
                <span className="aiceo-finding-verdict">{VERDICT_LABEL[finding.verdict]}</span>
                <p>{finding.finding}</p>
                <p className="aiceo-finding-evidence">{finding.evidence}</p>
                {finding.sendToAutopilotAction && (
                  <button type="button" className="btn" onClick={() => onAction(finding.sendToAutopilotAction, null)}>
                    Send to Autopilot
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
