import type { FactoryTask, FactoryTimelineEntry } from '../factory/domain/types';
import { MANUAL_MINUTES_PER_PACKAGE_BASELINE } from '../commercial/businessMetrics';
import { analyzeBottleneck } from './bottleneckAnalyzer';
import { findOpportunities } from './opportunityFinder';
import type { DailyFactoryBrief } from './domain/types';

// Mission 2, Part 8 — Daily Factory Brief. One concise summary, computed
// on demand from Part 1/2/5's already-verified output — nothing
// persisted separately, nothing invented. `estimatedOwnerTimeSavedMinutes`
// reuses the same documented per-package baseline
// `commercial/businessMetrics.ts` already discloses, scoped to packages
// completed today.

function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function generateDailyBrief(tasks: FactoryTask[], timeline: FactoryTimelineEntry[], now: number = Date.now()): DailyFactoryBrief {
  const dayStart = startOfDay(now);

  const commercialPackagesReady = tasks.filter((t) => t.type === 'exportValidation' && t.status === 'COMPLETED').length;
  const packagesCompletedToday = tasks.filter((t) => t.type === 'package' && t.status === 'COMPLETED' && (t.completedAt ?? 0) >= dayStart).length;

  const bottleneckReport = analyzeBottleneck(tasks, timeline, now);
  const topBottleneck = bottleneckReport.stage === null ? null : bottleneckReport;
  const opportunities = findOpportunities(tasks);
  const topOpportunity = opportunities[0] ?? null;

  const recommendedAction = topBottleneck?.recommendedImprovement ?? (topOpportunity ? `${topOpportunity.title} — ${topOpportunity.reason}` : 'No action needed — the queue is clear.');

  return {
    generatedAt: now,
    commercialPackagesReady,
    topBottleneck,
    topOpportunity,
    estimatedOwnerTimeSavedMinutes: packagesCompletedToday * MANUAL_MINUTES_PER_PACKAGE_BASELINE,
    recommendedAction,
  };
}
