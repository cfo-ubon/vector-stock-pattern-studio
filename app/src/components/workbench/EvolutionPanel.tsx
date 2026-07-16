import { useMemo, useState } from 'react';
import type { DesignSpecification } from '../../trend/designSpecTypes';
import { runEvolution } from '../../evolution/evolutionEngine';
import { summarizeTimeline } from '../../evolution/evolutionTimeline';
import type { EvolutionResult, SelectionAlgorithm } from '../../evolution/types';
import { DESIGN_CRITIQUE_DIMENSIONS } from '../../critic/designCritique';

// Design Evolution Engine (Phase 8) — the UI surface for `evolution/*`.
// This component contains no evolutionary logic of its own: every
// candidate, mutation, crossover, fitness score, and generation below
// comes straight from a real `EvolutionResult` (`evolution/evolutionEngine.ts`).
// "Apply Winning Design" only ever forwards the real winning candidate's
// spec to `onApplySpec` — it never edits the spec itself.

function scoreClass(value: number): string {
  if (value < 0) return 'workbench-score--low';
  if (value >= 80) return 'workbench-score--good';
  if (value >= 60) return 'workbench-score--ok';
  return 'workbench-score--low';
}

function shortId(id: string): string {
  const parts = id.split('::');
  return parts[parts.length - 1] || id;
}

interface Props {
  spec: DesignSpecification;
  seed: string;
  onApplySpec: (next: DesignSpecification) => void;
}

