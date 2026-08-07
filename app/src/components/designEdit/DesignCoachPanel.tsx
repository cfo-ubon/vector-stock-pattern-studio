import { buildDesignCoachAdvice } from '../../design/designCoach';
import type { DesignEvaluation } from '../../design/designEvaluation';
import type { CommercialReadinessReport } from '../../commercial/domain/types';

interface Props {
  evaluation: DesignEvaluation | null;
  originalReadiness: CommercialReadinessReport | null;
}

/** Design Refinement Studio Pro, Mission 2 — AI Design Coach. Renders
 * `design/designCoach.ts`'s deterministic advice list — every item traces
 * back to a real detected problem/issue or a real persisted Commercial
 * Readiness check, nothing invented at this layer either. */
export function DesignCoachPanel({ evaluation, originalReadiness }: Props) {
  const advice = evaluation ? buildDesignCoachAdvice(evaluation, originalReadiness) : [];

  return (
    <aside className="design-inspector" aria-label="AI Design Coach">
      <h3>🤖 AI Design Coach</h3>
      {!evaluation && <p className="metadata-hint">ยังไม่มีข้อมูล</p>}
      {evaluation && advice.length === 0 && <p className="metadata-hint">ไม่พบข้อควรปรับปรุงในตอนนี้ — ลายนี้ผ่านทุกเกณฑ์ที่ตรวจอัตโนมัติได้</p>}
      {advice.length > 0 && (
        <ul className="design-inspector-list">
          {advice.map((a) => (
            <li key={a.id} className={`design-inspector-issue design-inspector-issue--${a.severity}`}>
              <div>{a.message}</div>
              <div className="design-coach-suggestion">→ {a.suggestion}</div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
