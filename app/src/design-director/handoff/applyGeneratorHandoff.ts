import type { GenerateParams, GeneratorHandoffLineage, LayoutId } from '../../engine/types';
import type { CreativeBrief } from '../domain/creativeBrief';
import type { CollectionPlan } from '../domain/collectionPlan';
import type { GeneratorHandoff, HandoffScale } from '../domain/generatorHandoff';
import type { MarketOpportunity } from '../../marketing/domain/marketOpportunity';

// Build 028B Hardening — bridges a `GeneratorHandoff` (Module 11's own
// business-facing configuration) into the real editor's `GenerateParams`,
// for the "ส่งไปยังตัวสร้างลวดลาย" (Send to Pattern Generator) action.
// Deliberately conservative: only maps handoff fields that have a real,
// honest `GenerateParams` analog (`categoryId`, layout/composition,
// density, pattern scale, palette, seed) — fields with no real generator
// analog (hero/secondary motif NAMES, qualitative complexity, colorway
// plan, commercial notes) are reported as `unmappedNotes`, never forced
// onto an unrelated field, matching this build's "no fabricated data"
// rule.

export type HandoffFieldSource = 'marketOpportunity' | 'creativeBrief' | 'collectionPlan' | 'userOverride' | 'generatorDefault';

export interface MappedGeneratorField {
  /** The `GenerateParams` key this field writes to when applied. */
  key: string;
  label: string;
  value: unknown;
  displayValue: string;
  source: HandoffFieldSource;
  /** Always populated — the review screen's "why" for this exact value,
   * reusing `GeneratorHandoff.mappingRationale` where the handoff already
   * recorded one. */
  rationale: string;
}

export interface UnmappedHandoffNote {
  label: string;
  value: string;
  note: string;
}

export interface GeneratorHandoffApplication {
  mappedFields: MappedGeneratorField[];
  unmappedNotes: UnmappedHandoffNote[];
  lineage: GeneratorHandoffLineage;
}

const LAYOUT_BY_COMPOSITION: Record<string, LayoutId> = {
  grid: 'grid',
  'balanced-toss': 'toss',
  'layered-cluster': 'densePremium',
};

const PATTERN_SCALE_BY_HANDOFF_SCALE: Record<HandoffScale, number> = {
  small: 0.85,
  medium: 1,
  large: 1.25,
};

/** Builds the full review-screen model: every mappable field (with
 * provenance + rationale), every honestly-unmappable field (with a note
 * explaining why), and the traceability lineage record that will ride
 * along on the applied `GenerateParams` — pure and side-effect-free, so
 * the UI can render a review step before anything is actually applied to
 * the editor. */
