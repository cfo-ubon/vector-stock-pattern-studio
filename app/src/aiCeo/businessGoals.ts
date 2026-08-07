import type { BusinessGoal, BusinessGoalType } from './domain/types';
import { businessGoalId } from './domain/id';
import { putBusinessGoal, loadBusinessGoals, loadActiveBusinessGoals, getBusinessGoal, deleteBusinessGoal } from './storage/businessGoalStore';

// Build 030 Part 2, Module 5 — Business Goals. Plain CRUD over a real,
// user-confirmed record — the only non-trivial logic here is the Core
// Principle's own explicit rule: "Do not convert an income target into a
// guaranteed required image count."

export const REVENUE_GOAL_WARNING = 'Revenue cannot be predicted reliably from portfolio size alone.';

/** Keyword-only, deliberately conservative — false positives (warning
 * shown when not needed) are harmless; false negatives (silently treating
 * a revenue target as a quantity target) are the actual risk the Core
 * Principle warns against, so this errs toward detecting more, not less. */
const REVENUE_KEYWORD_PATTERN = /\$|บาท|revenue|income|earn|profit|sales?\s*target|รายได้|กำไร|ยอดขาย/i;

export function detectsRevenueGoal(text: string): boolean {
  return REVENUE_KEYWORD_PATTERN.test(text);
}

export interface CreateBusinessGoalInput {
  type: BusinessGoalType;
  title: string;
  targetDate?: number | null;
  targetQuantity?: number | null;
  preferredMarketplaces?: string[];
  availableTimePerDayMinutes?: number | null;
  preferredWorkingDays?: string[];
  excludedCategoryIds?: string[];
  notes?: string;
  now?: number;
}

export function createBusinessGoal(input: CreateBusinessGoalInput): BusinessGoal {
  const now = input.now ?? Date.now();
  const revenueGoalDetected = detectsRevenueGoal(input.title) || detectsRevenueGoal(input.notes ?? '');
  return {
    id: businessGoalId.generate(now),
    type: input.type,
    title: input.title,
    targetDate: input.targetDate ?? null,
    targetQuantity: input.targetQuantity ?? null,
    preferredMarketplaces: input.preferredMarketplaces ?? [],
    availableTimePerDayMinutes: input.availableTimePerDayMinutes ?? null,
    preferredWorkingDays: input.preferredWorkingDays ?? [],
    excludedCategoryIds: input.excludedCategoryIds ?? [],
    notes: input.notes ?? '',
    revenueGoalDetected,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
}

export async function saveNewBusinessGoal(input: CreateBusinessGoalInput): Promise<BusinessGoal> {
  const goal = createBusinessGoal(input);
  await putBusinessGoal(goal);
  return goal;
}

export async function completeBusinessGoal(id: string, now: number = Date.now()): Promise<BusinessGoal | undefined> {
  const goal = await getBusinessGoal(id);
  if (!goal) return undefined;
  const updated: BusinessGoal = { ...goal, status: 'COMPLETED', updatedAt: now };
  await putBusinessGoal(updated);
  return updated;
}

export async function archiveBusinessGoal(id: string, now: number = Date.now()): Promise<BusinessGoal | undefined> {
  const goal = await getBusinessGoal(id);
  if (!goal) return undefined;
  const updated: BusinessGoal = { ...goal, status: 'ARCHIVED', updatedAt: now };
  await putBusinessGoal(updated);
  return updated;
}

export { loadBusinessGoals, loadActiveBusinessGoals, getBusinessGoal, deleteBusinessGoal };
