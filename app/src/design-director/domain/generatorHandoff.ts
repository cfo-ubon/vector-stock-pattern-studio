import { designConfigurationId } from '../../marketing/domain/id';
import type { CollectionPatternType } from './collectionPlan';

// Build 028B — Module 11: Generator Handoff. Persisted into the
// pre-provisioned `designConfigurations` IndexedDB store (Build 028 Phase 2
// created it with a `briefId` index — matched exactly here). This is the
// final, concrete, generator-ready configuration the Collection Plan and
// Creative Brief resolve into; every field that was AI-derived (rather than
// user-typed) has a matching `mappingRationale` entry so the handoff stays
// auditable, per the module's "audited mapping" requirement.

export const HANDOFF_SCALE_VALUES = ['small', 'medium', 'large'] as const;
export type HandoffScale = (typeof HANDOFF_SCALE_VALUES)[number];

export const HANDOFF_SPACING_VALUES = ['tight', 'balanced', 'airy'] as const;
export type HandoffSpacing = (typeof HANDOFF_SPACING_VALUES)[number];

export const HANDOFF_COMPLEXITY_VALUES = ['simple', 'moderate', 'intricate'] as const;
export type HandoffComplexity = (typeof HANDOFF_COMPLEXITY_VALUES)[number];

export const GENERATOR_HANDOFF_SCHEMA_VERSION = 1;

export interface GeneratorHandoff {
  id: string;
  briefId: string;
  collectionPlanId: string;
  heroMotif: string;
  secondaryMotifs: string[];
  patternType: CollectionPatternType;
  categoryId: string;
  composition: string;
  density: number;
  scale: HandoffScale;
  palette: string[];
  colorwayPlan: string[];
  spacing: HandoffSpacing;
  complexity: HandoffComplexity;
  commercialNotes: string;
  generatorVersion: string;
  seedStrategy: string;
  mappingRationale: Record<string, string>;
  createdAt: number;
  schemaVersion: number;
}

export class InvalidGeneratorHandoffInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidGeneratorHandoffInputError';
  }
}

export interface CreateGeneratorHandoffInput {
  briefId: string;
  collectionPlanId: string;
  heroMotif: string;
  categoryId: string;
  secondaryMotifs?: string[];
  patternType?: CollectionPatternType;
  composition?: string;
  density?: number;
  scale?: HandoffScale;
  palette?: string[];
  colorwayPlan?: string[];
  spacing?: HandoffSpacing;
  complexity?: HandoffComplexity;
  commercialNotes?: string;
  generatorVersion?: string;
  seedStrategy?: string;
  mappingRationale?: Record<string, string>;
  now?: number;
}

export function createGeneratorHandoff(input: CreateGeneratorHandoffInput): GeneratorHandoff {
  if (!input.briefId.trim()) {
    throw new InvalidGeneratorHandoffInputError('briefId cannot be empty.');
  }
  if (!input.collectionPlanId.trim()) {
    throw new InvalidGeneratorHandoffInputError('collectionPlanId cannot be empty.');
  }
  const now = input.now ?? Date.now();
  return {
    id: designConfigurationId.generate(now),
    briefId: input.briefId,
    collectionPlanId: input.collectionPlanId,
    heroMotif: input.heroMotif,
    secondaryMotifs: input.secondaryMotifs ?? [],
    patternType: input.patternType ?? 'hero',
    categoryId: input.categoryId,
    composition: input.composition ?? '',
    density: input.density ?? 0.5,
    scale: input.scale ?? 'medium',
    palette: input.palette ?? [],
    colorwayPlan: input.colorwayPlan ?? [],
    spacing: input.spacing ?? 'balanced',
    complexity: input.complexity ?? 'moderate',
    commercialNotes: input.commercialNotes ?? '',
    generatorVersion: input.generatorVersion ?? 'v1',
    seedStrategy: input.seedStrategy ?? `collection-${input.collectionPlanId}`,
    mappingRationale: input.mappingRationale ?? {},
    createdAt: now,
    schemaVersion: GENERATOR_HANDOFF_SCHEMA_VERSION,
  };
}

export function isValidGeneratorHandoff(value: unknown): value is GeneratorHandoff {
  if (!value || typeof value !== 'object') return false;
  const h = value as Partial<GeneratorHandoff>;
  return (
    typeof h.id === 'string' &&
    typeof h.briefId === 'string' &&
    typeof h.collectionPlanId === 'string' &&
    typeof h.heroMotif === 'string' &&
    typeof h.categoryId === 'string' &&
    typeof h.createdAt === 'number'
  );
}
