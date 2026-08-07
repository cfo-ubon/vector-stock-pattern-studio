import type { BusinessOutcomeScore } from '../factoryIntelligence/domain/types';
import type { BusinessOutcomeComponentChange, BusinessOutcomeEvolutionExplanation } from './domain/types';

// Mission 3, Part 9 — Business Outcome Evolution. Purely explanatory:
// diffs two already-computed `BusinessOutcomeScore` records (Build 032,
// Part 7) — no new scoring logic, no new evidence gathering. Loading the
// score history itself reuses `loadBusinessOutcomeHistory` (Build 032's
// own store) directly; this module only adds "why did it change."

export function explainBusinessOutcomeChange(previous: BusinessOutcomeScore, current: BusinessOutcomeScore): BusinessOutcomeEvolutionExplanation {
  const componentChanges: BusinessOutcomeComponentChange[] = current.components.map((c) => {
    const prevComponent = previous.components.find((p) => p.name === c.name);
    return { name: c.name, fromValue: prevComponent?.value ?? null, toValue: c.value, fromContribution: prevComponent?.contribution ?? null, toContribution: c.contribution };
  });

  const scoreDelta = previous.score !== null && current.score !== null ? current.score - previous.score : null;

  const explanation: string[] = [];
  if (scoreDelta === null) {
    explanation.push('Cannot compute a score delta — one of the two scores is not yet available.');
  } else {
    explanation.push(`Business Outcome Score ${scoreDelta >= 0 ? 'increased' : 'decreased'} by ${Math.abs(scoreDelta)} point(s) (${previous.score} -> ${current.score}).`);

    const movers = componentChanges
      .filter((c) => c.fromContribution !== null && c.toContribution !== null && c.fromContribution !== c.toContribution)
      .sort((a, b) => Math.abs((b.toContribution as number) - (b.fromContribution as number)) - Math.abs((a.toContribution as number) - (a.fromContribution as number)));
    for (const mover of movers.slice(0, 3)) {
      const delta = (mover.toContribution as number) - (mover.fromContribution as number);
      explanation.push(`${mover.name}: contribution ${delta >= 0 ? 'rose' : 'fell'} by ${Math.abs(Math.round(delta * 100) / 100)} (value ${mover.fromValue ?? 'unknown'} -> ${mover.toValue ?? 'unknown'}).`);
    }

    for (const m of componentChanges.filter((c) => c.fromValue !== null && c.toValue === null)) {
      explanation.push(`${m.name} no longer has real data (was ${m.fromValue}).`);
    }
    for (const m of componentChanges.filter((c) => c.fromValue === null && c.toValue !== null)) {
      explanation.push(`${m.name} now has real data for the first time (${m.toValue}).`);
    }
  }

  return { fromScore: previous.score, toScore: current.score, scoreDelta, componentChanges, explanation };
}

/** Sorted oldest -> newest for a readable evolution timeline. */
export function sortBusinessOutcomeHistory(history: BusinessOutcomeScore[]): BusinessOutcomeScore[] {
  return [...history].sort((a, b) => a.createdAt - b.createdAt);
}
