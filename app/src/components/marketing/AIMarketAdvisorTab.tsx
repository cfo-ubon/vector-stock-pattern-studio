import type { MarketingData } from './MarketingIntelligenceView';
import { findMarketGaps } from '../../marketing/gap/marketGapFinder';
import { ConfidenceBadge, OfflineAnalysisBanner } from './evidenceDisplay';

interface Props {
  data: MarketingData;
  onViewScore: (opportunityId: string) => void;
}

/** The "AI Market Advisor" overview — combines the real outputs of the
 * scoring engine and the gap finder into one advisory summary. This
 * component performs no scoring/gap logic of its own; it only sorts and
 * filters already-computed MarketOpportunity/MarketGap records. */
export function AIMarketAdvisorTab({ data, onViewScore }: Props) {
  const latestSnapshot = data.snapshots[0];
  const topOpportunities = [...data.opportunities].sort((a, b) => b.score.overall - a.score.overall).slice(0, 3);
  const gaps = findMarketGaps(data.keywords).slice(0, 3);

  return (
    <div className="marketing-tab advisor-tab">
      <OfflineAnalysisBanner
        freshnessLabel={data.offline.freshnessLabel}
        snapshotDateLabel={latestSnapshot ? new Date(latestSnapshot.createdAt).toISOString().slice(0, 10) : '—'}
      />
      <p className="advisor-intro">
        Based on {data.snapshots.length} snapshot(s), {data.observations.length} observation(s), and {data.keywords.length} tracked keyword(s), here is
        what the Marketing Intelligence Center recommends focusing on today.
      </p>

      <section>
        <h2>Top Opportunities</h2>
        {topOpportunities.length === 0 && <p>No opportunities scored yet.</p>}
        <ul className="advisor-opportunity-list">
          {topOpportunities.map((opportunity) => (
            <li key={opportunity.id}>
              <strong>{opportunity.title}</strong> — {opportunity.score.overall}/100 ({opportunity.score.band}){' '}
              <ConfidenceBadge confidence={opportunity.score.confidence} />
              <button type="button" className="link-btn" onClick={() => onViewScore(opportunity.id)}>
                Explain →
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Top Market Gaps</h2>
        {gaps.length === 0 && <p>No portfolio gaps identified from current keyword evidence.</p>}
        <ul className="advisor-gap-list">
          {gaps.map((gap) => (
            <li key={gap.keyword}>
              <strong>{gap.gapTitle}</strong>
              <p>{gap.explanation}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Mission Status</h2>
        <p>
          {data.missions.length} mission(s) generated so far.{' '}
          {data.missions.filter((m) => m.status === 'SUBMITTED').length} submitted,{' '}
          {data.missions.filter((m) => m.status === 'ARCHIVED').length} archived/rejected.
        </p>
      </section>
    </div>
  );
}
