import type { DesignSpecQualityReport } from '../trend/designSpecQuality';
import type { CompositionMetrics } from '../engine/scoring';

// Design Critic & Art Direction Engine (Phase 7) — Section 1 "Design
// Critic". The brief names 11 dimensions to evaluate (Composition,
// Hierarchy, Balance, Rhythm, Flow, Cluster Quality, Negative Space,
// Overlap, Repeat Quality, Motif Diversity, Commercial Readiness).
// 10 of these are already real, independently-measured fields on
// `trend/designSpecQuality.ts`'s `DesignSpecQualityReport` (built across
// SVG Intelligence Engine Phase 3 and Design Workbench Phase 6) — this
// module does not recompute them, only reads them. The one dimension
// missing from that report is **Cluster Quality**: `DesignSpecQualityReport`
// has no clusterQuality field, but the underlying tile metrics already
// compute one (`CompositionMetrics.clusterCohesion`, Project Phoenix V2's
// real hero-to-support-proximity measurement) — this module is the first
// place that surfaces it at the Design Spec critique level.

export interface DesignCritique {
  composition: number;
  hierarchy: number;
  balance: number;
  rhythm: number;
  flow: number;
  clusterQuality: number;
  negativeSpace: number;
  overlap: number;
  repeatQuality: number;
  motifDiversity: number;
  commercialReadiness: number;
  overall: number;
}

/** Builds the Section 1 critique from the real, already-computed quality
 * report + the real per-tile metrics — a 1:1 read for 10 dimensions, plus
 * `clusterQuality` newly sourced from `metrics.clusterCohesion`. No score
 * here is recomputed or approximated; every number traces back to a real
 * measurement built in an earlier phase. */
export function buildDesignCritique(report: DesignSpecQualityReport, metrics: CompositionMetrics): DesignCritique {
  return {
    composition: report.composition,
    hierarchy: report.hierarchy,
    balance: report.balance,
    rhythm: report.rhythm,
    flow: report.flow,
    clusterQuality: metrics.clusterCohesion,
    negativeSpace: report.negativeSpace,
    overlap: report.overlap,
    repeatQuality: report.repeatQuality,
    motifDiversity: report.motifDiversity,
    commercialReadiness: report.commercialReadiness,
    overall: report.overall,
  };
}

/** Every named critique dimension paired with its display label, in the
 * brief's own Section 1 order — the single source of truth other critic
 * modules and the UI panel iterate over instead of hand-listing keys. */
export const DESIGN_CRITIQUE_DIMENSIONS: Array<{ key: keyof Omit<DesignCritique, 'overall'>; label: string }> = [
  { key: 'composition', label: 'Composition' },
  { key: 'hierarchy', label: 'Hierarchy' },
  { key: 'balance', label: 'Balance' },
  { key: 'rhythm', label: 'Rhythm' },
  { key: 'flow', label: 'Flow' },
  { key: 'clusterQuality', label: 'Cluster Quality' },
  { key: 'negativeSpace', label: 'Negative Space' },
  { key: 'overlap', label: 'Overlap' },
  { key: 'repeatQuality', label: 'Repeat Quality' },
  { key: 'motifDiversity', label: 'Motif Diversity' },
  { key: 'commercialReadiness', label: 'Commercial Readiness' },
];
