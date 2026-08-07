import { PORTFOLIO_DIAGNOSES_STORE } from '../../storage/db';
import { createGenericStore } from './genericStore';
import { isValidPortfolioDiagnosis, type PortfolioDiagnosis } from '../domain/types';

const store = createGenericStore<PortfolioDiagnosis>(PORTFOLIO_DIAGNOSES_STORE, 'Portfolio Doctor history', isValidPortfolioDiagnosis);

export async function loadPortfolioDiagnoses(): Promise<PortfolioDiagnosis[]> {
  const all = await store.loadAll();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}
export const getPortfolioDiagnosis = store.get;
export const putPortfolioDiagnosis = store.put;
export const clearPortfolioDiagnoses = store.clear;