export function EvolutionPanel({ spec, seed, onApplySpec }: Props) {
  const [populationSize, setPopulationSize] = useState(6);
  const [maxGenerations, setMaxGenerations] = useState(3);
  const [selectionAlgorithm, setSelectionAlgorithm] = useState<SelectionAlgorithm>('tournament');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EvolutionResult | null>(null);
  const [selectedGenIndex, setSelectedGenIndex] = useState(0);

  const summary = useMemo(() => (result ? summarizeTimeline(result.timeline) : null), [result]);
  const selectedGen = result?.timeline[Math.min(selectedGenIndex, result.timeline.length - 1)] ?? null;

  function handleRun() {
    setRunning(true);
    // Same "let the Running… state paint first" pattern the Design
    // Critic panel's Improvement Loop button uses — this is a real,
    // synchronous, potentially multi-second computation (every
    // generation renders real candidates), not an async API call.
    setTimeout(() => {
      const next = runEvolution(spec, seed, { populationSize, maxGenerations, selectionAlgorithm });
      setResult(next);
      setSelectedGenIndex(next.timeline.length - 1);
      setRunning(false);
    }, 0);
  }

  return (
    <div className="workbench-evolution-panel">
      <p className="metadata-hint">
        Generates a population of Design Specification variants from this spec, evaluates each with the real Design Critic, and evolves them across generations — each fitness evaluation renders a
        real candidate, so a run can take anywhere from several seconds to a few minutes depending on the settings below.
      </p>

      <div className="workbench-evolution-config">
        <label>
          Population size
          <select value={populationSize} onChange={(e) => setPopulationSize(Number(e.target.value))} disabled={running}>
            {[3, 4, 6, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Max generations
          <select value={maxGenerations} onChange={(e) => setMaxGenerations(Number(e.target.value))} disabled={running}>
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Selection algorithm
          <select value={selectionAlgorithm} onChange={(e) => setSelectionAlgorithm(e.target.value as SelectionAlgorithm)} disabled={running}>
            <option value="elitist">Elitist</option>
            <option value="tournament">Tournament</option>
            <option value="rouletteWheel">Roulette Wheel</option>
          </select>
        </label>
      </div>

      <div className="trend-studio-actions">
        <button type="button" className="btn btn--primary" onClick={handleRun} disabled={running}>
          {running ? '⏳ Evolving…' : result ? '🧬 Run Again' : '🧬 Run Evolution'}
        </button>
      </div>

      {!result && !running && <p className="metadata-hint">Run the Evolution Engine to generate and evolve a population of design variants from this spec.</p>}

      {result && summary && (
        <>
          <div className={`marketplace-ready-indicator marketplace-ready-indicator--${result.best.fitness.rejected ? 'issues' : 'ready'}`}>
            {result.generationsUsed} generation(s), {result.evaluationsUsed} evaluation(s) — stopped because {result.stoppedReason}
          </div>

          <details open className="workbench-collapsible">
            <summary>
              🏆 Best Design — {result.best.fitness.score}/100 {result.best.fitness.rejected ? '(rejected — unrenderable within safety limits)' : ''}
            </summary>
            <div className="workbench-quality-scores">
              {DESIGN_CRITIQUE_DIMENSIONS.map(({ key, label }) => (
                <div key={key} className={`workbench-quality-score ${scoreClass(result.best.fitness.critique[key])}`}>
                  <span>{label}</span>
                  <strong>{result.best.fitness.critique[key]}</strong>
                </div>
              ))}
            </div>
            <p className="metadata-hint">
              Score moved {summary.startScore} → {summary.finalScore} across {summary.generations} generation(s) ({summary.monotonicallyImproved ? 'never regressed' : 'regressed at least once'}).
            </p>
            <div className="workbench-evolution-dna">
              <strong>Design DNA — {shortId(result.best.id)}</strong>
              <p className="metadata-hint">
                Generation {result.best.dna.generation}
                {result.best.dna.parentIds.length === 0 && result.best.dna.appliedMutations.length === 0 && ' — the original seed spec, unmutated.'}
                {result.best.dna.parentIds.length === 0 && result.best.dna.appliedMutations.length > 0 && ' — a direct mutation of the original seed spec.'}
                {result.best.dna.parentIds.length === 1 && ` — mutated from ${shortId(result.best.dna.parentIds[0])}.`}
                {result.best.dna.parentIds.length === 2 && ` — crossover of ${shortId(result.best.dna.parentIds[0])} and ${shortId(result.best.dna.parentIds[1])}.`}
              </p>
              {result.best.dna.appliedMutations.length > 0 && <p className="metadata-hint">Mutations: {result.best.dna.appliedMutations.map((m) => m.type).join(', ')}</p>}
              {result.best.dna.crossover && (
                <p className="metadata-hint">
                  Crossover traits from A: {result.best.dna.crossover.traitsFromA.join(', ') || '—'} · from B: {result.best.dna.crossover.traitsFromB.join(', ') || '—'}
                </p>
              )}
            </div>
            <button type="button" className="btn btn--primary" onClick={() => onApplySpec(result.best.spec)}>
              ✅ Apply Winning Design
            </button>
          </details>

          <details className="workbench-collapsible">
            <summary>📈 Evolution Timeline ({result.timeline.length} generation(s))</summary>
            <div className="workbench-evolution-timeline">
              {result.timeline.map((gen) => (
                <button
                  key={gen.index}
                  type="button"
                  className={`workbench-evolution-generation-chip${gen.index === selectedGen?.index ? ' workbench-evolution-generation-chip--active' : ''}`}
                  onClick={() => setSelectedGenIndex(gen.index)}
                >
                  Gen {gen.index}: best {gen.bestScore}, avg {Math.round(gen.averageScore)}
                </button>
              ))}
            </div>
            {selectedGen && (
              <ul className="workbench-evolution-candidate-list">
                {selectedGen.candidates.map((c) => (
                  <li
                    key={c.id}
                    className={`workbench-evolution-candidate${c.id === selectedGen.bestCandidateId ? ' workbench-evolution-candidate--best' : ''}${c.fitness.rejected ? ' workbench-evolution-candidate--rejected' : ''}`}
                  >
                    <span>{shortId(c.id)}</span>
                    <span>{c.fitness.rejected ? 'rejected' : `${c.fitness.score}/100`}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="metadata-hint">Average pairwise spec distance in generation {selectedGen?.index}: {selectedGen?.diversityAverageDistance.toFixed(1)} field(s).</p>
          </details>
        </>
      )}
    </div>
  );
}
