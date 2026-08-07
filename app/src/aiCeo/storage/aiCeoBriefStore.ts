import { AI_CEO_BRIEFS_STORE } from '../../storage/db';
import { createGenericStore } from './genericStore';
import { isValidAiCeoBrief, type AiCeoBrief } from '../domain/types';

const store = createGenericStore<AiCeoBrief>(AI_CEO_BRIEFS_STORE, 'AI CEO Morning Brief history', isValidAiCeoBrief);

export async function loadAiCeoBriefs(): Promise<AiCeoBrief[]> {
  const all = await store.loadAll();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}
export const getAiCeoBrief = store.get;
export const putAiCeoBrief = store.put;
export const deleteAiCeoBrief = store.remove;
export const clearAiCeoBriefs = store.clear;

/** Most recent brief, or `undefined` on a fresh install — used by "Continue
 * Yesterday" (Module 11) to read what the AI CEO last told the user. */
export async function loadMostRecentAiCeoBrief(): Promise<AiCeoBrief | undefined> {
  const all = await loadAiCeoBriefs();
  return all[0];
}
