import { useMemo } from 'react';
import type { TileData } from '../engine/types';
import { computeQualityScore } from '../engine/qualityScore';
import { QUALITY_PRESET_LABELS, type QualityPresetId } from '../engine/scoring';

export interface CandidateSummary {
  total: number;
  valid: number;
  score: number;
  preset: QualityPresetId;
}

interface Props {
  tileData: TileData | null;
  candidateSummary?: CandidateSummary | null;
}

const ROWS: Array<{ key: keyof ReturnType<typeof computeQualityScore>; label: string }> = [
  { key: 'composition', label: 'Composition' },
  { key: 'spacing', label: 'Spacing' },
  { key: 'hierarchy', label: 'Hierarchy' },
  { key: 'colorBalance', label: 'Color balance' },
  { key: 'seamlessIntegrity', label: 'Seamless integrity' },
  { key: 'motifDiversity', label: 'Motif diversity' },
];

function scoreColor(v: number): string {
  if (v >= 80) return '#5fbf7f';
  if (v >= 55) return '#e0b84a';
  return '#e0715a';
}

/** Deterministic heuristic quality readout — computed straight from this
 * pattern's own generated geometry (engine/qualityScore.ts), not a
 * prediction, not machine learning, and not a claim about how the pattern
 * will actually perform on any stock site. */
export function QualityPanel({ tileData, candidateSummary }: Props) {
  const score = useMemo(() => (tileData ? computeQualityScore(tileData) : null), [tileData]);
  if (!tileData || !score) return null;

  return (
    <div className="quality-panel">
      <div className="metadata-header">
        <h3>📊 Quality Score</h3>
        <span className="metadata-hint">คำนวณจากโครงสร้างภาพจริง (heuristic ในเครื่อง ไม่ใช่ AI/prediction)</span>
      </div>
      {candidateSummary && (
        <div className="quality-candidate-summary">
          ✅ ลายนี้เลือกจาก {candidateSummary.total} candidate ที่สร้างจาก seed เดียวกัน (ผ่านเกณฑ์{' '}
          {candidateSummary.valid}, คัดออก {candidateSummary.total - candidateSummary.valid}) — คะแนนตามเกณฑ์{' '}
          <strong>{QUALITY_PRESET_LABELS[candidateSummary.preset]}</strong> {candidateSummary.score}/100 (คนละชุดเกณฑ์กับ
          Quality Score ด้านล่าง ซึ่งใช้ 6 มาตรวัดมาตรฐานเดิม)
        </div>
      )}
      <div className="quality-overall">
        <span className="quality-overall-num" style={{ color: scoreColor(score.overall) }}>
          {score.overall}
        </span>
        <span className="quality-overall-label">/ 100</span>
      </div>
      <div className="quality-rows">
        {ROWS.map((r) => (
          <div className="quality-row" key={r.key}>
            <span className="quality-row-label">{r.label}</span>
            <div className="quality-bar">
              <div className="quality-bar-fill" style={{ width: `${score[r.key]}%`, background: scoreColor(score[r.key]) }} />
            </div>
            <span className="quality-row-num">{score[r.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
