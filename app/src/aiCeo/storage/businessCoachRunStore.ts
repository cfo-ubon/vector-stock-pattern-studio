import { BUSINESS_COACH_RECOMMENDATIONS_STORE } from '../../storage/db';
import { createGenericStore } from './genericStore';
import { isValidBusinessCoachRun, type BusinessCoachRun } from '../domain/types';

const store = createGenericStore<BusinessCoachRun>(BUSINESS_COACH_RECOMMENDATIONS_STORE, 'Business Coach history', isValidBusinessCoachRun);

export async function loadBusinessCoachRuns(): Promise<BusinessCoachRun[]> {
  const all = await store.loadAll();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}
export const getBusinessCoachRun = store.get;
export const putBusinessCoachRun = store.put;
export const clearBusinessCoachRuns = store.clear;
