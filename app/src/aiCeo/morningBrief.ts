import type { AiCeoBrief, AiCeoRecommendation, AiCeoExplanation, AiCeoDataStatus } from './domain/types';
import { aiCeoBriefId } from './domain/id';
import { rankAiCeoRecommendations, type AiCeoDecisionInput } from './decisionEngine';
import type { PortfolioAsset } from '../catalog/domain/types';
import { loadAiCeoDecisionContext } from './loadDecisionContext';
import { loadMostRecentAiCeoBrief, putAiCeoBrief } from './storage/aiCeoBriefStore';

// Build 030 Part 2, Module 1 — Proactive AI CEO Morning Brief. Every
// section below maps to one of the spec's 14 required sections; nothing
// here computes a new score — `topRecommendation` is exactly the Decision
// Engine's (Module 2) top pick, reshaped into the Brief's own vocabulary.

function greetingFor(now: number): string {
  const hour = new Date(now).getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function dateLabelFor(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Section 4 ("Yesterday/last-session summary if real records exist") —
 * `null` when no previous Brief exists, never a fabricated summary. */
function buildYesterdaySummary(previousBrief: AiCeoBrief | undefined, portfolioAssets: PortfolioAsset[], now: number): string | null {
  if (!previousBrief) return null;
  const since = previousBrief.createdAt;
  const sinceLabel = new Date(since).toISOString().slice(0, 10);
  const createdSince = portfolioAssets.filter((a) => a.createdAt > since && a.createdAt <= now).length;
  if (createdSince === 0) return `Since your last session (${sinceLabel}), no new Portfolio items were recorded.`;
  return `Since your last session (${sinceLabel}), ${createdSince} new Portfolio item(s) were recorded.`;
}

function missingInformationFor(status: AiCeoDataStatus): string[] {
  if (status !== 'INSUFFICIENT_DATA') return [];
  return ['No Market Snapshot has been captured yet.', 'No Portfolio assets exist yet.'];
}

function explanationFor(top: AiCeoRecommendation): AiCeoExplanation {
  return {
    recommendation: top.title,
    why: [top.reason],
    evidence: top.evidenceRefs,
    confidence: top.confidence,
    freshness: top.dataFreshness,
    freshnessLabel: top.freshnessLabel,
    assumptions: top.autopilotAction ? [`Production size assumed at ${top.autopilotAction.requestedCount} pattern(s) unless you adjust it.`] : [],
    risks: top.risks,
    alternative: top.alternativeTitle ? `${top.alternativeTitle}${top.alternativeReason ? ` — ${top.alternativeReason}` : ''}` : null,
    memoryUsed: top.memoryInfluence,
    missingData: missingInformationFor(top.dataFreshness),
  };
}

export interface BuildAiCeoBriefInput extends AiCeoDecisionInput {
  previousBrief: AiCeoBrief | undefined;
}

/** Pure — the same inputs always produce the same Brief (only `input.now`
 * is a real clock read, exactly like `dashboardSnapshot.ts`'s own
 * `generatedAt` convention). */
export function buildAiCeoBrief(input: BuildAiCeoBriefInput): AiCeoBrief {
  const recommendations = rankAiCeoRecommendations(input);
  const top = recommendations[0];
  const alternatives = recommendations.slice(1);

  return {
    id: aiCeoBriefId.generate(input.now),
    createdAt: input.now,
    greeting: `${greetingFor(input.now)}!`,
    dateLabel: dateLabelFor(input.now),
    dataStatus: top.dataFreshness,
    dataStatusLabel: top.freshnessLabel,
    yesterdaySummary: buildYesterdaySummary(input.previousBrief, input.portfolioAssets, input.now),
    topRecommendation: top,
    alternativeRecommendations: alternatives,
    portfolioImpact: top.expectedImpact,
    productionSizeRecommendation: top.autopilotAction ? `${top.autopilotAction.requestedCount} pattern(s)` : 'Not applicable — this recommendation is not a production run.',
    confidence: top.confidence,
    freshnessLabel: top.freshnessLabel,
    risks: top.risks,
    missingInformation: missingInformationFor(top.dataFreshness),
    primaryAction: top.autopilotAction,
    explanation: explanationFor(top),
    schemaVersion: 1,
  };
}

/** The one place this module touches live storage — loads every real
 * source the Decision Engine needs, builds today's Brief, and persists it
 * (so Module 11 "Continue Yesterday" and Conversation History can later
 * reference a real prior Brief, not just today's in-memory one). */
export async function generateAndSaveAiCeoBrief(requestedCount = 10, now: number = Date.now()): Promise<AiCeoBrief> {
  const [context, previousBrief] = await Promise.all([loadAiCeoDecisionContext(now), loadMostRecentAiCeoBrief()]);

  const brief = buildAiCeoBrief({ ...context, requestedCount, now, previousBrief });

  await putAiCeoBrief(brief);
  return brief;
}
