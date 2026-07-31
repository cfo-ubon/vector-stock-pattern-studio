import type { EvidenceStatus, EvidenceBand } from '../../marketing/domain/evidence';

// Build 028 Phase 4 — shared, small presentational helpers used by every
// Marketing Intelligence Center panel. Kept framework-free (plain
// functions + tiny components, no state) so every tab renders evidence
// provenance/confidence/freshness the exact same way — the brief's
// non-negotiable rule is that SAMPLE_DATA must never look like real
// research, so this is the ONE place that decides what each
// EvidenceStatus renders as, and every panel must go through it rather
// than rolling its own label.

const EVIDENCE_LABELS: Record<EvidenceStatus, string> = {
  VERIFIED_SOURCE: 'Verified Source',
  USER_IMPORTED: 'User Imported',
  USER_OBSERVATION: 'User Observation',
  LOCAL_SALES_DATA: 'Local Sales Data',
  LOCAL_PORTFOLIO_DATA: 'Local Portfolio Data',
  AI_INFERENCE: 'AI Inference',
  SAMPLE_DATA: 'SAMPLE DATA',
};

export function evidenceLabel(status: EvidenceStatus): string {
  return EVIDENCE_LABELS[status];
}

export function EvidenceBadge({ status }: { status: EvidenceStatus }) {
  const className = status === 'SAMPLE_DATA' ? 'evidence-badge evidence-badge--sample' : `evidence-badge evidence-badge--${status.toLowerCase().replace(/_/g, '-')}`;
  return (
    <span className={className} role="status">
      {status === 'SAMPLE_DATA' ? '⚠ SAMPLE DATA' : evidenceLabel(status)}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: EvidenceBand }) {
  return <span className={`confidence-badge confidence-badge--${confidence}`}>Confidence: {confidence.replace('-', ' ')}</span>;
}

export function BandBadge({ label, band }: { label: string; band: EvidenceBand }) {
  return (
    <span className={`band-badge band-badge--${band}`}>
      {label}: {band.replace('-', ' ')}
    </span>
  );
}

/** The brief's exact required freshness/offline banner. `snapshotCreatedAt`
 * null means no snapshot exists at all (a distinct, honestly-labeled
 * state from "snapshot exists but is stale"). */
export function OfflineAnalysisBanner({ freshnessLabel, snapshotDateLabel }: { freshnessLabel: string; snapshotDateLabel: string }) {
  return (
    <div className="offline-analysis-banner" role="note">
      <strong>OFFLINE ANALYSIS</strong>
      <span>Snapshot date: {snapshotDateLabel}</span>
      <span>Freshness: {freshnessLabel}</span>
    </div>
  );
}

export function NoDataBanner({ message }: { message: string }) {
  return (
    <div className="no-data-banner" role="note">
      {message}
    </div>
  );
}
