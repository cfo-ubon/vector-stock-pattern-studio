import type { MarketingData } from './MarketingIntelligenceView';
import { ScoreBreakdownPanel } from './ScoreBreakdownPanel';

interface Props {
  data: MarketingData;
  selectedOpportunityId: string | null;
  onSelectOpportunity: (id: string) => void;
}

/** Section 9 — Commercial Score Details. A picker over real
 * MarketOpportunity records plus the shared ScoreBreakdownPanel; no scoring
 * math happens in this file. */
export function CommercialScoreDetailsTab({ data, selectedOpportunityId, onSelectOpportunity }: Props) {
  const selected = data.opportunities.find((o) => o.id === selectedOpportunityId) ?? data.opportunities[0];

  return (
    <div className="marketing-tab score-details-tab">
      {data.opportunities.length === 0 && <p>No scored opportunities yet.</p>}

      {data.opportunities.length > 0 && (
        <>
          <label className="score-details-picker">
            Opportunity:{' '}
            <select value={selected?.id ?? ''} onChange={(e) => onSelectOpportunity(e.target.value)}>
              {data.opportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title} — {o.score.overall}/100
                </option>
              ))}
            </select>
          </label>

          {selected && (
            <>
              <h2>{selected.title}</h2>
              <p>
                {selected.theme} · {selected.niche} · {selected.marketplace}
              </p>
              <ScoreBreakdownPanel score={selected.score} />
              <p className="score-details-profile">Scoring profile: {selected.score.scoringProfileId}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
