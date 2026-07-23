// Build 026, Phase 5 (gap-fill) — Marketplace Registration. A small,
// honest domain model for the `marketplaceRegistrations` IndexedDB store
// that was added ahead of time in Build 026's DB_VERSION 5->6
// migration (`storage/db.ts`) but never given a real shape until now.
// Distinct from `marketplaceProfile.ts`'s `MarketplaceProfile` (the
// marketplace's OWN rules -- keyword bounds, description requirement --
// identical for every user) -- a `MarketplaceRegistration` is the
// CONTRIBUTOR's own account info for that marketplace: which
// marketplaces they actually have an account on, and what label to show
// for it, so `SubmissionRecord.contributorAccountLabel` doesn't have to
// be re-typed by hand on every new submission. Per the brief's explicit
// "do not store marketplace passwords" / "do not require marketplace
// API keys" rules, this record NEVER stores a password, API key, or
// session token -- only a human-readable label and free-text notes.

export const MARKETPLACE_REGISTRATION_SCHEMA_VERSION = 1;

export interface MarketplaceRegistration {
  id: string;
  marketplaceId: string;
  contributorAccountLabel: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export interface CreateMarketplaceRegistrationInput {
  marketplaceId: string;
  contributorAccountLabel?: string;
  notes?: string;
  now?: number;
}

export class InvalidMarketplaceRegistrationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMarketplaceRegistrationInputError';
  }
}

function generateRegistrationId(now: number): string {
  return `MREG-${now}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createMarketplaceRegistration(input: CreateMarketplaceRegistrationInput): MarketplaceRegistration {
  if (!input.marketplaceId.trim()) {
    throw new InvalidMarketplaceRegistrationInputError('marketplaceId cannot be empty.');
  }
  const now = input.now ?? Date.now();
  return {
    id: generateRegistrationId(now),
    marketplaceId: input.marketplaceId,
    contributorAccountLabel: input.contributorAccountLabel ?? '',
    notes: input.notes ?? '',
    createdAt: now,
    updatedAt: now,
    schemaVersion: MARKETPLACE_REGISTRATION_SCHEMA_VERSION,
  };
}

export function normalizeMarketplaceRegistration(record: MarketplaceRegistration): MarketplaceRegistration {
  return {
    ...record,
    schemaVersion: record.schemaVersion ?? MARKETPLACE_REGISTRATION_SCHEMA_VERSION,
    contributorAccountLabel: record.contributorAccountLabel ?? '',
    notes: record.notes ?? '',
  };
}

export function isValidMarketplaceRegistration(value: unknown): value is MarketplaceRegistration {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<MarketplaceRegistration>;
  return typeof r.id === 'string' && typeof r.marketplaceId === 'string' && typeof r.createdAt === 'number';
}
