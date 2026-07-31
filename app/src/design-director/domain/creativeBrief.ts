import { designBriefId } from '../../marketing/domain/id';
import { isValidEvidenceBand, type EvidenceBand } from '../../marketing/domain/evidence';

// Build 028B (AI Creative Director) — Module 1: Creative Brief. Persisted
// into the pre-provisioned `designBriefs` IndexedDB store (Build 028 Phase 2
// already created it with `status`/`sourceOpportunityId` indexes — this is
// the first domain module to actually read/write through it). Every
// AI-suggested field carries its own `fieldRationale` entry so the UI can
// always show "why" next to a recommended value, and every value stays
// user-editable after creation (this type has no read-only fields).

export const CREATIVE_BRIEF_STATUS_VALUES = ['DRAFT', 'APPROVED', 'IN_PLANNING', 'ARCHIVED'] as const;
export type CreativeBriefStatus = (typeof CREATIVE_BRIEF_STATUS_VALUES)[number];

export function isValidCreativeBriefStatus(value: unknown): value is CreativeBriefStatus {
  return typeof value === 'string' && (CREATIVE_BRIEF_STATUS_VALUES as readonly string[]).includes(value);
}

export const COMMERCIAL_PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'] as const;
export type CommercialPriority = (typeof COMMERCIAL_PRIORITY_VALUES)[number];

export const EXPECTED_DIFFICULTY_VALUES = ['easy', 'moderate', 'hard', 'very-hard'] as const;
export type ExpectedDifficulty = (typeof EXPECTED_DIFFICULTY_VALUES)[number];

export const CREATIVE_BRIEF_SCHEMA_VERSION = 1;

export interface CreativeBrief {
  id: string;
  sourceOpportunityId: string | null;
  collectionName: string;
  theme: string;
  targetMarketplace: string;
  targetProducts: string[];
  buyerPersona: string;
  heroStyle: string;
  secondaryAssets: string[];
  colorDirection: string[];
  commercialGoal: string;
  collectionSize: number;
  commercialPriority: CommercialPriority;
  expectedDifficulty: ExpectedDifficulty;
  estimatedTimeHours: number;
  commercialNotes: string;
  evidenceRefs: string[];
  /** field name -> human-readable reason, only for fields the AI populated
   * (a field the user typed by hand has no entry here, which is itself
   * informative — the UI treats "no rationale" as "user-authored"). */
  fieldRationale: Record<string, string>;
  confidence: EvidenceBand;
  status: CreativeBriefStatus;
  createdAt: number;
  schemaVersion: number;
}

export class InvalidCreativeBriefInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCreativeBriefInputError';
  }
}

export interface CreateCreativeBriefInput {
  collectionName: string;
  theme: string;
  sourceOpportunityId?: string | null;
  targetMarketplace?: string;
  targetProducts?: string[];
  buyerPersona?: string;
  heroStyle?: string;
  secondaryAssets?: string[];
  colorDirection?: string[];
  commercialGoal?: string;
  collectionSize?: number;
  commercialPriority?: CommercialPriority;
  expectedDifficulty?: ExpectedDifficulty;
  estimatedTimeHours?: number;
  commercialNotes?: string;
  evidenceRefs?: string[];
  fieldRationale?: Record<string, string>;
  confidence?: EvidenceBand;
  now?: number;
}

export function createCreativeBrief(input: CreateCreativeBriefInput): CreativeBrief {
  if (!input.collectionName.trim()) {
    throw new InvalidCreativeBriefInputError('collectionName cannot be empty.');
  }
  const now = input.now ?? Date.now();
  return {
    id: designBriefId.generate(now),
    sourceOpportunityId: input.sourceOpportunityId ?? null,
    collectionName: input.collectionName,
    theme: input.theme,
    targetMarketplace: input.targetMarketplace ?? '',
    targetProducts: input.targetProducts ?? [],
    buyerPersona: input.buyerPersona ?? '',
    heroStyle: input.heroStyle ?? '',
    secondaryAssets: input.secondaryAssets ?? [],
    colorDirection: input.colorDirection ?? [],
    commercialGoal: input.commercialGoal ?? '',
    collectionSize: input.collectionSize ?? 20,
    commercialPriority: input.commercialPriority ?? 'medium',
    expectedDifficulty: input.expectedDifficulty ?? 'moderate',
    estimatedTimeHours: input.estimatedTimeHours ?? 0,
    commercialNotes: input.commercialNotes ?? '',
    evidenceRefs: input.evidenceRefs ?? [],
    fieldRationale: input.fieldRationale ?? {},
    confidence: input.confidence ?? 'unknown',
    status: 'DRAFT',
    createdAt: now,
    schemaVersion: CREATIVE_BRIEF_SCHEMA_VERSION,
  };
}

export function transitionCreativeBriefStatus(brief: CreativeBrief, status: CreativeBriefStatus): CreativeBrief {
  if (!isValidCreativeBriefStatus(status)) {
    throw new InvalidCreativeBriefInputError(`Unknown status "${String(status)}".`);
  }
  return { ...brief, status };
}

export function isValidCreativeBrief(value: unknown): value is CreativeBrief {
  if (!value || typeof value !== 'object') return false;
  const b = value as Partial<CreativeBrief>;
  return (
    typeof b.id === 'string' &&
    typeof b.collectionName === 'string' &&
    typeof b.theme === 'string' &&
    isValidCreativeBriefStatus(b.status) &&
    isValidEvidenceBand(b.confidence) &&
    typeof b.createdAt === 'number'
  );
}
