import { useMemo, useState } from 'react';
import type { DesignSpecification } from '../../trend/designSpecTypes';
import type { DesignSpecQualityLoopResult } from '../../trend/designSpecQuality';
import type { Project } from '../../project/projectTypes';
import { buildDesignReport, type DesignReport } from '../../critic/designReport';
import { checkQualityGate } from '../../critic/qualityGate';
import { runImprovementLoop, type ImprovementLoopResult } from '../../critic/improvementLoop';
import { critiqueCollection } from '../../critic/collectionCritic';
import { STYLE_COACH_CATEGORIES, detectStyleCoachCategory, type StyleCoachCategory } from '../../critic/styleCoach';
import { DESIGN_CRITIQUE_DIMENSIONS } from '../../critic/designCritique';

// Design Critic & Art Direction Engine (Phase 7) — the UI surface for
// `critic/*`. This component contains no design-evaluation logic of its
// own: every score, issue, problem, recommendation, and style-coach note
// below is read directly from a `DesignReport` (`critic/designReport.ts`)
// built from the same `qualityResult` the Quality Panel (Design Workbench
// Phase 6) already computes — reused here, never recomputed independently,
// so the two panels can never disagree about the same tile. "Apply" only
// ever forwards an already-real `specPatch` to `onUpdateSpec`; it never
// invents a new field value itself.

function scoreClass(value: number): string {
  if (value >= 80) return 'workbench-score--good';
  if (value >= 60) return 'workbench-score--ok';
  return 'workbench-score--low';
}

interface Props {
  spec: DesignSpecification;
  seed: string;
  qualityResult: DesignSpecQualityLoopResult | null;
  qualityRunning: boolean;
  onRunQualityLoop: () => void;
  onUpdateSpec: (next: DesignSpecification) => void;
  activeProject: Project | null;
}

