import type { FactoryTask, FactoryTimelineEntry } from '../factory/domain/types';
import { computeFactoryHealth } from '../factory/factoryMetrics';
import { computeFactoryIntelligenceMetrics } from './metricsEngine';
import type { BusinessOutcomeScore, BusinessOutcomeComponent } from './domain/types';
import { BUSINESS_OUTCOME_SCHEMA_VERSION } from './domain/types';

// Mission 2, Part 7 — Business Outcome Score. Pure arithmetic over
// already-computed Factory KPIs (Part 1) and Factory Health (Build
// 031C) — no new AI, no new evidence gathering. Every component's raw
// value, weight, and contribution is returned alongside the final score
// so the score is always explainable, never a black box. A component
// missing real data (`value: null`) is excluded from the weighted
// average and the remaining weights are re-normalized, so missing data
// never silently drags the score toward zero.

/** No owner waiting time observed yet scores 100 for this component; at
 * or beyond this disclosed cap it scores 0, linear in between. A policy
 * choice, not a measured baseline (no historical owner-time data exists
 * yet to derive one from). */
const OWNER_TIME_ZERO_SCORE_CAP_MS = 4 * 60 * 60 * 1000; // 4 hours

const COMPONENT_WEIGHTS = {
  factoryEfficiency: 0.25,
  commercialReadiness: 0.2,
  automation: 0.15,
  ownerTime: 0.15,
  commercialThroughput: 0.1,
  queueHealth: 0.1,
  blockedRatio: 0.05,
} as const;

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}
function dateStamp(now: number): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1, 2)}${pad(d.getUTCDate(), 2)}`;
}
function randomSuffix(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
export function generateBusinessOutcomeScoreId(now: number = Date.now()): string {
  return `FBOS-${dateStamp(now)}-${randomSuffix()}`;
}

export function computeBusinessOutcomeScore(tasks: FactoryTask[], timeline: FactoryTimelineEntry[], now: number = Date.now()): BusinessOutcomeScore {
  const health = computeFactoryHealth(tasks, timeline, now);
  const metrics = computeFactoryIntelligenceMetrics(tasks, timeline, now);

  const ownerTimeScore = metrics.ownerWaitingTimeMs === null ? null : Math.max(0, 100 - (metrics.ownerWaitingTimeMs / OWNER_TIME_ZERO_SCORE_CAP_MS) * 100);
  const automationScore = metrics.repairRatio === null ? null : Math.max(0, 100 - metrics.repairRatio);
  const blockedScore = metrics.blockedTaskRatio === null ? null : Math.max(0, 100 - metrics.blockedTaskRatio);
  const throughputScore = metrics.commercialThroughput > 0 ? 100 : 0;

  const raw: { name: string; value: number | null; weight: number }[] = [
    { name: 'factoryEfficiency', value: metrics.factoryEfficiency, weight: COMPONENT_WEIGHTS.factoryEfficiency },
    { name: 'commercialReadiness', value: metrics.commercialReadyRatio, weight: COMPONENT_WEIGHTS.commercialReadiness },
    { name: 'automation', value: automationScore, weight: COMPONENT_WEIGHTS.automation },
    { name: 'ownerTime', value: ownerTimeScore, weight: COMPONENT_WEIGHTS.ownerTime },
    { name: 'commercialThroughput', value: throughputScore, weight: COMPONENT_WEIGHTS.commercialThroughput },
    { name: 'queueHealth', value: health.queueHealth, weight: COMPONENT_WEIGHTS.queueHealth },
    { name: 'blockedRatio', value: blockedScore, weight: COMPONENT_WEIGHTS.blockedRatio },
  ];

  const available = raw.filter((c) => c.value !== null);
  const totalAvailableWeight = available.reduce((s, c) => s + c.weight, 0);

  const components: BusinessOutcomeComponent[] = raw.map((c) => {
    if (c.value === null || totalAvailableWeight === 0) return { name: c.name, value: c.value, weight: c.weight, contribution: null };
    const normalizedWeight = c.weight / totalAvailableWeight;
    return { name: c.name, value: c.value, weight: c.weight, contribution: Math.round(c.value * normalizedWeight * 100) / 100 };
  });

  const score = totalAvailableWeight === 0 ? null : Math.round(components.reduce((s, c) => s + (c.contribution ?? 0), 0));

  const explanation =
    score === null
      ? ['Not enough verified data yet to compute a Business Outcome Score.']
      : [
          `Score is a weighted average of ${available.length} of ${raw.length} components (weights re-normalized over the components with real data): ${available.map((c) => `${c.name} (${Math.round(c.value as number)})`).join(', ')}.`,
          ...raw.filter((c) => c.value === null).map((c) => `${c.name} excluded — not enough data yet.`),
        ];

  return { id: generateBusinessOutcomeScoreId(now), score, components, explanation, createdAt: now, schemaVersion: BUSINESS_OUTCOME_SCHEMA_VERSION };
}