export function buildGeneratorHandoffApplication(
  handoff: GeneratorHandoff,
  brief: CreativeBrief,
  plan: CollectionPlan,
  opportunity: MarketOpportunity | null,
): GeneratorHandoffApplication {
  const mappedFields: MappedGeneratorField[] = [];

  mappedFields.push({
    key: 'categoryId',
    label: 'Category',
    value: handoff.categoryId,
    displayValue: handoff.categoryId,
    source: 'creativeBrief',
    rationale: handoff.mappingRationale.categoryId ?? "Derived from the Creative Brief's theme.",
  });

  const layoutId = LAYOUT_BY_COMPOSITION[handoff.composition] ?? 'grid';
  mappedFields.push({
    key: 'layoutId',
    label: 'Composition / Layout',
    value: layoutId,
    displayValue: `${handoff.composition} → ${layoutId}`,
    source: 'collectionPlan',
    rationale: `Handoff composition "${handoff.composition}" (${handoff.mappingRationale.composition ?? "derived from the brief's expected difficulty"}) maps to the generator's "${layoutId}" layout — the closest real match among the 14 shipped layouts.`,
  });

  mappedFields.push({
    key: 'density',
    label: 'Density',
    value: handoff.density,
    displayValue: String(handoff.density),
    source: 'creativeBrief',
    rationale: handoff.mappingRationale.density ?? "Derived from the brief's expected difficulty.",
  });

  const patternScale = PATTERN_SCALE_BY_HANDOFF_SCALE[handoff.scale];
  mappedFields.push({
    key: 'patternScale',
    label: 'Scale',
    value: patternScale,
    displayValue: `${handoff.scale} → ${patternScale}x`,
    source: 'collectionPlan',
    rationale: handoff.mappingRationale.scale ?? "Derived from the plan's target products.",
  });

  if (handoff.palette.length > 0) {
    mappedFields.push({
      key: 'customColors',
      label: 'Palette',
      value: handoff.palette,
      displayValue: handoff.palette.join(', '),
      source: 'creativeBrief',
      rationale: handoff.mappingRationale.palette ?? 'Primary colorway plan from the Colorway Strategist (Module 9).',
    });
  }

  mappedFields.push({
    key: 'seed',
    label: 'Seed',
    value: handoff.seedStrategy,
    displayValue: handoff.seedStrategy,
    source: 'generatorDefault',
    rationale: 'Deterministic seed tied to this Collection Plan — regenerating from this handoff later reproduces the same pattern.',
  });

  const unmappedNotes: UnmappedHandoffNote[] = [
    {
      label: 'Hero motif',
      value: handoff.heroMotif,
      note: 'Reference only — the generator has no free-text "motif name" field; pick the closest real category/style manually.',
    },
    {
      label: 'Secondary motifs',
      value: handoff.secondaryMotifs.join(', ') || '—',
      note: 'Reference only — same reason as Hero motif above.',
    },
    {
      label: 'Complexity',
      value: handoff.complexity,
      note: 'Reference only — no exact generator field; use as a guide for manual detail-level tuning after applying.',
    },
    {
      label: 'Spacing',
      value: handoff.spacing,
      note: 'Informational only — already reflected in the Density value above (spacing is derived FROM density by the handoff builder, not a separate generator field).',
    },
    {
      label: 'Colorway plan',
      value: handoff.colorwayPlan.join(', ') || '—',
      note: "Reference only — use this app's existing Colorway Batch feature to generate these variants once the hero pattern above is created.",
    },
    {
      label: 'Commercial notes',
      value: handoff.commercialNotes || '—',
      note: 'Reference only — for the designer\'s awareness; no generator field corresponds to free-text commercial notes.',
    },
  ];

  const lineage: GeneratorHandoffLineage = {
    marketSnapshotId: opportunity?.snapshotId ?? null,
    marketOpportunityId: opportunity?.id ?? brief.sourceOpportunityId ?? null,
    designBriefId: brief.id,
    collectionPlanId: plan.id,
    // Build 028C — real per-item id when the handoff was configured for a
    // specific CollectionPlanItem (see collectionPlan.ts); still honestly
    // null for a handoff that isn't tied to one exact planned item (e.g.
    // every handoff created before Build 028C).
    collectionItemId: handoff.collectionItemId ?? null,
    generatorHandoffId: handoff.id,
    generatorVersion: handoff.generatorVersion,
    seed: handoff.seedStrategy,
    appliedAt: Date.now(),
  };

  return { mappedFields, unmappedNotes, lineage };
}

/** Applies only the CALLER-SELECTED subset of `mappedFields` onto `base`
 * (the current editor params) — any field the reviewer excluded (a
 * "locked" field in the review screen) is simply absent from `fields` and
 * therefore never touches `base`'s existing value for that key. The
 * traceability `lineage` is always attached, since it's provenance
 * metadata about how this generation came to be, not a generator setting
 * a user would want to "lock" against. */
export function applyMappedFieldsToParams(base: GenerateParams, fields: MappedGeneratorField[], lineage: GeneratorHandoffLineage): GenerateParams {
  const patch: Record<string, unknown> = {};
  for (const field of fields) patch[field.key] = field.value;
  return { ...base, ...patch, sourceLineage: lineage } as GenerateParams;
}