export function DesignCriticPanel({ spec, seed, qualityResult, qualityRunning, onRunQualityLoop, onUpdateSpec, activeProject }: Props) {
  const [styleCoachCategory, setStyleCoachCategory] = useState<StyleCoachCategory | ''>('');
  const [loopResult, setLoopResult] = useState<ImprovementLoopResult | null>(null);
  const [loopRunning, setLoopRunning] = useState(false);

  const resolvedCategory = styleCoachCategory || detectStyleCoachCategory(spec) || undefined;

  const report: DesignReport | null = useMemo(() => {
    if (!qualityResult) return null;
    return buildDesignReport(
      spec,
      qualityResult.pool.winner.tileData,
      qualityResult.pool.winner.metrics,
      qualityResult.check.report,
      qualityResult.check.meetsTargets,
      resolvedCategory,
    );
  }, [spec, qualityResult, resolvedCategory]);

  const gate = report ? checkQualityGate(report) : null;

  const latestCollection = activeProject && activeProject.collections.length > 0 ? activeProject.collections[0].collection : null;
  const collectionCritique = useMemo(() => (latestCollection ? critiqueCollection(latestCollection) : null), [latestCollection]);

  function handleRunImprovementLoop() {
    setLoopRunning(true);
    setTimeout(() => {
      setLoopResult(runImprovementLoop(spec, seed, 3, resolvedCategory));
      setLoopRunning(false);
    }, 0);
  }

  function handleApplyPatch(patch: Partial<DesignSpecification>) {
    onUpdateSpec({ ...spec, ...patch });
  }

  return (
    <div className="workbench-critic-panel">
      <div className="trend-studio-actions">
        <button type="button" className="btn btn--primary" onClick={onRunQualityLoop} disabled={qualityRunning}>
          {qualityRunning ? '⏳ Checking…' : qualityResult ? '🎯 Re-run Quality Loop' : '🎯 Run Quality Loop'}
        </button>
      </div>

      {!report && !qualityRunning && <p className="metadata-hint">Run the Quality Loop to generate a Design Report — Critique, Visual Analysis, Problems, and Recommendations, all evaluated from the same real tile.</p>}

      {report && gate && (
        <>
          <div className={`marketplace-ready-indicator marketplace-ready-indicator--${gate.passed ? 'ready' : 'issues'}`}>
            {gate.passed ? '✅ Passes the commercial quality gate' : `🚧 ${gate.message}`}
          </div>

          <details open className="workbench-collapsible">
            <summary>📐 Design Critique — {report.critique.overall}/100</summary>
            <div className="workbench-quality-scores">
              {DESIGN_CRITIQUE_DIMENSIONS.map(({ key, label }) => (
                <div key={key} className={`workbench-quality-score ${scoreClass(report.critique[key])}`}>
                  <span>{label}</span>
                  <strong>{report.critique[key]}</strong>
                </div>
              ))}
            </div>
          </details>

          <details className="workbench-collapsible">
            <summary>💰 Commercial Validation — {report.commercialValidation.commercialScore}/100</summary>
            <div className="workbench-quality-scores">
              {(
                [
                  ['commercialScore', 'Commercial Score'],
                  ['commercialReadiness', 'Commercial Readiness'],
                  ['premiumFeeling', 'Premium Feeling'],
                  ['luxuryFeeling', 'Luxury Feeling'],
                  ['editorialFeeling', 'Editorial Feeling'],
                  ['wallpaperScore', 'Wallpaper Score'],
                  ['fabricScore', 'Fabric Score'],
                  ['giftWrapScore', 'Gift Wrap Score'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className={`workbench-quality-score ${scoreClass(report.commercialValidation[key])}`}>
                  <span>{label}</span>
                  <strong>{report.commercialValidation[key]}</strong>
                </div>
              ))}
            </div>
          </details>

          <details className="workbench-collapsible">
            <summary>🔍 Pattern Readability {report.readability.readableAtAllScales ? '— ✅ readable at every scale' : '— ⚠️ weak at one or more scales'}</summary>
            <div className="workbench-quality-scores">
              {(
                [
                  ['thumbnail200', 'Thumbnail (200px)'],
                  ['thumbnail400', 'Preview (400px)'],
                  ['zoom800', 'Zoom (800%)'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className={`workbench-quality-score ${scoreClass(report.readability[key])}`}>
                  <span>{label}</span>
                  <strong>{report.readability[key]}</strong>
                </div>
              ))}
            </div>
          </details>

          <details className="workbench-collapsible">
            <summary>👁 Visual Analysis {report.visualIssues.some((i) => i.detected) ? `(${report.visualIssues.filter((i) => i.detected).length} detected)` : '(clean)'}</summary>
            <ul className="workbench-diff-list">
              {report.visualIssues.map((issue) => (
                <li key={issue.id} className={`workbench-diff-entry${issue.detected ? ' workbench-critic-issue--detected' : ''}`}>
                  {issue.detected ? '⚠️' : '✅'} <strong>{issue.label}</strong> — {issue.evidence}
                </li>
              ))}
            </ul>
          </details>

          <details className="workbench-collapsible">
            <summary>🛑 Problems ({report.problems.length})</summary>
            {report.problems.length === 0 && <p className="metadata-hint">No named penalty rules triggered.</p>}
            <ul className="workbench-diff-list">
              {report.problems.map((p) => (
                <li key={p.id} className="workbench-diff-entry">
                  <span className={`workbench-critic-severity workbench-critic-severity--${p.severity}`}>{p.severity}</span> {p.label} (-{p.points})
                </li>
              ))}
            </ul>
          </details>

          <details open className="workbench-collapsible">
            <summary>🖌 Recommendations ({report.recommendations.length})</summary>
            {report.recommendations.length === 0 && <p className="metadata-hint">Nothing to recommend — every visual analysis check is clean.</p>}
            <ul className="workbench-favorites-list">
              {report.priorityOrder.map((id) => {
                const rec = report.recommendations.find((r) => r.id === id)!;
                const improvement = report.expectedImprovements.find((e) => e.recommendationId === id);
                return (
                  <li key={id} className="workbench-critic-recommendation">
                    <div>
                      <span className={`workbench-critic-severity workbench-critic-severity--${rec.priority}`}>{rec.priority}</span> <strong>{rec.label}</strong>
                      <p className="metadata-hint">{rec.rationale}</p>
                      {improvement && <p className="metadata-hint">{improvement.note}</p>}
                    </div>
                    {rec.specPatch ? (
                      <button type="button" className="btn" onClick={() => handleApplyPatch(rec.specPatch!)}>
                        Apply
                      </button>
                    ) : (
                      <span className="metadata-hint">Advisory only</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>

          <details className="workbench-collapsible">
            <summary>🎨 Style Coach</summary>
            <select value={styleCoachCategory} onChange={(e) => setStyleCoachCategory(e.target.value as StyleCoachCategory | '')} aria-label="Style Coach category">
              <option value="">— auto-detect from Style DNA —</option>
              {STYLE_COACH_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
            {report.styleCoachNotes.length === 0 && <p className="metadata-hint">No style-coach notes — either no category matched, or the spec already sits close to that style's real preferred fields.</p>}
            <ul className="workbench-diff-list">
              {report.styleCoachNotes.map((note, i) => (
                <li key={i} className="workbench-diff-entry">
                  {note.message}
                </li>
              ))}
            </ul>
          </details>

          <details className="workbench-collapsible">
            <summary>🔁 Improvement Loop</summary>
            <p className="metadata-hint">Evaluate → Recommend → Update Design Specification → Re-generate → Evaluate Again, up to 3 rounds — automatically applies the top-priority recommendation that has a real spec patch each round.</p>
            <button type="button" className="btn btn--primary" onClick={handleRunImprovementLoop} disabled={loopRunning}>
              {loopRunning ? '⏳ Running…' : '▶ Run Improvement Loop'}
            </button>
            {loopResult && (
              <div className="trend-studio-quality-report">
                <p className="metadata-hint">
                  {loopResult.roundsUsed}/{loopResult.maxRounds} round(s) — overall {loopResult.rounds[0].report.critique.overall} → {loopResult.finalReport.critique.overall} —{' '}
                  {loopResult.improved ? '✅ improved' : 'no improvement found'}
                </p>
                <button type="button" className="btn" onClick={() => onUpdateSpec(loopResult.finalSpec)}>
                  Apply Final Spec
                </button>
              </div>
            )}
          </details>
        </>
      )}

      <details className="workbench-collapsible">
        <summary>🏭 Collection Critic {collectionCritique ? `— ${collectionCritique.overall}/100` : ''}</summary>
        {!collectionCritique && <p className="metadata-hint">Generate a Collection into this Project to see cross-asset consistency here.</p>}
        {collectionCritique && (
          <>
            <div className="workbench-quality-scores">
              {(
                [
                  ['palette', 'Palette'],
                  ['motifs', 'Motifs'],
                  ['layouts', 'Layouts'],
                  ['visualIdentity', 'Visual Identity'],
                  ['variation', 'Variation'],
                  ['commercialReadiness', 'Commercial Readiness'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className={`workbench-quality-score ${scoreClass(collectionCritique[key])}`}>
                  <span>{label}</span>
                  <strong>{collectionCritique[key]}</strong>
                </div>
              ))}
            </div>
            {collectionCritique.issues.length > 0 && (
              <ul className="workbench-diff-list">
                {collectionCritique.issues.map((issue, i) => (
                  <li key={i} className="workbench-diff-entry">
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </details>
    </div>
  );
}
