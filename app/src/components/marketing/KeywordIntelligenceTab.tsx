import { useMemo, useState } from 'react';
import type { MarketingData } from './MarketingIntelligenceView';
import type { MarketKeyword, KeywordCluster } from '../../marketing/domain/marketKeyword';
import { KEYWORD_CLUSTER_VALUES, createMarketKeyword } from '../../marketing/domain/marketKeyword';
import { putMarketKeyword, deleteMarketKeyword } from '../../marketing/storage/marketKeywordStore';
import { clusterKeywords, findDuplicateKeywordGroups, summarizeClusterCoverage } from '../../marketing/keyword/keywordClustering';
import { EvidenceBadge, BandBadge } from './evidenceDisplay';

interface Props {
  data: MarketingData;
  reload: () => Promise<void>;
}

/** Section 5 — Keyword Intelligence. Search/filter/sort plus the real
 * cluster/duplicate/coverage rollups from keywordClustering.ts. No numeric
 * search-volume field exists anywhere — competition/opportunity/duplicate
 * risk are qualitative EvidenceBand values only, per the brief. */
export function KeywordIntelligenceTab({ data, reload }: Props) {
  const [query, setQuery] = useState('');
  const [clusterFilter, setClusterFilter] = useState<KeywordCluster | 'ALL'>('ALL');
  const [newKeyword, setNewKeyword] = useState('');
  const [newCluster, setNewCluster] = useState<KeywordCluster>('subject');
  const [busy, setBusy] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const clusters = useMemo(() => clusterKeywords(data.keywords), [data.keywords]);
  const duplicates = useMemo(() => findDuplicateKeywordGroups(data.keywords), [data.keywords]);
  const coverage = useMemo(() => summarizeClusterCoverage(data.keywords), [data.keywords]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.keywords.filter((k) => {
      if (clusterFilter !== 'ALL' && k.cluster !== clusterFilter) return false;
      if (!q) return true;
      return k.keyword.toLowerCase().includes(q) || k.parentTheme.toLowerCase().includes(q);
    });
  }, [data.keywords, query, clusterFilter]);

  const detail = data.keywords.find((k) => k.id === detailId);

  const handleAdd = async () => {
    if (!newKeyword.trim()) return;
    setBusy(true);
    try {
      const record: MarketKeyword = createMarketKeyword({
        keyword: newKeyword.trim(),
        cluster: newCluster,
        evidenceSource: 'USER_OBSERVATION',
      });
      await putMarketKeyword(record);
      setNewKeyword('');
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      await deleteMarketKeyword(id);
      if (detailId === id) setDetailId(null);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="marketing-tab keyword-intelligence-tab">
      <section className="keyword-controls">
        <label>
          <span className="sr-only">Search keywords</span>
          <input type="search" placeholder="Search keyword or theme…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          Cluster:{' '}
          <select value={clusterFilter} onChange={(e) => setClusterFilter(e.target.value as KeywordCluster | 'ALL')}>
            <option value="ALL">All</option>
            {KEYWORD_CLUSTER_VALUES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="keyword-add-form">
        <label>
          New keyword (user observation):{' '}
          <input type="text" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="e.g. cottagecore floral" />
        </label>
        <label>
          Cluster:{' '}
          <select value={newCluster} onChange={(e) => setNewCluster(e.target.value as KeywordCluster)}>
            {KEYWORD_CLUSTER_VALUES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn--primary" disabled={busy || !newKeyword.trim()} onClick={() => void handleAdd()}>
          Add keyword
        </button>
      </section>

      <section className="keyword-coverage-summary">
        <h2>Portfolio coverage by cluster</h2>
        <ul className="keyword-coverage-list">
          {KEYWORD_CLUSTER_VALUES.map((c) => (
            <li key={c}>
              {c}: {coverage[c]} pattern(s) · {clusters[c].length} keyword(s)
            </li>
          ))}
        </ul>
      </section>

      {duplicates.length > 0 && (
        <section className="keyword-duplicates">
          <h2>Duplicate keyword risk</h2>
          <ul>
            {duplicates.map((d) => (
              <li key={d.keyword}>
                "{d.keyword}" tracked {d.entries.length} times — check for redundant coverage.
              </li>
            ))}
          </ul>
        </section>
      )}

      <table className="keyword-table">
        <thead>
          <tr>
            <th scope="col">Keyword</th>
            <th scope="col">Cluster</th>
            <th scope="col">Opportunity</th>
            <th scope="col">Competition</th>
            <th scope="col">Duplicate risk</th>
            <th scope="col">Evidence</th>
            <th scope="col">Coverage</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((k) => (
            <tr key={k.id}>
              <td>
                <button type="button" className="link-btn" onClick={() => setDetailId(k.id)}>
                  {k.keyword}
                </button>
              </td>
              <td>{k.cluster}</td>
              <td>
                <BandBadge label="Opportunity" band={k.opportunityEstimate} />
              </td>
              <td>
                <BandBadge label="Competition" band={k.competitionEstimate} />
              </td>
              <td>
                <BandBadge label="Duplicate risk" band={k.duplicateRisk} />
              </td>
              <td>
                <EvidenceBadge status={k.evidenceSource} />
              </td>
              <td>{k.portfolioCoverage}</td>
              <td>
                <button type="button" className="btn btn--danger" disabled={busy} onClick={() => void handleDelete(k.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <p>No keywords match the current search/filter.</p>}

      {detail && (
        <section className="keyword-detail">
          <h2>{detail.keyword}</h2>
          <dl>
            <div>
              <dt>Parent theme</dt>
              <dd>{detail.parentTheme || '—'}</dd>
            </div>
            <div>
              <dt>Related keywords</dt>
              <dd>{detail.relatedKeywords.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt>Buyer intent</dt>
              <dd>{detail.buyerIntent || '—'}</dd>
            </div>
            <div>
              <dt>Trend direction</dt>
              <dd>{detail.trendDirection}</dd>
            </div>
            <div>
              <dt>Seasonal relevance</dt>
              <dd>{detail.seasonalRelevance || '—'}</dd>
            </div>
            <div>
              <dt>Product relevance</dt>
              <dd>{detail.productRelevance.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{detail.confidence}</dd>
            </div>
          </dl>
          <button type="button" className="btn" onClick={() => setDetailId(null)}>
            Close detail
          </button>
        </section>
      )}
    </div>
  );
}
