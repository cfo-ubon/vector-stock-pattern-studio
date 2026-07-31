import { createDailyMission, type DailyMission } from '../domain/dailyMission';
import type { MarketOpportunity } from '../domain/marketOpportunity';
import type { MarketSnapshot } from '../domain/marketSnapshot';

// Build 028, Module 1 Sections 1 & 10 — "Today's Market Mission" /
// "Daily Production Plan". This module picks the single best-scoring
// opportunity from a real, already-persisted list and maps its (and its
// source snapshot's) real fields onto a DailyMission — it invents nothing:
// hero motif, colors, and product use cases all come straight from the
// snapshot that produced the opportunity, and risks are derived from the
// score's own real missingDimensions/low-confidence signals, not written
// freehand.

export interface GenerateDailyMissionOptions {
  date?: number;
  now?: number;
}

/** Returns null (not a fabricated mission) when the opportunity list is
 * empty — matching the offline-mode rule that an empty state must say so
 * honestly rather than presenting something invented as today's plan. */
export function generateDailyMission(
  opportunities: MarketOpportunity[],
  snapshot: MarketSnapshot,
  options: GenerateDailyMissionOptions = {},
): DailyMission | null {
  const active = opportunities.filter((o) => o.snapshotId === snapshot.id);
  if (active.length === 0) return null;

  const best = [...active].sort((a, b) => b.score.overall - a.score.overall)[0];
  const now = options.now ?? Date.now();
  const date = options.date ?? now;

  const risks: string[] = [];
  if (best.score.missingDimensions.length > 0) {
    risks.push(`${best.score.missingDimensions.length} scoring dimension(s) have no evidence yet: ${best.score.missingDimensions.join(', ')}.`);
  }
  if (best.score.confidence === 'low' || best.score.confidence === 'very-low' || best.score.confidence === 'unknown') {
    risks.push(`Overall confidence is ${best.score.confidence} — verify with additional research before committing production effort.`);
  }

  return createDailyMission({
    date,
    opportunityId: best.id,
    primaryMarketplace: best.marketplace,
    niche: best.niche,
    theme: best.theme,
    category: snapshot.motifs[0] ?? best.niche,
    heroMotif: snapshot.motifs[0] ?? 'Unspecified — no motif evidence captured yet',
    secondaryMotifs: snapshot.motifs.slice(1),
    colorDirection: snapshot.colors,
    productUseCases: snapshot.productUseCases,
    opportunityScore: best.score.overall,
    confidence: best.score.confidence,
    evidenceFreshness: snapshot.dataFreshness,
    risks,
    now,
  });
}
