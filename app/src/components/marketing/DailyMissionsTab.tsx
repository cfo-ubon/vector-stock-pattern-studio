import { useMemo, useState } from 'react';
import type { MarketingData } from './MarketingIntelligenceView';
import type { OpportunityStatus, MarketOpportunity } from '../../marketing/domain/marketOpportunity';
import { transitionDailyMissionStatus, type DailyMission } from '../../marketing/domain/dailyMission';
import { putDailyMission } from '../../marketing/storage/dailyMissionStore';
import { ConfidenceBadge } from './evidenceDisplay';

interface Props {
  data: MarketingData;
  reload: () => Promise<void>;
  /** Build 028C — "ส่งให้นักออกแบบ / Send to Creative Director", sourced
   * from a real, already-persisted Daily Mission plus its underlying
   * Market Opportunity. */
  onSendToCreativeDirector: (opportunity: MarketOpportunity, mission: DailyMission) => void;
}

const QUICK_ACTIONS: Array<[OpportunityStatus, string]> = [
  ['SELECTED', 'Accept'],
  ['DESIGNING', 'Edit'],
  ['ARCHIVED', 'Postpone'],
  ['SUBMITTED', 'Complete'],
];

/** Section 10 — Daily Production Plan / mission history. Every mission
 * listed is a real, previously-saved DailyMission record; status
 * transitions go through transitionDailyMissionStatus (a plain, auditable
 * status change, not a rewritten history). */
export function DailyMissionsTab({ data, reload, onSendToCreativeDirector }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = useMemo(() => [...data.missions].sort((a, b) => b.date - a.date), [data.missions]);

  const handleTransition = async (missionId: string, status: OpportunityStatus) => {
    const mission = data.missions.find((m) => m.id === missionId);
    if (!mission) return;
    setBusyId(missionId);
    try {
      await putDailyMission(transitionDailyMissionStatus(mission, status));
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (missionId: string) => {
    await handleTransition(missionId, 'ARCHIVED');
  };

  return (
    <div className="marketing-tab daily-missions-tab">
      {sorted.length === 0 && <p>No daily missions generated yet — visit Today's Mission to create one.</p>}

      <ul className="daily-mission-history-list">
        {sorted.map((mission) => (
          <li key={mission.id} className="daily-mission-history-item">
            <div className="daily-mission-history-summary">
              <strong>{mission.theme}</strong>
              <span>{new Date(mission.date).toISOString().slice(0, 10)}</span>
              <span>
                {mission.primaryMarketplace} · {mission.niche}
              </span>
              <span>
                Score: {mission.opportunityScore}/100 <ConfidenceBadge confidence={mission.confidence} />
              </span>
              <span>Status: {mission.status}</span>
            </div>
            {mission.risks.length > 0 && (
              <ul className="daily-mission-history-risks">
                {mission.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            <div className="daily-mission-history-actions">
              {QUICK_ACTIONS.map(([status, label]) => (
                <button
                  key={status}
                  type="button"
                  className="btn"
                  disabled={busyId === mission.id || mission.status === status}
                  onClick={() => void handleTransition(mission.id, status)}
                >
                  {label}
                </button>
              ))}
              <button type="button" className="btn btn--danger" disabled={busyId === mission.id} onClick={() => void handleReject(mission.id)}>
                Reject
              </button>
              {(() => {
                const opportunity = data.opportunities.find((o) => o.id === mission.opportunityId);
                return opportunity ? (
                  <button type="button" className="btn" onClick={() => onSendToCreativeDirector(opportunity, mission)}>
                    ส่งให้นักออกแบบ (Send to Creative Director)
                  </button>
                ) : null;
              })()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
