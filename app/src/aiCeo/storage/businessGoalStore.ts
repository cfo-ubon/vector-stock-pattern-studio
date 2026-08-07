import { BUSINESS_GOALS_STORE } from '../../storage/db';
import { createGenericStore } from './genericStore';
import { isValidBusinessGoal, type BusinessGoal } from '../domain/types';

const store = createGenericStore<BusinessGoal>(BUSINESS_GOALS_STORE, 'Business Goals', isValidBusinessGoal);

export async function loadBusinessGoals(): Promise<BusinessGoal[]> {
  const all = await store.loadAll();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}
export const getBusinessGoal = store.get;
export const putBusinessGoal = store.put;
export const deleteBusinessGoal = store.remove;
export const clearBusinessGoals = store.clear;

export async function loadActiveBusinessGoals(): Promise<BusinessGoal[]> {
  const all = await loadBusinessGoals();
  return all.filter((g) => g.status === 'ACTIVE');
}
