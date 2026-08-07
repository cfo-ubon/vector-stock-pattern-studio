import { FACTORY_PRODUCTION_AUTOPILOT_STATE_STORE } from '../../storage/db';
import { createGenericStore } from '../../aiCeo/storage/genericStore';
import type { ProductionAutopilotState } from '../domain/types';

// Mission 4, Part 13 — single-row Autopilot State, mirrors
// `factory/storage/factorySchedulerStateStore.ts`'s own single-row pattern.
// Always exactly one row, id `'productionAutopilot'`.

function isValidProductionAutopilotState(value: unknown): value is ProductionAutopilotState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.id === 'productionAutopilot' && typeof v.updatedAt === 'number';
}

const store = createGenericStore<ProductionAutopilotState>(
  FACTORY_PRODUCTION_AUTOPILOT_STATE_STORE,
  'Production Autopilot State',
  isValidProductionAutopilotState,
);

const DEFAULT_STATE: ProductionAutopilotState = {
  id: 'productionAutopilot',
  lastSessionId: null,
  lastSessionStatus: null,
  updatedAt: 0,
};

export async function loadProductionAutopilotState(): Promise<ProductionAutopilotState> {
  const existing = await store.get('productionAutopilot');
  return existing ?? DEFAULT_STATE;
}
export async function putProductionAutopilotState(state: ProductionAutopilotState): Promise<void> {
  await store.put(state);
}
export async function clearProductionAutopilotStateForTest(): Promise<void> {
  await store.clear();
}
