import { COMMERCIAL_PACKAGE_HISTORY_STORE } from '../../storage/db';
import { createGenericStore } from '../../aiCeo/storage/genericStore';
import type { CommercialPackageHistoryEntry, CommercialPackageStatus } from '../domain/types';

// Build 031A, Phase 8 support — the append-only event log every Business
// Metrics figure reads. Reuses `aiCeo/storage/genericStore.ts`'s generic
// keyPath-'id' CRUD factory (Build 030 Part 2) rather than hand-writing a
// 9th near-identical store module.

function isValidHistoryEntry(value: unknown): value is CommercialPackageHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<CommercialPackageHistoryEntry>;
  return typeof e.id === 'string' && typeof e.createdAt === 'number' && typeof e.assetId === 'string' && typeof e.marketplaceId === 'string' && typeof e.readinessScore === 'number';
}

const store = createGenericStore<CommercialPackageHistoryEntry>(COMMERCIAL_PACKAGE_HISTORY_STORE, 'Commercial package history', isValidHistoryEntry);

function generateHistoryEntryId(now: number): string {
  return `CPH-${now}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function loadCommercialPackageHistory(): Promise<CommercialPackageHistoryEntry[]> {
  return store.loadAll();
}

export interface RecordCommercialPackageBuiltInput {
  assetId: string;
  marketplaceId: string;
  status: CommercialPackageStatus;
  readinessScore: number;
  now?: number;
}

export async function recordCommercialPackageBuilt(input: RecordCommercialPackageBuiltInput): Promise<CommercialPackageHistoryEntry> {
  const now = input.now ?? Date.now();
  const entry: CommercialPackageHistoryEntry = {
    id: generateHistoryEntryId(now),
    createdAt: now,
    assetId: input.assetId,
    marketplaceId: input.marketplaceId,
    status: input.status,
    readinessScore: input.readinessScore,
  };
  await store.put(entry);
  return entry;
}

export async function clearCommercialPackageHistory(): Promise<void> {
  await store.clear();
}
