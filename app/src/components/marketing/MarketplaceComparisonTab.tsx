import { useMemo, useState } from 'react';
import type { MarketingData } from './MarketingIntelligenceView';
import { MARKETPLACE_PROFILES, type MarketplaceId } from '../../metadata/marketplaceProfiles';
import { compareMarketplaces } from '../../marketing/compare/marketplaceComparison';

interface Props {
  data: MarketingData;
}

const ALL_MARKETPLACE_IDS = Object.keys(MARKETPLACE_PROFILES) as MarketplaceId[];

/** Section 8 — Marketplace Comparison. Renders compareMarketplaces()
 * output only; demand/competition/keyword-opportunity are shown as
 * distributions of observed EvidenceBand counts, never averaged into one
 * fabricated number. */
export function MarketplaceComparisonTab({ data }: Props) {
  const [selected, setSelected] = useState<MarketplaceId[]>(ALL_MARKETPLACE_IDS.slice(0, 4));

  const rows = useMemo(() => compareMarketplaces(selected, data.observations, data.keywords), [selected, data.observations, data.keywords]);

  const toggle = (id: MarketplaceId) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="marketing-tab marketplace-comparison-tab">
      <fieldset className="marketplace-picker">
        <legend>Marketplaces to compare</legend>
        {ALL_MARKETPLACE_IDS.map((id) => (
          <label key={id} className="marketplace-picker-option">
            <input type="checkbox" checked={selected.includes(id)} onChange={() => toggle(id)} />
            {MARKETPLACE_PROFILES[id].label}
          </label>
        ))}
      </fieldset>

      {rows.length === 0 && <p>Select at least one marketplace to compare.</p>}

      <div className="marketplace-comparison-cards">
        {rows.map((row) => (
          <div className="marketplace-comparison-card" key={row.marketplaceId}>
            <h2>{MARKETPLACE_PROFILES[row.marketplaceId].label}</h2>
            <dl>
              <div>
                <dt>Title max length</dt>
                <dd>{row.metadataRequirements.titleMaxLength}</dd>
              </div>
              <div>
                <dt>Description max length</dt>
                <dd>{row.metadataRequirements.descriptionMaxLength}</dd>
              </div>
              <div>
                <dt>Keyword count range</dt>
                <dd>
                  {row.metadataRequirements.minKeywords}–{row.metadataRequirements.maxKeywords}
                </dd>
              </div>
              <div>
                <dt>Observations recorded</dt>
                <dd>{row.observationCount}</dd>
              </div>
              <div>
                <dt>Keywords tracked</dt>
                <dd>{row.keywordCount}</dd>
              </div>
            </dl>
            <div className="marketplace-distribution">
              <strong>Demand signal distribution</strong>
              <ul>
                {Object.entries(row.demandDistribution).map(([band, count]) => (
                  <li key={band}>
                    {band}: {count}
                  </li>
                ))}
              </ul>
            </div>
            <div className="marketplace-distribution">
              <strong>Competition signal distribution</strong>
              <ul>
                {Object.entries(row.competitionDistribution).map(([band, count]) => (
                  <li key={band}>
                    {band}: {count}
                  </li>
                ))}
              </ul>
            </div>
            <div className="marketplace-distribution">
              <strong>Keyword opportunity distribution</strong>
              <ul>
                {Object.entries(row.keywordOpportunityDistribution).map(([band, count]) => (
                  <li key={band}>
                    {band}: {count}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
