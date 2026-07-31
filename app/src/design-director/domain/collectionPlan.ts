import { collectionPlanId, collectionPlanItemId } from '../../marketing/domain/id';

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

// Build 028C (Marketing to Creative Director Workflow), requirement #9 —
// individually-identified planned collection items. Prior to this build,
// `patternTypeCounts` only tracked COUNTS per pattern type; `items` expands
// each count into a real, addressable `CollectionPlanItem` so a Generator
// Handoff (and the `GeneratorHandoffLineage`/`GenerateParams.sourceLineage`
// it produces) can honestly reference a specific planned item instead of a
// permanently-null `collectionItemId`. Optional on `CollectionPlan` (not
// every plan created before this field existed has one) — `plan.items ?? []`
// is the correct read everywhere, never an assumed-present array.
export const COLLECTION_PLAN_ITEM_STATUS_VALUES = ['planned', 'handoffReady', 'generated'] as const;
export type CollectionPlanItemStatus = (typeof COLLECTION_PLAN_ITEM_STATUS_VALUES)[number];

export interface CollectionPlanItem {
  id: string;
  patternType: CollectionPatternType;
  /** 1-based position within this pattern type's own count (e.g. the 2nd
   * planned "hero" item), used only to build a stable human label — not a
   * global sequence across pattern types. */
  index: number;
  label: string;
  status: CollectionPlanItemStatus;
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
  /** See `CollectionPlanItem`'s own doc comment above — optional for
   * backward compatibility with plans created before Build 028C. */
  items?: CollectionPlanItem[];
  createdAt: number;
  schemaVersion: number;
}

function buildCollectionPlanItems(patternTypeCounts: PatternTypeCounts, now: number): CollectionPlanItem[] {
  const items: CollectionPlanItem[] = [];
  for (const patternType of COLLECTION_PATTERN_TYPE_VALUES) {
    const count = patternTypeCounts[patternType] ?? 0;
    for (let i = 1; i <= count; i++) {
      items.push({
        id: collectionPlanItemId.generate(now),
        patternType,
        index: i,
        label: `${COLLECTION_PATTERN_TYPE_LABELS[patternType]} #${i}`,
        status: 'planned',
      });
    }
  }
  return items;
}

/** Safe accessor — always use this (or `plan.items ?? []`) rather than
 * `plan.items` directly, so a pre-Build-028C plan with no `items` array
 * reads as "no items" instead of throwing. */
export function getCollectionPlanItems(plan: CollectionPlan): CollectionPlanItem[] {
  return plan.items ?? [];
}

export function getCollectionPlanItemById(plan: CollectionPlan, itemId: string): CollectionPlanItem | null {
  return getCollectionPlanItems(plan).find((i) => i.id === itemId) ?? null;
}

export function markCollectionPlanItemStatus(plan: CollectionPlan, itemId: string, status: CollectionPlanItemStatus): CollectionPlan {
  return {
    ...plan,
    items: getCollectionPlanItems(plan).map((i) => (i.id === itemId ? { ...i, status } : i)),
  };
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
  items?: CollectionPlanItem[];
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
    items: input.items ?? buildCollectionPlanItems(input.patternTypeCounts, now),
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
