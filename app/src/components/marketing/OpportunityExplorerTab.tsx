import { useMemo, useState } from 'react';
import type { MarketingData } from './MarketingIntelligenceView';
import type { MarketOpportunity, OpportunityStatus } from '../../marketing/domain/marketOpportunity';
import { OPPORTUNITY_STATUS_VALUES } from '../../marketing/domain/marketOpportunity';
import { putMarketOpportunity } from '../../marketing/storage/marketOpportunityStore';
import { ConfidenceBadge } from './evidenceDisplay';

interface Props {
  data: MarketingData;
  onViewScore: (opportunityId: string) => void;
}

type SortKey = 'score' | 'createdAt' | 'title';

/** Section 2/9 — Opportunity Explorer. Search/filter/sort/compare across
 * real MarketOpportunity records; every score shown is the already-computed
 * OpportunityScoreResult.overall/band/confidence, never recomputed here. */
export function OpportunityExplorerTab({ data, onViewScore }: Props) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | 'ALL'>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = data.opportunities.filter((o) => {
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
      if (!q) return true;
      return o.title.toLowerCase().includes(q) || o.theme.toLowerCase().includes(q) || o.niche.toLowerCase().includes(q) || o.marketplace.toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) => {
      if (sortKey === 'score') return b.score.overall - a.score.overall;
      if (sortKey === 'createdAt') return b.createdAt - a.createdAt;
      return a.title.localeCompare(b.title);
    });
    return list;
  }, [data.opportunities, query, statusFilter, sortKey]);

  const compared = data.opportunities.filter((o) => compareIds.includes(o.id));

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id]));
  };

  const handleStatusChange = async (opportunity: MarketOpportunity, status: OpportunityStatus) => {
    await putMarketOpportunity({ ...opportunity, status });
  };

  return (
    <div className="marketing-tab opportunity-explorer-tab">
      <div className="explorer-controls">
        <label>
          <span className="sr-only">Search opportunities</span>
          <input type="search" placeholder="Search title, theme, niche, marketplace…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          Status:{' '}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OpportunityStatus | 'ALL')}>
            <option value="ALL">All</option>
            {OPPORTUNITY_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort by:{' '}
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            <option value="score">Score</option>
            <option value="createdAt">Newest</option>
            <option value="title">Title</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 && <p>No opportunities match the current search/filter.</p>}

      <ul className="opportunity-list">
        {filtered.map((opportunity) => (
          <li key={opportunity.id} className="opportunity-list-item">
            <label className="opportunity-compare-check">
              <input type="checkbox" checked={compareIds.includes(opportunity.id)} onChange={() => toggleCompare(opportunity.id)} />
              <span className="sr-only">Select {opportunity.title} for comparison</span>
            </label>
            <div className="opportunity-summary">
              <strong>{opportunity.title}</strong>
              <span>
                {opportunity.theme} · {opportunity.niche} · {opportunity.marketplace}
              </span>
              <div className="opportunity-badges">
                <span className="opportunity-score">
                  {opportunity.score.overall}/100 ({opportunity.score.band})
                </span>
                <ConfidenceBadge confidence={opportunity.score.confidence} />
              </div>
            </div>
            <div className="opportunity-actions">
              <label>
                Status:{' '}
                <select value={opportunity.status} onChange={(e) => void handleStatusChange(opportunity, e.target.value as OpportunityStatus)}>
                  {OPPORTUNITY_STATUS_VALUES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="link-btn" onClick={() => onViewScore(opportunity.id)}>
                Explain →
              </button>
            </div>
          </li>
        ))}
      </ul>

      {compared.length > 1 && (
        <section className="opportunity-compare">
          <h2>Comparison</h2>
          <div className="opportunity-compare-table-wrap">
            <table className="opportunity-compare-table">
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  {compared.map((o) => (
                    <th scope="col" key={o.id}>
                      {o.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Score</th>
                  {compared.map((o) => (
                    <td key={o.id}>{o.score.overall}/100</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Band</th>
                  {compared.map((o) => (
                    <td key={o.id}>{o.score.band}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Confidence</th>
                  {compared.map((o) => (
                    <td key={o.id}>{o.score.confidence}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Marketplace</th>
                  {compared.map((o) => (
                    <td key={o.id}>{o.marketplace}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Status</th>
                  {compared.map((o) => (
                    <td key={o.id}>{o.status}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
