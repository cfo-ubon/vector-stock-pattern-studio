import type { MarketKeyword } from '../domain/marketKeyword';
import type { EvidenceBand } from '../domain/evidence';

// Build 028, Module 1 Section 7 (Market Gap Finder). Real, explainable
// logic: a "gap" is a keyword whose evidence-backed opportunity is
// medium-or-better while portfolio coverage is at/below a threshold —
// nothing here is an ML-style inferred score, it's a direct comparison of
// two fields every MarketKeyword record already carries.

const BAND_RANK: Record<EvidenceBand, number> = { 'very-low': 0, low: 1, medium: 2, high: 3, 'very-high': 4, unknown: -1 };

export interface MarketGap {
  keyword: string;
  gapTitle: string;
  explanation: string;
  supportingEvidence: string[];
  opportunityEstimate: EvidenceBand;
  competitionEstimate: EvidenceBand;
  portfolioCoverage: number;
  confidence: EvidenceBand;
  risks: string[];
}

export interface FindMarketGapsOptions {
  /** A keyword needs at least this opportunity band to be considered a
   * gap at all — defaults to 'medium' so pure guesses ('unknown'/'low')
   * never surface as a recommended gap. */
  minOpportunityBand?: EvidenceBand;
  /** Portfolio coverage at or below this count is "underserved" — default
   * 2, a deliberately low bar since this build has no real sales-velocity
   * data to calibrate a more precise threshold against yet. */
  maxPortfolioCoverage?: number;
}

export function findMarketGaps(keywords: MarketKeyword[], options: FindMarketGapsOptions = {}): MarketGap[] {
  const minRank = BAND_RANK[options.minOpportunityBand ?? 'medium'];
  const maxCoverage = options.maxPortfolioCoverage ?? 2;

  return keywords
    .filter((k) => BAND_RANK[k.opportunityEstimate] >= minRank && k.portfolioCoverage <= maxCoverage)
    .map((k) => {
      const risks: string[] = [];
      if (k.confidence === 'unknown' || k.confidence === 'very-low') {
        risks.push('Confidence in this opportunity estimate is low — verify with additional research before committing production effort.');
      }
      if (k.duplicateRisk === 'high' || k.duplicateRisk === 'very-high') {
        risks.push('This keyword overlaps heavily with existing keywords — check for near-duplicate coverage before treating this as a true gap.');
      }
      return {
        keyword: k.keyword,
        gapTitle: `${k.keyword} — underserved in your portfolio`,
        explanation: `Opportunity estimate is "${k.opportunityEstimate}" but only ${k.portfolioCoverage} portfolio pattern(s) currently cover this keyword.`,
        supportingEvidence: [`evidenceSource: ${k.evidenceSource}`, `competitionEstimate: ${k.competitionEstimate}`],
        opportunityEstimate: k.opportunityEstimate,
        competitionEstimate: k.competitionEstimate,
        portfolioCoverage: k.portfolioCoverage,
        confidence: k.confidence,
        risks,
      };
    })
    .sort((a, b) => BAND_RANK[b.opportunityEstimate] - BAND_RANK[a.opportunityEstimate]);
}
