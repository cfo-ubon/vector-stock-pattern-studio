import { researchSourceId } from './id';

// Build 028, Module 1 Section 2 (Market Research Workspace) — a reusable
// "where did this research come from" registry. Kept separate from
// `MarketObservation` (which carries the actual finding) so the same
// source — e.g. "Adobe Stock search results for 'spring floral wallpaper'"
// — can be referenced by several observations captured over time without
// re-typing its URL/marketplace/search term each time. An observation is
// still fully self-contained without a source link (see
// `marketObservation.ts`); `researchSourceId` on an observation is an
// optional enrichment, not a requirement, since a quick manual note may
// have no reusable "source" behind it at all.

export const RESEARCH_SOURCE_TYPES = [
  'shutterstock',
  'adobe-stock',
  'freepik',
  'etsy',
  'getty-istock',
  'pinterest',
  'google-trends',
  'seasonal-calendar',
  'color-trend-reference',
  'user-portfolio-performance',
  'sales-report',
  'rejection-history',
  'manual-observation',
] as const;

export type ResearchSourceType = (typeof RESEARCH_SOURCE_TYPES)[number];

export function isValidResearchSourceType(value: unknown): value is ResearchSourceType {
  return typeof value === 'string' && (RESEARCH_SOURCE_TYPES as readonly string[]).includes(value);
}

export const RESEARCH_SOURCE_SCHEMA_VERSION = 1;

export interface ResearchSource {
  id: string;
  sourceType: ResearchSourceType;
  marketplace: string | null;
  sourceTitle: string;
  searchTerm: string;
  url: string | null;
  region: string | null;
  language: string | null;
  tags: string[];
  createdAt: number;
  schemaVersion: number;
}

export class InvalidResearchSourceInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidResearchSourceInputError';
  }
}

export interface CreateResearchSourceInput {
  sourceType: ResearchSourceType;
  sourceTitle: string;
  marketplace?: string | null;
  searchTerm?: string;
  url?: string | null;
  region?: string | null;
  language?: string | null;
  tags?: string[];
  now?: number;
}

export function createResearchSource(input: CreateResearchSourceInput): ResearchSource {
  if (!isValidResearchSourceType(input.sourceType)) {
    throw new InvalidResearchSourceInputError(`Unknown sourceType "${String(input.sourceType)}".`);
  }
  if (!input.sourceTitle.trim()) {
    throw new InvalidResearchSourceInputError('sourceTitle cannot be empty.');
  }
  const now = input.now ?? Date.now();
  return {
    id: researchSourceId.generate(now),
    sourceType: input.sourceType,
    marketplace: input.marketplace ?? null,
    sourceTitle: input.sourceTitle,
    searchTerm: input.searchTerm ?? '',
    url: input.url ?? null,
    region: input.region ?? null,
    language: input.language ?? null,
    tags: input.tags ?? [],
    createdAt: now,
    schemaVersion: RESEARCH_SOURCE_SCHEMA_VERSION,
  };
}

export function normalizeResearchSource(record: ResearchSource): ResearchSource {
  return {
    ...record,
    schemaVersion: record.schemaVersion ?? RESEARCH_SOURCE_SCHEMA_VERSION,
    marketplace: record.marketplace ?? null,
    searchTerm: record.searchTerm ?? '',
    url: record.url ?? null,
    region: record.region ?? null,
    language: record.language ?? null,
    tags: record.tags ?? [],
  };
}

export function isValidResearchSource(value: unknown): value is ResearchSource {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<ResearchSource>;
  return (
    typeof r.id === 'string' &&
    isValidResearchSourceType(r.sourceType) &&
    typeof r.sourceTitle === 'string' &&
    typeof r.createdAt === 'number' &&
    Array.isArray(r.tags)
  );
}
