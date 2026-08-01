import { AI_MEMORY_CANDIDATES_STORE, AI_MEMORIES_STORE } from '../../storage/db';
import { createGenericStore } from './genericStore';
import { isValidAiMemoryCandidate, isValidAiMemory, type AiMemoryCandidate, type AiMemory } from '../domain/types';

const candidateStore = createGenericStore<AiMemoryCandidate>(AI_MEMORY_CANDIDATES_STORE, 'AI Memory suggestions', isValidAiMemoryCandidate);
const memoryStore = createGenericStore<AiMemory>(AI_MEMORIES_STORE, 'Confirmed AI Memory', isValidAiMemory);

export async function loadAiMemoryCandidates(): Promise<AiMemoryCandidate[]> {
  const all = await candidateStore.loadAll();
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}
export const getAiMemoryCandidate = candidateStore.get;
export const putAiMemoryCandidate = candidateStore.put;
export const deleteAiMemoryCandidate = candidateStore.remove;
export const clearAiMemoryCandidates = candidateStore.clear;

export async function loadOpenAiMemoryCandidates(): Promise<AiMemoryCandidate[]> {
  const all = await loadAiMemoryCandidates();
  return all.filter((c) => c.status === 'SUGGESTED');
}

/** The only load path any recommendation logic (Decision Engine, Morning
 * Brief, Business Coach, Portfolio Doctor) is allowed to call — Module 8's
 * "only CONFIRMED memory may influence future recommendations" rule,
 * enforced structurally: this never returns a SUGGESTED or REJECTED
 * candidate, because those never live in this store at all. */
export async function loadConfirmedAiMemories(): Promise<AiMemory[]> {
  const all = await memoryStore.loadAll();
  return all.filter((m) => m.status === 'CONFIRMED').sort((a, b) => b.confirmedAt - a.confirmedAt);
}
export const getAiMemory = memoryStore.get;
export const putAiMemory = memoryStore.put;
export const deleteAiMemory = memoryStore.remove;
export const clearAiMemories = memoryStore.clear;
