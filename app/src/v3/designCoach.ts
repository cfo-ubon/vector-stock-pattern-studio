// AI-SBOS v3, Milestone 12 — AI Design Coach. Zero new evidence engine:
// wraps the exact same `detectProblems()`/`detectVisualIssues()` the
// shared Design Refinement (Design Edit Mode) already uses, formatted as
// short, concrete recommendations pointing at a real, adjustable v3
// control. No new AI authority is created here.
import type { TileData } from '../engine/types';
import { computeMetrics, type CompositionMetrics } from '../engine/scoring';
import { detectProblems } from '../critic/problems';
import { detectVisualIssues } from '../critic/visualAnalysis';

export interface CoachRecommendation {
  id: string;
  message: string;
  /** Which real v3 refinement control this recommendation points at. */
  control: 'density' | 'negativeSpace' | 'motifSize' | 'rotationJitter' | 'palette' | 'none';
}

const VISUAL_ISSUE_ADVICE: Partial<Record<string, CoachRecommendation>> = {
  crowdedAreas: { id: 'crowdedAreas', message: 'Reduce density — some areas read as overcrowded.', control: 'density' },
  deadSpace: { id: 'deadSpace', message: 'Increase density or reduce negative space — some areas read as empty.', control: 'density' },
  mechanicalSpacing: { id: 'mechanicalSpacing', message: 'Increase motif diversity — spacing currently reads as mechanical/repetitive.', control: 'motifSize' },
  gridAppearance: { id: 'gridAppearance', message: 'Increase rotation variation — the layout currently reads as a visible grid.', control: 'rotationJitter' },
  lowHeroVisibility: { id: 'lowHeroVisibility', message: 'Strengthen hierarchy — the hero motif is not standing out enough.', control: 'motifSize' },
  weakHierarchy: { id: 'weakHierarchy', message: 'Strengthen hierarchy — motif sizes are too uniform.', control: 'motifSize' },
  lowDetail: { id: 'lowDetail', message: 'Improve thumbnail readability — detail may be too fine to read at small sizes.', control: 'motifSize' },
  weakFlow: { id: 'weakFlow', message: 'Increase negative space — the composition currently reads as visually disconnected.', control: 'negativeSpace' },
};

/** Deterministic advice derived only from real, already-computed evidence
 * — never a fabricated or generic tip. Capped at 4 so the coach stays
 * concise (Milestone 12: "concise recommendations"). */
export function getDesignCoachRecommendations(tileData: TileData, metrics?: CompositionMetrics): CoachRecommendation[] {
  const m = metrics ?? computeMetrics(tileData);
  const recommendations: CoachRecommendation[] = [];

  const visualIssues = detectVisualIssues(tileData, m);
  for (const issue of visualIssues) {
    if (!issue.detected) continue;
    const advice = VISUAL_ISSUE_ADVICE[issue.id];
    if (advice && !recommendations.some((r) => r.id === advice.id)) recommendations.push(advice);
  }

  const problems = detectProblems(m);
  if (problems.some((p) => p.id === 'cornerDeadZone') && !recommendations.some((r) => r.control === 'density')) {
    recommendations.push({ id: 'cornerDeadZone', message: 'Adjust density slightly — the tile-corner junction is uneven when repeated.', control: 'density' });
  }

  if (recommendations.length === 0) {
    recommendations.push({ id: 'none', message: 'No significant issues detected — this concept measures well against the existing quality checks.', control: 'none' });
  }

  return recommendations.slice(0, 4);
}
