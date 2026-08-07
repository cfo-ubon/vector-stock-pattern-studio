import type { DesignEvaluation } from '../../design/designEvaluation';
import type { CommercialReadinessReport } from '../../commercial/domain/types';
import { hasSeamBreakRisk } from '../../design/patternSafety';

interface Props {
  evaluation: DesignEvaluation | null;
  evaluating: boolean;
  /** The ORIGINAL asset's real, already-computed Commercial Readiness —
   * not recomputed per keystroke (SEO/collection/submission state isn't
   * available mid-edit; it's re-checked for real after Approve). */
  originalReadiness: CommercialReadinessReport | null;
}

function scoreClass(score: number): string {
  if (score >= 80) return 'design-inspector-score--good';
  if (score >= 55) return 'design-inspector-score--warn';
  return 'design-inspector-score--bad';
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="design-inspector-row">
      <span className="design-inspector-label">{label}</span>
      <span className={`design-inspector-score ${scoreClass(value)}`}>{Math.round(value)}</span>
    </div>
  );
}

/** Design Refinement Studio Pro, Mission 2 — Floating Design Inspector.
 * Every number here comes straight from `design/designEvaluation.ts`'s
 * already-real engines (`computeMetrics`, `computePatternBeautyScore`,
 * `detectProblems`, `detectVisualIssues`) or from the asset's own
 * already-computed Commercial Readiness report — nothing is invented at
 * this layer. Updates live because the caller re-runs `evaluateDesign`
 * on every param change and passes the fresh result down. */
export function DesignInspectorPanel({ evaluation, evaluating, originalReadiness }: Props) {
  return (
    <aside className="design-inspector" aria-label="Design Inspector">
      <h3>🔍 Design Inspector</h3>
      {evaluating && <p className="metadata-hint">กำลังคำนวณคะแนน…</p>}
      {!evaluation && !evaluating && <p className="metadata-hint">ยังไม่มีข้อมูล</p>}

      {evaluation && (
        <>
          <section>
            <h4>Quality Score</h4>
            <ScoreRow label="Overall (Quality Score)" value={evaluation.beauty.overall} />
            <ScoreRow label="Hierarchy" value={evaluation.beauty.hierarchy} />
            <ScoreRow label="Composition" value={evaluation.beauty.composition} />
            <ScoreRow label="Flow" value={evaluation.beauty.flow} />
            <ScoreRow label="Rhythm / Density" value={evaluation.beauty.rhythm} />
            <ScoreRow label="Negative Space" value={evaluation.beauty.negativeSpace} />
            <ScoreRow label="Cluster Quality" value={evaluation.beauty.clusterQuality} />
            <ScoreRow label="Commercial Look" value={evaluation.beauty.commercialLook} />
            <ScoreRow label="Repeat Quality (seamless safety)" value={evaluation.beauty.repeatQuality} />
          </section>

          <section>
            <h4>Real-Time Metrics</h4>
            <ScoreRow label="Hero Balance" value={evaluation.metrics.heroSeparation} />
            <ScoreRow label="Color Harmony" value={evaluation.metrics.colorBalance} />
            <ScoreRow label="Contrast" value={evaluation.metrics.paletteContrast} />
            <ScoreRow label="Overlap Quality" value={evaluation.metrics.overlapQuality} />
            <ScoreRow label="SVG Health" value={evaluation.metrics.svgHealth} />
          </section>

          <section>
            <h4>🧵 Pattern Safety</h4>
            <p className="metadata-hint">การต่อลายแบบไร้รอยต่อ (seamless wrap) รับประกันโดยตัวสร้างลายเองเสมอ — ไม่ใช่สิ่งที่แก้พารามิเตอร์แล้วพังได้</p>
            <ScoreRow label="Corner Continuity (จุดที่ 4 มุม tile มาบรรจบกัน)" value={evaluation.metrics.cornerContinuity} />
            {hasSeamBreakRisk(evaluation) ? (
              <p className="portfolio-error-text" role="alert">
                ⚠ มุม tile 4 มุมโปร่ง/แน่นผิดปกติเมื่อเทียบกับส่วนอื่น — เวลาต่อลายซ้ำอาจเห็นเป็นรอยกากบาทว่างที่จุดต่อ ลองดูตัวอย่างที่ 3×3/4×4 ในพรีวิว หรือเปิด "แสดงเส้นขอบ Tile"
              </p>
            ) : (
              <p className="metadata-hint">✅ ไม่พบความเสี่ยงรอยต่อที่มุม tile ในตอนนี้</p>
            )}
          </section>

          {evaluation.problems.length > 0 && (
            <section>
              <h4>Detected Problems ({evaluation.problems.length})</h4>
              <ul className="design-inspector-list">
                {evaluation.problems.map((p) => (
                  <li key={p.id} className={`design-inspector-issue design-inspector-issue--${p.severity}`}>
                    {p.label}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {evaluation.issues.some((i) => i.detected) && (
            <section>
              <h4>Visual Issues</h4>
              <ul className="design-inspector-list">
                {evaluation.issues
                  .filter((i) => i.detected)
                  .map((i) => (
                    <li key={i.id} className="design-inspector-issue design-inspector-issue--warn" title={i.evidence}>
                      {i.label}
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section>
        <h4>Commercial Readiness (persisted)</h4>
        {originalReadiness ? (
          <>
            <ScoreRow label={`${originalReadiness.band}`} value={originalReadiness.score} />
            <ul className="design-inspector-list">
              {originalReadiness.checks
                .filter((c) => c.status !== 'PASS')
                .map((c) => (
                  <li key={c.id} className={`design-inspector-issue design-inspector-issue--${c.status === 'FAIL' ? 'high' : 'warn'}`}>
                    {c.label}: {c.detail}
                  </li>
                ))}
            </ul>
            <p className="metadata-hint">คำนวณจากเวอร์ชันที่บันทึกล่าสุด — จะอัปเดตจริงหลัง Approve เท่านั้น</p>
          </>
        ) : (
          <p className="metadata-hint">ยังไม่มีข้อมูล Commercial Readiness สำหรับชิ้นงานนี้</p>
        )}
      </section>
    </aside>
  );
}
