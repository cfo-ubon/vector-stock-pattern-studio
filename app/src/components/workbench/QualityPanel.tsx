import type { DesignSpecQualityLoopResult } from '../../trend/designSpecQuality';
import { buildQualityRecommendations } from '../../trend/designSpecQuality';

// Design Workbench Section 7 ("Quality Panel") — Composition/Hierarchy/
// Overlap/Negative Space/Rhythm/Commercial Readiness plus actionable
// recommendations, all read from the *same* `DesignSpecQualityLoopResult`
// the Live Preview panel's Composition tab already computes (passed down
// from DesignWorkbench.tsx, never re-run here) — this component only
// displays and never re-derives a score. `buildQualityRecommendations`
// (trend/designSpecQuality.ts) is the one real recommendation engine;
// this panel doesn't invent its own advice text.

type QualityReport = DesignSpecQualityLoopResult['check']['report'];
type DimensionKey = Exclude<keyof QualityReport, 'overall'>;

const NAMED_DIMENSIONS: Array<{ key: DimensionKey; label: string }> = [
  { key: 'composition', label: 'Composition' },
  { key: 'hierarchy', label: 'Hierarchy' },
  { key: 'overlap', label: 'Overlap' },
  { key: 'negativeSpace', label: 'Negative Space' },
  { key: 'rhythm', label: 'Rhythm' },
  { key: 'commercialReadiness', label: 'Commercial Readiness' },
];

const OTHER_DIMENSIONS: Array<{ key: DimensionKey; label: string }> = [
  { key: 'flow', label: 'Flow' },
  { key: 'balance', label: 'Balance' },
  { key: 'repeatQuality', label: 'Repeat Quality' },
  { key: 'svgHealth', label: 'SVG Health' },
  { key: 'motifDiversity', label: 'Motif Diversity' },
];

function scoreClass(value: number): string {
  if (value >= 80) return 'workbench-score--good';
  if (value >= 60) return 'workbench-score--ok';
  return 'workbench-score--low';
}

interface Props {
  qualityResult: DesignSpecQualityLoopResult | null;
  qualityRunning: boolean;
  onRunQualityLoop: () => void;
}

export function QualityPanel({ qualityResult, qualityRunning, onRunQualityLoop }: Props) {
  const report = qualityResult?.check.report ?? null;
  const recommendations = report ? buildQualityRecommendations(report) : [];

  return (
    <div className="workbench-quality-panel">
      <div className="trend-studio-actions">
        <button type="button" className="btn btn--primary" onClick={onRunQualityLoop} disabled={qualityRunning}>
          {qualityRunning ? '⏳ Checking…' : qualityResult ? '🎯 Re-run Quality Loop' : '🎯 Run Quality Loop'}
        </button>
      </div>

      {!qualityResult && !qualityRunning && (
        <p className="metadata-hint">Run the Quality Loop to score Composition, Hierarchy, Overlap, Negative Space, Rhythm, and Commercial Readiness for the current pattern.</p>
      )}

      {qualityResult && report && (
        <>
          <div className={`marketplace-ready-indicator marketplace-ready-indicator--${qualityResult.check.meetsTargets ? 'ready' : 'issues'}`}>
            {qualityResult.check.meetsTargets
              ? `✅ Meets quality targets (${qualityResult.roundsUsed}/${qualityResult.maxRounds} rounds)`
              : `⚠️ Did not meet targets after ${qualityResult.roundsUsed}/${qualityResult.maxRounds} rounds — showing the best-scoring round`}
          </div>

          <span className="workbench-inspector-field-title">Named Dimensions</span>
          <div className="workbench-quality-scores">
            {NAMED_DIMENSIONS.map(({ key, label }) => (
              <div key={key} className={`workbench-quality-score ${scoreClass(report[key])}`}>
                <span>{label}</span>
                <strong>{report[key]}</strong>
              </div>
            ))}
          </div>

          <details className="workbench-collapsible">
            <summary>Other real metrics</summary>
            <div className="workbench-quality-scores">
              {OTHER_DIMENSIONS.map(({ key, label }) => (
                <div key={key} className={`workbench-quality-score ${scoreClass(report[key])}`}>
                  <span>{label}</span>
                  <strong>{report[key]}</strong>
                </div>
              ))}
              <div className="workbench-quality-score">
                <span>Overall</span>
                <strong>{report.overall}</strong>
              </div>
            </div>
          </details>

          {qualityResult.check.shortfalls.length > 0 && (
            <div>
              <span className="workbench-inspector-field-title">Quality target shortfalls</span>
              <ul className="workbench-diff-list">
                {qualityResult.check.shortfalls.map((s) => (
                  <li key={s} className="workbench-diff-entry">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <span className="workbench-inspector-field-title">Recommendations</span>
            {recommendations.length === 0 && <p className="metadata-hint">✅ No weak dimensions — nothing to recommend.</p>}
            {recommendations.length > 0 && (
              <ul className="workbench-diff-list">
                {recommendations.map((r) => (
                  <li key={r} className="workbench-diff-entry">
                    💡 {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
