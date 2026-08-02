import type { FactoryTask, FactoryTimelineEntry } from '../factory/domain/types';
import { computeFactoryIntelligenceMetrics } from '../factoryIntelligence/metricsEngine';
import { simulateOptimization } from './optimizationSimulator';
import type { PolicyExperiment, PolicyExperimentName, PolicyExperimentKpiComparison, OptimizationScenario, OptimizationSimulationResult } from './domain/types';
import { POLICY_EXPERIMENT_SCHEMA_VERSION } from './domain/types';

// Mission 3, Part 7 — Policy Experiment Engine. A named policy is just a
// label over one of Part 4's real Optimization Simulator scenarios,
// measured across the 4 KPIs the spec names (Commercial Ready, Repair,
// Queue, Owner Time) — this file runs no second simulation engine (Part
// 14's "no duplicated logic"). `activated` is always `false`: nothing in
// this module can switch what the Scheduler actually runs — "compare,"
// never "activate."

const POLICY_TO_SCENARIO: Record<PolicyExperimentName, OptimizationScenario> = {
  FINISH_COLLECTION_FIRST: 'COLLECTION_COMPLETION_FIRST',
  REPAIR_FIRST_POLICY: 'REPAIR_FIRST',
  PACKAGE_EARLIER_POLICY: 'PACKAGING_EARLIER',
  QUEUE_IMPROVEMENT_POLICY: 'QUEUE_IMPROVEMENT',
};

const POLICY_DESCRIPTIONS: Record<PolicyExperimentName, string> = {
  FINISH_COLLECTION_FIRST: 'Prioritize finishing in-progress Collections before starting new work',
  REPAIR_FIRST_POLICY: 'Prioritize Repair over new Generation across the whole queue',
  PACKAGE_EARLIER_POLICY: 'Move Commercial Packaging earlier relative to SEO/Export',
  QUEUE_IMPROVEMENT_POLICY: 'Prioritize reducing overall queue wait time across the whole queue',
};

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
export function generatePolicyExperimentId(now: number = Date.now()): string {
  return `FPOL-${dateStamp(now)}-${randomSuffix()}`;
}

function directionFor(simulation: OptimizationSimulationResult, targetsThisKpi: boolean): PolicyExperimentKpiComparison['expectedDirection'] {
  if (!targetsThisKpi) return 'NO_CHANGE';
  // The simulator only ever projects the metric it was evaluated against
  // improving when real evidence exists — it never asserts a KPI it
  // wasn't evaluated against will worsen, since that would be a guess.
  return simulation.expectedImprovement === 'UNKNOWN' ? 'UNKNOWN' : 'IMPROVE';
}

export function runPolicyExperiment(policyName: PolicyExperimentName, tasks: FactoryTask[], timeline: FactoryTimelineEntry[], now: number = Date.now()): PolicyExperiment {
  const scenario = POLICY_TO_SCENARIO[policyName];
  const simulation = simulateOptimization(scenario, tasks, timeline, now);
  const currentMetrics = computeFactoryIntelligenceMetrics(tasks, timeline, now);

  const kpiComparisons: PolicyExperimentKpiComparison[] = [
    { kpi: 'commercialReadyRatio', label: 'Commercial Ready', currentValue: currentMetrics.commercialReadyRatio, expectedDirection: directionFor(simulation, simulation.targetMetric === 'commercialReadyRatio') },
    { kpi: 'repairRatio', label: 'Repair', currentValue: currentMetrics.repairRatio, expectedDirection: directionFor(simulation, simulation.targetMetric === 'repairRatio') },
    { kpi: 'averageQueueTimeMs', label: 'Queue', currentValue: currentMetrics.averageQueueTimeMs, expectedDirection: directionFor(simulation, simulation.targetMetric === 'averageQueueTimeMs') },
    // Owner Time is always a downstream effect of every named scenario,
    // never directly targeted by the simulator — never asserted to
    // change without its own supporting evidence.
    { kpi: 'ownerWaitingTimeMs', label: 'Owner Time', currentValue: currentMetrics.ownerWaitingTimeMs, expectedDirection: 'NO_CHANGE' },
  ];

  return {
    id: generatePolicyExperimentId(now),
    policyName,
    description: POLICY_DESCRIPTIONS[policyName],
    scenario,
    simulation,
    kpiComparisons,
    activated: false,
    createdAt: now,
    schemaVersion: POLICY_EXPERIMENT_SCHEMA_VERSION,
  };
}
