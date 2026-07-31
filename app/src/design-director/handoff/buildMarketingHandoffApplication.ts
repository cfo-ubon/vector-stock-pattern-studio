import type { MarketOpportunity } from '../../marketing/domain/marketOpportunity';
import type { MarketSnapshot } from '../../marketing/domain/marketSnapshot';
import type { DailyMission } from '../../marketing/domain/dailyMission';
import type { MarketKeyword } from '../../marketing/domain/marketKeyword';
import type { EvidenceBand } from '../../marketing/domain/evidence';
import type { CreateMarketingDesignHandoffInput } from '../domain/marketingDesignHandoff';
import type { CreateCreativeBriefInput } from '../domain/creativeBrief';

// Build 028C (Marketing to Creative Director Workflow) — bridges a
// Marketing Intelligence record (a Market Opportunity, optionally with its
// Daily Mission and Market Snapshot, OR a Market Gap Finder keyword when
// there is no opportunity yet) into the review-screen model for
// "ส่งให้นักออกแบบ / Send to Creative Director". Mirrors the established
// `applyGeneratorHandoff.ts` pattern (Build 028B Hardening): a pure builder
// produces every field with its provenance, then a separate pure "apply"
// step turns the reviewer-approved subset into real domain inputs — no
// side effects, no persistence, until the caller explicitly applies it.
//
// Requirement #7/#8's three-tier missing-data semantics:
//   - 'notProvided'         — the source data simply has no value here
//                              (e.g. no Daily Mission exists at all, so
//                              mission-only evidence fields like palette
//                              are honestly absent).
//   - 'needsUserDecision'   — this field is inherently a creative judgment
//                              call (hero motif, composition, buyer
//                              persona) that no amount of market evidence
//                              alone can answer — flagged distinctly from
//                              "not provided" so the review screen can
//                              explain WHY a human must decide.
//   - 'notSupportedByEvidence' — a value exists, but its confidence band is
//                              too low ('unknown'/'very-low') to trust
//                              without verification.
//   - 'provided'            — a real, evidence-backed value.

export type MarketingHandoffFieldSource = 'marketOpportunity' | 'marketSnapshot' | 'dailyMission' | 'marketGap' | 'userOverride' | 'generatorDefault';

export type MarketingHandoffFieldStatus = 'provided' | 'needsUserDecision' | 'notSupportedByEvidence' | 'notProvided';

export interface MarketingHandoffField {
  key: string;
  label: string;
  value: unknown;
  displayValue: string;
  source: MarketingHandoffFieldSource;
  confidence: EvidenceBand;
  evidence: string[];
  status: MarketingHandoffFieldStatus;
  /** Review-screen "lock" state — locked (true) means this field is
   * excluded from the eventual Creative Brief draft / MarketingDesignHandoff
   * record (left at its generator/brief default instead), mirroring the
   * Generator Handoff review screen's checkbox convention exactly (default
   * unlocked = apply). */
  locked: boolean;
}

