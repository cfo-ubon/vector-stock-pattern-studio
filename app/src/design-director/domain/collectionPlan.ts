import { collectionPlanId } from '../../marketing/domain/id';

// Build 028B — Module 2/3: Collection Planner + Collection Roadmap. The 8
// pattern-type categories below are the business-facing planning taxonomy
// the AI Creative Director's brief asks for (Hero/Secondary/Blender/Stripe/
// Border/Coordinate/Mini Pattern/Texture) — a coarser, human-facing set than
// the generator's own internal `AssetType` (14 kinds in
// `collection/collectionGenerator.ts`, e.g. `spotMotifSheet`,
// `decorativeElementsSheet`). Module 11 (Generator Handoff) is the one place
// that bridges this planning taxonomy into real generator-ready fields —
// keeping the two taxonomies separate means the planning UI never needs to
// know about generator internals, and the generator never needs to know
// about business-facing category names.

export const COLLECTION_PATTERN_TYPE_VALUES = [
  'hero',
  'secondary',
  'blender',
  'stripe',
  'border',
  'coordinate',
  'miniPattern',
  'texture',
] as const;

export type CollectionPatternType = (typeof COLLECTION_PATTERN_TYPE_VALUES)[number];

export function isValidCollectionPatternType(value: unknown): value is CollectionPatternType {
  return typeof value === 'string' && (COLLECTION_PATTERN_TYPE_VALUES as readonly string[]).includes(value);
}

export const COLLECTION_PATTERN_TYPE_LABELS: Record<CollectionPatternType, string> = {
  hero: 'Hero',
  secondary: 'Secondary',
  blender: 'Blender',
  stripe: 'Stripe',
  border: 'Border',
  coordinate: 'Coordinate',
  miniPattern: 'Mini Pattern',
  texture: 'Texture',
};

export type PatternTypeCounts = Record<CollectionPatternType, number>;

export interface RoadmapStep {
  order: number;
  patternType: CollectionPatternType | 'colorwayExpansion';
  label: string;
  count: number;
  estimatedHours: number;
}

export const COLLECTION_PLAN_SCHEMA_VERSION = 1;

export interface CollectionPlan {
  id: string;
  briefId: string;
  name: string;
  theme: string;
  totalSize: number;
  patternTypeCounts: PatternTypeCounts;
  colorwayCount: number;
  roadmap: RoadmapStep[];
  targetMarketplace: string;
  targetProducts: string[];
  createdAt: number;
  schemaVersion: number;
}

export class InvalidCollectionPlanInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCollectionPlanInputError';
  }
}

export interface CreateCollectionPlanInput {
  briefId: string;
  name: string;
  theme: string;
  totalSize: number;
  patternTypeCounts: PatternTypeCounts;
  colorwayCount?: number;
  roadmap?: RoadmapStep[];
  targetMarketplace?: string;
  targetProducts?: string[];
  now?: number;
}

export function createCollectionPlan(input: CreateCollectionPlanInput): CollectionPlan {
  if (!input.briefId.trim()) {
    throw new InvalidCollectionPlanInputError('briefId cannot be empty.');
  }
  if (!input.name.trim()) {
    throw new InvalidCollectionPlanInputError('name cannot be empty.');
  }
  const now = input.now ?? Date.now();
  return {
    id: collectionPlanId.generate(now),
    briefId: input.briefId,
    name: input.name,
    theme: input.theme,
    totalSize: input.totalSize,
    patternTypeCounts: input.patternTypeCounts,
    colorwayCount: input.colorwayCount ?? 3,
    roadmap: input.roadmap ?? [],
    targetMarketplace: input.targetMarketplace ?? '',
    targetProducts: input.targetProducts ?? [],
    createdAt: now,
    schemaVersion: COLLECTION_PLAN_SCHEMA_VERSION,
  };
}

export function isValidCollectionPlan(value: unknown): value is CollectionPlan {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<CollectionPlan>;
  return (
    typeof p.id === 'string' &&
    typeof p.briefId === 'string' &&
    typeof p.name === 'string' &&
    typeof p.totalSize === 'number' &&
    !!p.patternTypeCounts &&
    typeof p.createdAt === 'number'
  );
}
