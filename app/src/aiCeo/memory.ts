import type { AutonomousDesignRun } from '../autopilot/domain/autonomousDesignRun';
import type { AiMemory, AiMemoryCandidate } from './domain/types';
import { aiMemoryCandidateId, aiMemoryId } from './domain/id';
import { loadAiMemoryCandidates, putAiMemoryCandidate, getAiMemoryCandidate, putAiMemory, loadConfirmedAiMemories } from './storage/aiMemoryStore';

// Build 030 Part 2, Module 8 — User-Confirmed AI Memory. "Memory must
// never be inferred and silently applied": this module only ever writes
// to `aiMemoryCandidates` (status SUGGESTED) from real, observed repeated
// choices — `confirmAiMemoryCandidate` is the one function anywhere in
// `app/src/aiCeo/` that is allowed to write into `aiMemories` (the store
// the Decision Engine actually reads from), and it only runs from an
// explicit user "Confirm" action in the UI, never automatically.

const SUGGESTION_THRESHOLD = 3;

/** Real "repeated choice" detection — the last `SUGGESTION_THRESHOLD`
 * COMPLETED Autopilot runs' own `constraints.preferredMarketplace` field,
 * never anything inferred more loosely. Suggests only when every one of
 * them agrees on the same non-null marketplace, and only once (never
 * re-suggests an already-SUGGESTED or already-CONFIRMED value — see
 * `generateAndSaveMemoryCandidates`). */
export function detectMarketplacePreferenceCandidate(runs: AutonomousDesignRun[], now: number): AiMemoryCandidate | null {
  const recent = [...runs]
    .filter((r) => r.status === 'COMPLETED')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, SUGGESTION_THRESHOLD);
  if (recent.length < SUGGESTION_THRESHOLD) return null;
  const marketplaces = recent.map((r) => r.constraints.preferredMarketplace);
  const first = marketplaces[0];
  if (!first || !marketplaces.every((m) => m === first)) return null;
  return {
    id: aiMemoryCandidateId.generate(now),
    type: 'PREFERRED_MARKETPLACE',
    value: first,
    evidence: `You chose "${first}" as the target marketplace on your last ${SUGGESTION_THRESHOLD} completed Autopilot runs.`,
    observedCount: SUGGESTION_THRESHOLD,
    status: 'SUGGESTED',
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
}

/** Persists a newly-detected candidate, but only if the exact same
 * type+value isn't already SUGGESTED or already CONFIRMED — never a
 * duplicate suggestion for the same real fact. Returns `null` when there
 * is nothing new to suggest. */
export async function generateAndSaveMemoryCandidates(runs: AutonomousDesignRun[], now: number = Date.now()): Promise<AiMemoryCandidate | null> {
  const candidate = detectMarketplacePreferenceCandidate(runs, now);
  if (!candidate) return null;
  const [existingCandidates, confirmedMemories] = await Promise.all([loadAiMemoryCandidates(), loadConfirmedAiMemories()]);
  const alreadySuggested = existingCandidates.some((c) => c.type === candidate.type && c.value === candidate.value && c.status === 'SUGGESTED');
  const alreadyConfirmed = confirmedMemories.some((m) => m.type === candidate.type && m.value === candidate.value);
  if (alreadySuggested || alreadyConfirmed) return null;
  await putAiMemoryCandidate(candidate);
  return candidate;
}

/** The one function allowed to create a CONFIRMED memory — always driven
 * by an explicit user "Confirm" click in the UI, never called
 * automatically from anywhere in this build. */
export async function confirmAiMemoryCandidate(candidateId: string, now: number = Date.now()): Promise<AiMemory | undefined> {
  const candidate = await getAiMemoryCandidate(candidateId);
  if (!candidate) return undefined;
  const memory: AiMemory = { id: aiMemoryId.generate(now), type: candidate.type, value: candidate.value, status: 'CONFIRMED', sourceCandidateId: candidate.id, confirmedAt: now, updatedAt: now, schemaVersion: 1 };
  await putAiMemory(memory);
  await putAiMemoryCandidate({ ...candidate, status: 'PROMOTED', updatedAt: now });
  return memory;
}

export async function rejectAiMemoryCandidate(candidateId: string, now: number = Date.now()): Promise<AiMemoryCandidate | undefined> {
  const candidate = await getAiMemoryCandidate(candidateId);
  if (!candidate) return undefined;
  const updated: AiMemoryCandidate = { ...candidate, status: 'REJECTED', updatedAt: now };
  await putAiMemoryCandidate(updated);
  return updated;
}
