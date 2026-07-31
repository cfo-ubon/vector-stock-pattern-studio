import { useMemo, useState } from 'react';
import type { MarketingData } from './MarketingIntelligenceView';
import { findMarketGaps } from '../../marketing/gap/marketGapFinder';
import type { EvidenceBand } from '../../marketing/domain/evidence';
import { BandBadge } from './evidenceDisplay';

interface Props {
  data: MarketingData;
}

const BAND_OPTIONS: EvidenceBand[] = ['very-low', 'low', 'medium', 'high', 'very-high'];

/** Section 7 — full Market Gap Finder dashboard. Every gap listed is a
 * direct output of findMarketGaps(keywords) — a real comparison of each
 * keyword's opportunityEstimate against its portfolioCoverage, not an
 * ML-style inferred score. */
export function MarketGapFinderTab({ data }: Props) {
  const [minBand, setMinBand] = useState<EvidenceBand>('medium');
  const [maxCoverage, setMaxCoverage] = useState(2);

  const gaps = useMemo(
    () => findMarketGaps(data.keywords, { minOpportunityBand: minBand, maxPortfolioCoverage: maxCoverage }),
    [data.keywords, minBand, maxCoverage],
  );

  return (
    <div className="marketing-tab market-gap-finder-tab">
      <section className="gap-controls">
        <label>
          Minimum opportunity band:{' '}
          <select value={minBand} onChange={(e) => setMinBand(e.target.value as EvidenceBand)}>
            {BAND_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label>
          Max portfolio coverage counted as "underserved":{' '}
          <input type="number" min={0} value={maxCoverage} onChange={(e) => setMaxCoverage(Math.max(0, Number(e.target.value)))} />
        </label>
      </section>

      {gaps.length === 0 && <p>No portfolio gaps identified from current keyword evidence at this threshold.</p>}

      <ul className="gap-dashboard-list">
        {gaps.map((gap) => (
          <li key={gap.keyword} className="gap-card">
            <h2>{gap.gapTitle}</h2>
            <p>{gap.explanation}</p>
            <div className="gap-badges">
              <BandBadge label="Opportunity" band={gap.opportunityEstimate} />
              <BandBadge label="Competition" band={gap.competitionEstimate} />
              <BandBadge label="Confidence" band={gap.confidence} />
            </div>
            <p className="gap-evidence">
              <strong>Supporting evidence:</strong> {gap.supportingEvidence.join('; ')}
            </p>
            {gap.risks.length > 0 && (
              <div className="gap-risks">
                <strong>Risks</strong>
                <ul>
                  {gap.risks.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="gap-recommended-collection">
              <strong>Recommended collection:</strong> a focused collection targeting "{gap.keyword}" would close this gap — currently only{' '}
              {gap.portfolioCoverage} pattern(s) cover it.
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
