// AI-SBOS v3, Milestones 8-9 — Seamless-First Generation + Seamless
// Integrity Gate. Every v3 pattern already tiles seamlessly BY
// CONSTRUCTION (the shared engine's wrap-clone step, unchanged, is what
// every prior mission's own audit called "a structural guarantee") — this
// gate is the real, measured check for the actual per-edit defect class
// that construction alone does NOT prevent: an uneven density "dead
// cross" where all 4 repeat-neighbors meet at a tile's corners.
//
// Reuses `metrics.cornerContinuity` and `metrics.svgHealth` from the
// existing `computeMetrics()` — no new scoring engine. The `< 40`
// threshold is not invented here: it is the exact threshold the existing
// `cornerDeadZone` penalty rule already uses in
// `engine/scoring.ts`'s `PENALTY_RULES_V2` ("the tile-corner junction is
// noticeably empty or crowded when repeated").
//
// Note: `engine/wrapCohesion.ts`'s `computeWrapCohesion` (left/right,
// top/bottom, corner boolean continuity flags) was found during the
// architecture audit but is NOT currently wired into the live scoring
// pipeline anywhere in the app (`grep` found zero call sites outside its
// own file) and needs raw `Placement[]` data not exposed on `TileData` —
// wiring it in would mean touching shared production code for uncertain
// gain, so this gate deliberately does not depend on it. Left as a
// documented, real option for a future milestone if a more granular
// per-axis (not just per-corner) signal is needed.
import type { TileData } from '../engine/types';
import type { CompositionMetrics } from '../engine/scoring';
import { buildPreviewMarkup } from '../export/previewMarkup';

export const CORNER_DEAD_ZONE_THRESHOLD = 40; // matches engine/scoring.ts's own cornerDeadZone rule
export const SVG_HEALTH_MIN = 50;

export interface SeamlessIntegrityIssue {
  code: 'corner-dead-zone' | 'low-svg-health';
  detail: string;
}

export interface SeamlessIntegrityResult {
  status: 'SEAMLESS_PASS' | 'SEAMLESS_BLOCKED';
  issues: SeamlessIntegrityIssue[];
  cornerContinuity: number;
  svgHealth: number;
  tilePreviewMarkup1x1: string;
  repeatPreviewMarkup3x3: string;
}

export function runSeamlessIntegrityGate(tileData: TileData, metrics: CompositionMetrics, instanceId: string): SeamlessIntegrityResult {
  const issues: SeamlessIntegrityIssue[] = [];

  if (metrics.cornerContinuity < CORNER_DEAD_ZONE_THRESHOLD) {
    issues.push({
      code: 'corner-dead-zone',
      detail: `Corner continuity ${metrics.cornerContinuity} is below ${CORNER_DEAD_ZONE_THRESHOLD} — the tile-corner junction is noticeably empty or crowded when repeated.`,
    });
  }
  if (metrics.svgHealth < SVG_HEALTH_MIN) {
    issues.push({
      code: 'low-svg-health',
      detail: `SVG technical health ${metrics.svgHealth} is below ${SVG_HEALTH_MIN} — indicates malformed or degenerate geometry likely to cause visible repeat artifacts.`,
    });
  }

  return {
    status: issues.length === 0 ? 'SEAMLESS_PASS' : 'SEAMLESS_BLOCKED',
    issues,
    cornerContinuity: metrics.cornerContinuity,
    svgHealth: metrics.svgHealth,
    // Real 1x1 tile and a real 3x3 repeat, both built from the exact same
    // buildPreviewMarkup() the app's own PreviewCanvas uses — required by
    // Milestone 9 ("generate at least a 1x1 tile and a 3x3 repeat preview
    // for inspection").
    tilePreviewMarkup1x1: buildPreviewMarkup(tileData, 1, `${instanceId}-1x1`),
    repeatPreviewMarkup3x3: buildPreviewMarkup(tileData, 3, `${instanceId}-3x3`),
  };
}
