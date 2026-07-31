import { useMemo, useState } from 'react';
import type { MarketingData } from './MarketingIntelligenceView';
import { generateDailyMission } from '../../marketing/mission/dailyMissionGenerator';
import { putDailyMission, getMissionForDate } from '../../marketing/storage/dailyMissionStore';
import { transitionDailyMissionStatus, type DailyMission } from '../../marketing/domain/dailyMission';
import type { OpportunityStatus } from '../../marketing/domain/marketOpportunity';
import { EvidenceBadge, ConfidenceBadge, OfflineAnalysisBanner } from './evidenceDisplay';

interface Props {
  data: MarketingData;
  reload: () => Promise<void>;
  onViewScore: (opportunityId: string) => void;
}

const ACTIONS: Array<[OpportunityStatus, string]> = [
  ['SELECTED', 'Accept'],
  ['DESIGNING', 'Edit / Start Designing'],
  ['ARCHIVED', 'Postpone'],
];

/** Section 1 — Today's Market Mission dashboard. The mission itself is
 * never computed here: this component only calls
 * generateDailyMission(opportunities, snapshot) — the same function the
 * sample-data seeder and any future scheduler would call — and renders
 * whatever it returns (or null, honestly, if no opportunity exists yet). */
export function TodaysMissionTab({ data, reload, onViewScore }: Props) {
  const [busy, setBusy] = useState(false);
  const latestSnapshot = data.snapshots[0];
  const todaysExisting = data.missions.find((m) => {
    const day = new Date(m.date);
    const now = new Date();
    return day.toDateString() === now.toDateString();
  });

  const candidateMission = useMemo(() => {
    if (todaysExisting) return todaysExisting;
    if (!latestSnapshot) return null;
    return generateDailyMission(data.opportunities, latestSnapshot, { now: Date.now() });
  }, [data.opportunities, latestSnapshot, todaysExisting]);

  const opportunity = candidateMission ? data.opportunities.find((o) => o.id === candidateMission.opportunityId) : undefined;
  const alternatives = data.opportunities.filter((o) => o.id !== candidateMission?.opportunityId && o.snapshotId === latestSnapshot?.id);

  const handleGenerate = async () => {
    if (!candidateMission || todaysExisting) return;
    setBusy(true);
    try {
      await putDailyMission(candidateMission);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const handleTransition = async (status: OpportunityStatus) => {
    if (!candidateMission) return;
    setBusy(true);
    try {
      const existing = (await getMissionForDate(candidateMission.date)) ?? candidateMission;
      const updated: DailyMission = transitionDailyMissionStatus(existing, status);
      await putDailyMission(updated);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="marketing-tab todays-mission-tab">
      <OfflineAnalysisBanner freshnessLabel={data.offline.freshnessLabel} snapshotDateLabel={latestSnapshot ? new Date(latestSnapshot.createdAt).toISOString().slice(0, 10) : '—'} />

      {!candidateMission && <p>No opportunity is available yet to build today's mission from — visit Opportunity Explorer or Market Gap Finder first.</p>}

      {candidateMission && (
        <div className="mission-card">
          <h2>{candidateMission.theme}</h2>
          <dl className="mission-fields">
            <div><dt>Primary marketplace</dt><dd>{candidateMission.primaryMarketplace}</dd></div>
            <div><dt>Niche</dt><dd>{candidateMission.niche}</dd></div>
            <div><dt>Hero motif</dt><dd>{candidateMission.heroMotif}</dd></div>
            <div><dt>Secondary motifs</dt><dd>{candidateMission.secondaryMotifs.join(', ') || '—'}</dd></div>
            <div><dt>Color direction</dt><dd>{candidateMission.colorDirection.join(', ') || '—'}</dd></div>
            <div><dt>Product use cases</dt><dd>{candidateMission.productUseCases.join(', ') || '—'}</dd></div>
            <div><dt>Recommended output</dt><dd>{candidateMission.designCount} patterns × {candidateMission.colorwayCount} colorways</dd></div>
            <div><dt>Opportunity score</dt><dd>{candidateMission.opportunityScore}/100</dd></div>
          </dl>

          <div className="mission-badges">
            <ConfidenceBadge confidence={candidateMission.confidence} />
            <span className="freshness-badge">Evidence freshness: {candidateMission.evidenceFreshness}</span>
            <span className="mission-status-badge">Status: {candidateMission.status}</span>
          </div>

          {candidateMission.risks.length > 0 && (
            <div className="mission-risks">
              <strong>Risks</strong>
              <ul>
                {candidateMission.risks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </div>
          )}

          {opportunity && (
            <p className="mission-why">
              <strong>Why this was recommended:</strong> highest-scoring opportunity for the current snapshot ({opportunity.score.overall}/100,{' '}
              {opportunity.score.band}).{' '}
              <button type="button" className="link-btn" onClick={() => onViewScore(opportunity.id)}>
                View full score breakdown →
              </button>
            </p>
          )}

          {alternatives.length > 0 && (
            <div className="mission-alternatives">
              <strong>Why alternatives were not recommended</strong>
              <ul>
                {alternatives.map((alt) => (
                  <li key={alt.id}>
                    {alt.title} — {alt.score.overall}/100 ({alt.score.band}), lower than the selected opportunity's {opportunity?.score.overall}/100.
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mission-portfolio-impact">
            <strong>Portfolio impact:</strong> {candidateMission.designCount} new patterns targeting {candidateMission.niche} for{' '}
            {candidateMission.primaryMarketplace}, closing a portfolio gap the source opportunity's evidence identified.
          </p>

          <div className="mission-actions">
            {!todaysExisting && (
              <button type="button" className="btn btn--primary" onClick={() => void handleGenerate()} disabled={busy}>
                Save Today's Mission
              </button>
            )}
            {todaysExisting &&
              ACTIONS.map(([status, label]) => (
                <button key={status} type="button" className="btn" onClick={() => void handleTransition(status)} disabled={busy}>
                  {label}
                </button>
              ))}
            {todaysExisting && (
              <button type="button" className="btn btn--danger" onClick={() => void handleTransition('ARCHIVED')} disabled={busy}>
                Reject
              </button>
            )}
          </div>
          <EvidenceLineage missionId={candidateMission.opportunityId} opportunity={opportunity} />
        </div>
      )}
    </div>
  );
}

function EvidenceLineage({ opportunity }: { missionId: string; opportunity?: MarketingData['opportunities'][number] }) {
  if (!opportunity) return null;
  return (
    <div className="evidence-lineage">
      <strong>Evidence lineage</strong>
      <ul>
        {opportunity.evidenceRefs.map((ref) => (
          <li key={ref}>{ref}</li>
        ))}
      </ul>
      {opportunity.score.components
        .filter((c) => c.evidenceSource === 'SAMPLE_DATA')
        .slice(0, 1)
        .map((c) => (
          <EvidenceBadge key={c.dimension} status={c.evidenceSource!} />
        ))}
    </div>
  );
}