export interface MarketingHandoffApplication {
  fields: MarketingHandoffField[];
  /** The subset of fields that live directly on `MarketingDesignHandoff`
   * itself (requirement #2's preserved provenance) — always the full,
   * un-excluded values; `buildMarketingDesignHandoffInput` below is what
   * actually respects locked/edited fields. */
  handoffSeed: Omit<CreateMarketingDesignHandoffInput, 'now'>;
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

function evidenceGradedStatus(value: unknown, confidence: EvidenceBand, whenEmpty: MarketingHandoffFieldStatus = 'notProvided'): MarketingHandoffFieldStatus {
  if (isEmptyValue(value)) return whenEmpty;
  if (confidence === 'unknown' || confidence === 'very-low') return 'notSupportedByEvidence';
  return 'provided';
}

/** The real workflow entry point: Market Opportunity (+ its Market
 * Snapshot, when known, + a Daily Mission, when one exists for this
 * opportunity) -> the full review-screen field list. `mission` is
 * genuinely optional — many opportunities are sent to the Creative
 * Director directly from Opportunity Explorer, before any Daily Mission
 * was ever generated for them — and every mission-only field (hero motif,
 * composition, buyer persona, target products) is honestly reported as
 * missing rather than guessed when it is absent. */
export function buildMarketingHandoffApplication(
  opportunity: MarketOpportunity,
  snapshot: MarketSnapshot | null,
  mission: DailyMission | null,
): MarketingHandoffApplication {
  const evidence = opportunity.evidenceRefs;
  const opportunityConfidence = opportunity.score.confidence;
  const missionConfidence = mission?.confidence ?? 'unknown';

  const targetProducts = mission?.productUseCases ?? [];
  const heroMotif = mission?.heroMotif || null;
  const composition = mission?.composition || null;
  const palette = mission && mission.colorDirection.length > 0 ? mission.colorDirection : (snapshot?.colors ?? []);
  const paletteSource: MarketingHandoffFieldSource = mission && mission.colorDirection.length > 0 ? 'dailyMission' : snapshot && snapshot.colors.length > 0 ? 'marketSnapshot' : 'generatorDefault';
  const paletteConfidence = mission && mission.colorDirection.length > 0 ? missionConfidence : (snapshot?.confidence ?? 'unknown');
  const productionTiming = mission?.submissionTiming || null;
  const buyerPersona = mission?.buyerGroup || null;

  const fields: MarketingHandoffField[] = [
    {
      key: 'theme',
      label: 'Recommended Theme',
      value: opportunity.theme,
      displayValue: opportunity.theme,
      source: 'marketOpportunity',
      confidence: opportunityConfidence,
      evidence,
      status: evidenceGradedStatus(opportunity.theme, opportunityConfidence),
      locked: false,
    },
    {
      key: 'collectionName',
      label: 'Collection Name',
      value: opportunity.title,
      displayValue: opportunity.title,
      source: 'marketOpportunity',
      confidence: opportunityConfidence,
      evidence,
      status: evidenceGradedStatus(opportunity.title, opportunityConfidence),
      locked: false,
    },
    {
      key: 'targetMarketplace',
      label: 'Target Marketplace',
      value: opportunity.marketplace,
      displayValue: opportunity.marketplace,
      source: 'marketOpportunity',
      confidence: opportunityConfidence,
      evidence,
      status: evidenceGradedStatus(opportunity.marketplace, opportunityConfidence),
      locked: false,
    },
    {
      key: 'targetProducts',
      label: 'Target Products',
      value: targetProducts,
      displayValue: targetProducts.join(', ') || '—',
      source: mission ? 'dailyMission' : 'generatorDefault',
      confidence: missionConfidence,
      evidence,
      status: mission ? evidenceGradedStatus(targetProducts, missionConfidence) : 'notProvided',
      locked: false,
    },
    {
      key: 'heroMotif',
      label: 'Hero Motif',
      value: heroMotif,
      displayValue: heroMotif ?? '—',
      source: mission ? 'dailyMission' : 'generatorDefault',
      confidence: missionConfidence,
      evidence,
      // No mission -> a hero motif has no market-evidence source at all;
      // it is a creative decision the designer must make, not merely
      // "absent data" -> 'needsUserDecision', not 'notProvided'.
      status: mission ? evidenceGradedStatus(heroMotif, missionConfidence, 'needsUserDecision') : 'needsUserDecision',
      locked: false,
    },
    {
      key: 'composition',
      label: 'Composition',
      value: composition,
      displayValue: composition ?? '—',
      source: mission ? 'dailyMission' : 'generatorDefault',
      confidence: missionConfidence,
      evidence,
      status: mission ? evidenceGradedStatus(composition, missionConfidence, 'needsUserDecision') : 'needsUserDecision',
      locked: false,
    },
    {
      key: 'palette',
      label: 'Palette',
      value: palette,
      displayValue: palette.join(', ') || '—',
      source: paletteSource,
      confidence: paletteConfidence,
      evidence,
      status: evidenceGradedStatus(palette, paletteConfidence),
      locked: false,
    },
    {
      key: 'productionTiming',
      label: 'Production Timing',
      value: productionTiming,
      displayValue: productionTiming ?? '—',
      source: mission ? 'dailyMission' : 'generatorDefault',
      confidence: missionConfidence,
      evidence,
      status: mission ? evidenceGradedStatus(productionTiming, missionConfidence) : 'notProvided',
      locked: false,
    },
    {
      key: 'buyerPersona',
      label: 'Buyer Persona',
      value: buyerPersona,
      displayValue: buyerPersona ?? '—',
      source: mission ? 'dailyMission' : 'generatorDefault',
      confidence: missionConfidence,
      evidence,
      status: mission ? evidenceGradedStatus(buyerPersona, missionConfidence) : 'notProvided',
      locked: false,
    },
  ];

  const handoffSeed: Omit<CreateMarketingDesignHandoffInput, 'now'> = {
    marketSnapshotId: opportunity.snapshotId ?? snapshot?.id ?? null,
    marketOpportunityId: opportunity.id,
    dailyMissionId: mission?.id ?? null,
    evidenceRefs: evidence,
    opportunityScore: opportunity.score.overall,
    confidence: opportunityConfidence,
    dataFreshness: snapshot?.dataFreshness ?? 'unknown',
    targetMarketplace: opportunity.marketplace,
    targetProducts,
    recommendedTheme: opportunity.theme,
    heroMotif,
    composition,
    palette,
    productionTiming,
  };

  return { fields, handoffSeed };
}

/** Market Gap Finder's entry point — a `MarketGap` (see
 * `marketing/gap/marketGapFinder.ts`) is a live, computed object with no
 * persisted id of its own; the caller resolves it back to the real
 * `MarketKeyword` record it was computed from (matching on
 * `MarketKeyword.keyword`) and passes that in here instead. There is no
 * Market Opportunity yet at this point in the workflow (that is exactly
 * the gap this button closes — "no opportunity currently covers this
 * keyword"), so `marketOpportunityId` is honestly `null` and every
 * opportunity-derived field falls back to 'needsUserDecision'/'notProvided'
 * rather than being guessed. */
export function buildMarketingHandoffApplicationFromGap(keyword: MarketKeyword): MarketingHandoffApplication {
  const evidence = [`evidenceSource: ${keyword.evidenceSource}`, `competitionEstimate: ${keyword.competitionEstimate}`];
  const confidence = keyword.confidence;
  const theme = keyword.parentTheme || keyword.keyword;

  const fields: MarketingHandoffField[] = [
    {
      key: 'theme',
      label: 'Recommended Theme',
      value: theme,
      displayValue: theme,
      source: 'marketGap',
      confidence,
      evidence,
      status: evidenceGradedStatus(theme, confidence),
      locked: false,
    },
    {
      key: 'collectionName',
      label: 'Collection Name',
      value: null,
      displayValue: '—',
      source: 'generatorDefault',
      confidence: 'unknown',
      evidence,
      status: 'needsUserDecision',
      locked: false,
    },
    {
      key: 'targetMarketplace',
      label: 'Target Marketplace',
      value: keyword.marketplace,
      displayValue: keyword.marketplace ?? '—',
      source: keyword.marketplace ? 'marketGap' : 'generatorDefault',
      confidence,
      evidence,
      status: evidenceGradedStatus(keyword.marketplace, confidence),
      locked: false,
    },
    {
      key: 'targetProducts',
      label: 'Target Products',
      value: keyword.productRelevance,
      displayValue: keyword.productRelevance.join(', ') || '—',
      source: keyword.productRelevance.length > 0 ? 'marketGap' : 'generatorDefault',
      confidence,
      evidence,
      status: evidenceGradedStatus(keyword.productRelevance, confidence),
      locked: false,
    },
    {
      key: 'heroMotif',
      label: 'Hero Motif',
      value: null,
      displayValue: '—',
      source: 'generatorDefault',
      confidence: 'unknown',
      evidence,
      status: 'needsUserDecision',
      locked: false,
    },
    {
      key: 'composition',
      label: 'Composition',
      value: null,
      displayValue: '—',
      source: 'generatorDefault',
      confidence: 'unknown',
      evidence,
      status: 'needsUserDecision',
      locked: false,
    },
    {
      key: 'palette',
      label: 'Palette',
      value: [],
      displayValue: '—',
      source: 'generatorDefault',
      confidence: 'unknown',
      evidence,
      status: 'notProvided',
      locked: false,
    },
    {
      key: 'productionTiming',
      label: 'Production Timing',
      value: keyword.seasonalRelevance || null,
      displayValue: keyword.seasonalRelevance || '—',
      source: keyword.seasonalRelevance ? 'marketGap' : 'generatorDefault',
      confidence,
      evidence,
      status: evidenceGradedStatus(keyword.seasonalRelevance || null, confidence),
      locked: false,
    },
    {
      key: 'buyerPersona',
      label: 'Buyer Persona',
      value: null,
      displayValue: '—',
      source: 'generatorDefault',
      confidence: 'unknown',
      evidence,
      status: 'needsUserDecision',
      locked: false,
    },
  ];

  const handoffSeed: Omit<CreateMarketingDesignHandoffInput, 'now'> = {
    marketSnapshotId: null,
    marketOpportunityId: null,
    dailyMissionId: null,
    evidenceRefs: evidence,
    opportunityScore: null,
    confidence,
    dataFreshness: 'unknown',
    targetMarketplace: keyword.marketplace ?? '',
    targetProducts: keyword.productRelevance,
    recommendedTheme: theme,
    heroMotif: null,
    composition: null,
    palette: [],
    productionTiming: keyword.seasonalRelevance || null,
  };

  return { fields, handoffSeed };
}

function fieldValue(fields: MarketingHandoffField[], key: string): unknown {
  const field = fields.find((f) => f.key === key);
  return field && !field.locked ? field.value : undefined;
}

/** Turns the reviewer-approved (possibly edited, possibly locked-out)
 * field list into the real `MarketingDesignHandoff` creation input —
 * requirement #6's "missing-information detection" surfaces here as
 * `unresolvedFieldKeys`: every included field whose status was not
 * 'provided' at review time, so the record honestly remembers what still
 * needs verification even after the user has moved on. */
export function buildMarketingDesignHandoffInput(
  fields: MarketingHandoffField[],
  seed: MarketingHandoffApplication['handoffSeed'],
): CreateMarketingDesignHandoffInput {
  const unresolvedFieldKeys = fields.filter((f) => f.status !== 'provided' && !f.locked).map((f) => f.key);
  return {
    marketSnapshotId: seed.marketSnapshotId,
    marketOpportunityId: seed.marketOpportunityId,
    dailyMissionId: seed.dailyMissionId,
    evidenceRefs: seed.evidenceRefs,
    opportunityScore: seed.opportunityScore,
    confidence: seed.confidence,
    dataFreshness: seed.dataFreshness,
    targetMarketplace: (fieldValue(fields, 'targetMarketplace') as string | undefined) ?? seed.targetMarketplace,
    targetProducts: (fieldValue(fields, 'targetProducts') as string[] | undefined) ?? seed.targetProducts,
    recommendedTheme: (fieldValue(fields, 'theme') as string | undefined) ?? seed.recommendedTheme,
    heroMotif: (fieldValue(fields, 'heroMotif') as string | null | undefined) ?? seed.heroMotif,
    composition: (fieldValue(fields, 'composition') as string | null | undefined) ?? seed.composition,
    palette: (fieldValue(fields, 'palette') as string[] | undefined) ?? seed.palette,
    productionTiming: (fieldValue(fields, 'productionTiming') as string | null | undefined) ?? seed.productionTiming,
    unresolvedFieldKeys,
  };
}

/** Requirement #3 — automatically create a Creative Brief DRAFT from the
 * reviewer-approved field list. Locked-out fields fall back to
 * `createCreativeBrief`'s own neutral defaults (empty string/array) exactly
 * as `buildCreativeBriefFromOpportunity` already does for fields with no
 * real signal — never fabricated. */
export function buildCreativeBriefDraftInput(fields: MarketingHandoffField[], marketOpportunityId: string | null, confidence: EvidenceBand): CreateCreativeBriefInput {
  const theme = (fieldValue(fields, 'theme') as string | undefined) ?? '';
  const collectionNameField = fieldValue(fields, 'collectionName') as string | undefined;
  const collectionName = collectionNameField || theme || 'Untitled Collection';
  const evidenceRefs = fields.find((f) => f.key === 'theme')?.evidence ?? [];
  return {
    sourceOpportunityId: marketOpportunityId,
    collectionName,
    theme,
    targetMarketplace: (fieldValue(fields, 'targetMarketplace') as string | undefined) ?? '',
    targetProducts: (fieldValue(fields, 'targetProducts') as string[] | undefined) ?? [],
    buyerPersona: (fieldValue(fields, 'buyerPersona') as string | undefined) ?? '',
    heroStyle: (fieldValue(fields, 'heroMotif') as string | undefined) ?? '',
    colorDirection: (fieldValue(fields, 'palette') as string[] | undefined) ?? [],
    commercialGoal: `Capture the "${collectionName}" opportunity via the AI Creative Director's Marketing Handoff.`,
    evidenceRefs,
    confidence,
  };
}
