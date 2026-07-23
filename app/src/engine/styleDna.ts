import type { GenerateParams, LayoutId } from './types';
import type { CompositionZone } from './compositionZones';
import { mapCompositionZoneToEyeFlow } from './eyeFlowEngine';
import { ASYMMETRY_DIRECTIONS } from './compositionIntelligence';
import type { ClusterArchetype } from './clusterEngine';
import { HIERARCHY_PRESETS } from './hierarchy';
import { applyCompositionEnvelope } from './compositionEnvelopes';
import { GENERATORS } from '../generators';
import { GROWTH_PRESETS } from '../generators/growth';
import type { BotanicalFamily } from '../generators/botanicalFamilies';
import { speciesForUsageProfile } from '../generators/botanicalFamilies';
import type { UsageProfileId } from '../knowledge/registry/speciesSchema';
import { createRng, randomSeed } from './rng';
import type { StockSiteId } from '../metadata/shutterstock';
import type { ProductUseId } from '../collection/productTargets';
import { computeDesignKnowledgeProfile, resolveDesignRules } from './designKnowledge';
import { weightedPickPreferred } from './designerBrain';
import { KnowledgeRegistry } from '../knowledge/registry';

// Style DNA Engine — turns "category + layout + palette + density + hierarchy
// + flow + overlap + cluster" (a dozen separate manual choices) into ONE
// choice: a named design identity. Every Style DNA is plain structured data
// (no if-else branching over style names anywhere in this file) resolved by
// one generic function, `resolveStyleDna`, the same architectural pattern
// engine/artDirection.ts and engine/trendEngine.ts already established —
// this just carries a much richer field set and adds a first-class Manager
// (create/duplicate/rename/delete/export/import/favorite, see
// storage/styleDnaStore.ts).
//
// Scope note: `botanicalGrowthPreset` is stored/round-tripped as a reserved,
// informational field — it does not yet steer which botanical shape variant
// is drawn (that requires a hook into generators/botanical.ts no phase has
// built yet). `clusterStyle`/`clusterDensity` previously had the same
// reserved status (this comment used to say the Cluster Engine "doesn't
// exist yet"), but Project Phoenix V2 shipped a real one
// (`engine/clusterEngine.ts`) and Composition Intelligence Foundation V2
// (Build 001) connected it here: `clusterStyle`/`clusterDensity` now also
// drive real Pattern Physics attraction strength (Section 8,
// `engine/patternPhysics.ts`) on top of the balance-correction proxy they
// already fed — see `CLUSTER_ATTRACTION_STRENGTH` below. `flowProfile` used
// to only resolve to `rotationJitter` (spin, not placement); it now also
// drives `compositionIntelligence.flowBiasStrength` (Section 5, a real
// placement bias — see `FLOW_BIAS_STRENGTH` below). Every other field maps
// to a real, already-implemented engine parameter and visibly changes the
// generated SVG.

export const STYLE_DNA_SCHEMA_VERSION = 1;

export type OverlapMode = 'none' | 'subtle' | 'natural' | 'dense';
export type FlowProfile = 'calm' | 'directional' | 'dynamic';
export type RhythmProfile = 'regular' | 'organic' | 'syncopated';
export type ClusterStyle = 'none' | 'loose' | 'tight' | 'bouquet';
export type MotifComplexity = 'simple' | 'moderate' | 'intricate';
export type ColorStrategy = 'dominantDuo' | 'fullPalette' | 'monochromeAccent' | 'highContrast';
export type BackgroundStrategy = 'minimalLight' | 'richContrast' | 'darkMoody' | 'neutralPaper';
export type SvgDepthMode = 'flat' | 'soft' | 'dimensional';

export interface StyleDnaExportRecommendation {
  tileSize: number;
  patternScale: number;
  /** Site ids matching the app's own per-site SEO panel (metadata/*.ts) —
   * never invented names outside what the app actually supports. */
  recommendedSites: StockSiteId[];
  /** Build 005, Section 8 (Commercial Knowledge architecture): which of
   * the app's own 10 named Product Uses (collection/productTargets.ts —
   * the same real, rule-based taxonomy `evaluateProductTargets` already
   * scores collections against) this style's own declared design
   * identity is curated toward, first = best fit. Architecture only, per
   * the brief — a hand-authored editorial judgment matching each style's
   * own description, the same convention `recommendedSites` already
   * established, not a computed/measured score (no scoring loop exists
   * yet; wiring `evaluateProductTargets` itself against a style's
   * generated output is future work, not this section's). */
  bestProductTargets?: ProductUseId[];
}

export interface StyleDna {
  id: string;
  label: string;
  description: string;
  /** True for user-created/duplicated styles; absent (not false) on every
   * built-in preset so `Object.keys` / JSON diffing treats them the same way
   * `cloneParams`'s other optional fields do. */
  custom?: true;
  /** Preferred categories, first = primary/default. */
  categories: string[];
  /** Preferred layouts, first = primary/default. */
  layouts: LayoutId[];
  /** Build 003, Part 7 (Style Grammar): the composition zones (see
   * engine/compositionZones.ts) this style's own "design language" tends
   * toward, first = primary/default — same `pickPreferred` mechanism as
   * `categories`/`layouts`/`paletteIds`. Optional and omittable: a style
   * with no particular compositional identity just leaves every
   * zone-picking layout on its existing random pick. */
  preferredZones?: CompositionZone[];
  /** Build 004, Section 9 (Style DNA botanical grammar): the Botanical
   * Families (see generators/botanicalFamilies.ts) this style's own
   * botanical vocabulary draws from — same `pickPreferred` mechanism as
   * `categories`/`layouts`/`paletteIds`/`preferredZones`. Only meaningful
   * for a style whose `categories` includes `'botanical'` (every other
   * generator ignores the resolved family hint); omitted for non-botanical
   * styles rather than set to a value nothing ever reads. */
  preferredFamilies?: BotanicalFamily[];
  /** Build 004, Section 9: this style's own cluster-archetype preference,
   * passed straight through (as a pool, not narrowed to one pick — see
   * GenerateParams.clusterArchetypes) to whichever cluster-based layout the
   * style resolves to. Only meaningful for a style whose `layouts` include
   * a cluster-aware layout that actually consults it (`scatter`,
   * `heroScatter` — see LAYOUT_CLUSTER_ARCHETYPES in knowledge/composition);
   * `bouquet`/`airy`'s own archetype IS their identity and is deliberately
   * never overridden. */
  preferredClusterArchetypes?: ClusterArchetype[];
  /** Build 004, Section 9 (Premium Hero Builder): true for a style whose
   * own "design language" wants a hero built as a full multi-part bouquet
   * (generators/premiumHero.ts) rather than one independent variant.
   * Deliberately false/omitted for styles the brief explicitly describes
   * as spare/minimal (Minimal Botanical's "simple silhouettes, few
   * elements") or non-botanical (the hero's active generator has to be the
   * botanical one for this to have any effect at all). */
  premiumHero?: boolean;
  /** Named hierarchy profile — references the existing HIERARCHY_PRESETS
   * table (hero/secondary/filler/accent ratios + scales) instead of
   * duplicating those 8 numbers per style. */
  hierarchyPreset: keyof typeof HIERARCHY_PRESETS;
  density: number;
  negativeSpace: number;
  overlapMode: OverlapMode;
  overlapAmount: number;
  flowProfile: FlowProfile;
  rhythmProfile: RhythmProfile;
  clusterStyle: ClusterStyle;
  clusterDensity: number;
  motifComplexity: MotifComplexity;
  /** Reserved for Phase 4 Botanical Geometry — see module note above. */
  botanicalGrowthPreset?: keyof typeof GROWTH_PRESETS;
  colorStrategy: ColorStrategy;
  /** Preferred palettes, first = primary/default. */
  paletteIds: string[];
  backgroundStrategy: BackgroundStrategy;
  svgDepthMode: SvgDepthMode;
  exportRecommendation: StyleDnaExportRecommendation;
  /** Build 011, Section 7 (Commercial Trend Engine): the `TREND_PRESETS`
   * (`trendEngine.ts`) id this style structurally corresponds to, when one
   * genuinely does — set only for the honest close/exact matches
   * identified by BUILD_011_AUDIT.md §7 (`darkBotanical`→
   * `darkAcademiaBotanical`, `minimalBotanical`→`cleanScandiMinimal`,
   * `vintageHerbarium`→`vintageBotanical`), never a forced pairing. Lets
   * `computeTrendFit`'s real signature-matching apply to a Style-DNA-
   * originated tile without merging the two resolution mechanisms.
   * Omitted for every style with no genuine structural counterpart. */
  trendPresetId?: string;
}

// Exported (not just module-private) so other modules that resolve a
// FlowProfile/RhythmProfile into a concrete number — e.g. trend/
// designIntelligence.ts's Design Specification builder — reuse these same
// values instead of maintaining a second copy that could drift.
export const FLOW_ROTATION_JITTER: Record<FlowProfile, number> = { calm: 8, directional: 15, dynamic: 30 };
const COMPLEXITY_SCALE_JITTER: Record<MotifComplexity, number> = { simple: 0.08, moderate: 0.15, intricate: 0.25 };
const COMPLEXITY_ROTATION_BUMP: Record<MotifComplexity, number> = { simple: 0, moderate: 4, intricate: 10 };
const COMPLEXITY_COLOR_COUNT: Record<MotifComplexity, number> = { simple: 3, moderate: 4, intricate: 5 };
export const RHYTHM_STRENGTH: Record<RhythmProfile, number> = { regular: 0.15, organic: 0.4, syncopated: 0.6 };
const CLUSTER_BALANCE_STRENGTH: Record<ClusterStyle, number> = { none: 0.6, loose: 0.5, tight: 0.25, bouquet: 0.2 };
// Composition Intelligence Foundation V2 (Build 001) — real Pattern
// Physics (Section 8) strength per cluster style: a "bouquet"/"tight"
// identity means members should read as pulled toward their hero, so
// attraction is strongest there; "none" still gets a small baseline pull
// (isolated decorative objects are never the goal) rather than 0.
const CLUSTER_ATTRACTION_STRENGTH: Record<ClusterStyle, number> = { none: 0.2, loose: 0.35, tight: 0.55, bouquet: 0.6 };
// Real Flow Engine (Section 5) placement-bias strength per flow profile —
// "calm" resolves to 0 regardless (applyFlowBias treats profile 'calm' as
// a no-op anyway; the 0 here just keeps this table self-documenting).
const FLOW_BIAS_STRENGTH: Record<FlowProfile, number> = { calm: 0, directional: 0.3, dynamic: 0.4 };
const COLOR_STRATEGY_STORY: Record<ColorStrategy, boolean> = {
  dominantDuo: true,
  fullPalette: false,
  monochromeAccent: true,
  highContrast: true,
};
const COLOR_STRATEGY_COUNT: Record<ColorStrategy, number> = {
  dominantDuo: 4,
  fullPalette: 6,
  monochromeAccent: 2,
  highContrast: 5,
};
const BACKGROUND_FILLER: Record<BackgroundStrategy, 'none' | 'subtle' | 'rich'> = {
  minimalLight: 'none',
  richContrast: 'rich',
  darkMoody: 'subtle',
  neutralPaper: 'subtle',
};
const DEPTH_SHADOW: Record<SvgDepthMode, { flatShadow: boolean; flatHighlight: boolean }> = {
  flat: { flatShadow: false, flatHighlight: false },
  soft: { flatShadow: false, flatHighlight: true },
  dimensional: { flatShadow: true, flatHighlight: true },
};

// Build 008A, Section 5 (Knowledge Loader): the 15 built-in presets used
// to be a hardcoded object literal here (~165 lines). They now live as
// real, editable, versioned JSON (`knowledge/registry/data/styles/*.json`)
// loaded, schema-validated, and cached by `KnowledgeRegistry` — this is
// the one subsystem this build migrates (see BUILD_008A_AUDIT.md for the
// full audit of what else is/isn't touched). `STYLE_DNA_LIST`'s order
// matches the Registry's own load order, which matches this file's
// original literal's declaration order, so every existing
// `Object.values`/array-index-based consumer sees the identical ordering
// it always has. A malformed/incompatible knowledge load throws a real,
// readable `KnowledgeValidationError` at import time (Section 6) rather
// than silently producing an empty or partial preset list.
export const STYLE_DNA_LIST: StyleDna[] = KnowledgeRegistry.list('style');

export const STYLE_DNA_PRESETS: Record<string, StyleDna> = Object.fromEntries(STYLE_DNA_LIST.map((dna) => [dna.id, dna]));

/** Build 008B, Section 4 (Species Usage Profiles): which real
 * `UsageProfileId` (knowledge/registry/speciesSchema.ts) each built-in
 * style's own design identity maps to -- a hand-authored editorial
 * judgment (the same convention `StyleDnaExportRecommendation
 * .bestProductTargets` already established), not a computed score. Only
 * consulted by `resolveStyleDna` as a fallback family pool for a style
 * with no explicit `preferredFamilies` (see below) -- every shipped style
 * already has one, so this map changes no existing style's resolved
 * output; it exists so a future/custom style without a hand-picked family
 * list still gets species that genuinely fit its usage context instead of
 * an unweighted pick across all 19 families. */
export const STYLE_USAGE_PROFILE: Partial<Record<string, UsageProfileId>> = {
  editorialBotanical: 'editorialBotanical',
  luxuryFloral: 'luxuryFloral',
  scandinavianOrganic: 'scandinavian',
  minimalBotanical: 'minimal',
  vintageHerbarium: 'vintage',
  darkBotanical: 'modern',
  modernTropical: 'modern',
  boutiquePackaging: 'packaging',
  luxuryWallpaper: 'wallpaper',
  premiumTextile: 'textile',
  kidsPlayful: 'nursery',
  retroOrganic: 'vintage',
  organicAbstract: 'modern',
  bohoFloral: 'wedding',
  softWatercolorInspired: 'greetingCard',
};

/** The subset of GenerateParams a Style DNA resolves — used both to build
 * the actual patch applied to the app's params and to compute drift (which
 * fields the user has since hand-edited away from the style's own values). */
export type StyleDnaResolvedFields = Pick<
  GenerateParams,
  | 'categoryId'
  | 'motifSize'
  | 'layoutId'
  | 'paletteId'
  | 'colorCount'
  | 'colorStory'
  | 'colorHarmonyBias'
  | 'density'
  | 'negativeSpace'
  | 'overlapAmount'
  | 'rotationJitter'
  | 'scaleJitter'
  | 'fillerStyle'
  | 'flatShadow'
  | 'flatHighlight'
  | 'hierarchy'
  | 'compositionIntelligence'
  | 'tileSize'
  | 'patternScale'
  | 'styleDnaId'
  | 'compositionZone'
  | 'botanicalFamily'
  | 'clusterArchetypes'
  | 'premiumHero'
  | 'designRules'
  | 'depthStrength'
  | 'professionalRules'
>;

/** Deterministically picks one entry from a Style DNA's preferred list using
 * a seed derived from the style id + the app's own seed (same cyrb53-based
 * hash family every other seed in this engine uses — never `Math.random`),
 * so regenerating with a new seed can explore other family members while
 * the same seed + style always resolves identically. */
function pickPreferred<T>(list: T[], dnaId: string, seed: string, salt: string): T {
  if (list.length === 1) return list[0];
  const rng = createRng(`styledna::${dnaId}::${salt}::${seed}`);
  // Build 005, Section 6 (Designer Brain): favors the list's own
  // documented "primary/default" (first) entry instead of an equal
  // coin-flip among every option — see designerBrain.ts's own doc comment.
  return weightedPickPreferred(rng, list);
}

/** Build 008B, Section 4 fallback: for a *botanical-category* style with no
 * explicit `preferredFamilies`, looks up its `STYLE_USAGE_PROFILE` entry
 * and picks (deterministically, weighted toward the commercially-strongest
 * fit) from the real species that declare that usage profile. Returns
 * `undefined` (byte-identical to pre-008B behavior) for any non-botanical
 * style -- `preferredFamilies` itself is documented as "only meaningful
 * for a style whose `categories` includes `'botanical'`", so this fallback
 * honors that same rule rather than assigning a botanical family hint to
 * e.g. a Tropical- or Geometric-only style. */
function resolveFallbackBotanicalFamily(dna: StyleDna, seed: string): BotanicalFamily | undefined {
  if (!dna.categories.includes('botanical')) return undefined;
  const profile = STYLE_USAGE_PROFILE[dna.id];
  if (!profile) return undefined;
  const candidates = speciesForUsageProfile(profile);
  if (candidates.length === 0) return undefined;
  return pickPreferred(candidates, dna.id, seed, 'usageProfileFamily');
}

/** Resolves a Style DNA into the concrete GenerateParams patch. Every field
 * maps to a real, already-implemented engine parameter (see module note for
 * the two intentionally-reserved exceptions). */
export function resolveStyleDna(dna: StyleDna, seed: string): StyleDnaResolvedFields {
  const categoryId = pickPreferred(dna.categories, dna.id, seed, 'category');
  const layoutId = pickPreferred(dna.layouts, dna.id, seed, 'layout');
  const paletteId = pickPreferred(dna.paletteIds, dna.id, seed, 'palette');
  const compositionZone = dna.preferredZones?.length
    ? pickPreferred(dna.preferredZones, dna.id, seed, 'zone')
    : undefined;
  const botanicalFamily = dna.preferredFamilies?.length
    ? pickPreferred(dna.preferredFamilies, dna.id, seed, 'family')
    : resolveFallbackBotanicalFamily(dna, seed);
  const generator = GENERATORS[categoryId];
  const depth = DEPTH_SHADOW[dna.svgDepthMode];
  const eyeFlowPath = compositionZone ? mapCompositionZoneToEyeFlow(compositionZone) : undefined;
  // Build 009, Section 5 (Natural Asymmetry Engine): one deterministic
  // direction per style+seed (same hash-based `pickPreferred` every other
  // per-generation choice in this file already uses) -- a real design
  // decision, not left to whichever way the layout happened to lean.
  const asymmetryDirection = pickPreferred(ASYMMETRY_DIRECTIONS, dna.id, seed, 'asymmetryDirection');

  // Build 010, Section 8 (Signature Style Engine): the audit found no
  // fingerprint to build until Sections 1-7's own new fields existed --
  // now that they do, every style's real, already-declared `hierarchyPreset`
  // and `premiumHero` dimensions double as its compositional signature
  // rather than inventing 15 new hand-authored values from scratch (the
  // same "reuse an already-real declared dimension" discipline Build 008B's
  // `premiumScore` reuse for `supportWeightRatio` already established). A
  // `heroFocus` preset (the styles whose whole hierarchy already exists to
  // make one hero dominate -- darkBotanical/luxuryFloral/modernTropical)
  // gets real depth-plane separation reinforcing that same dominant-hero
  // read (Build 010, Section 3). A `premiumHero: true` preset (the styles
  // that already assemble a real multi-part bouquet hero -- bohoFloral/
  // darkBotanical/editorialBotanical/luxuryFloral) additionally opts into
  // the Premium Rhythm Engine and the Professional Illustrator Rules'
  // rule-of-odds (Build 010, Sections 5/6) -- a style sophisticated enough
  // to build a real bouquet hero is exactly the one that should read as
  // deliberately rhythmic and naturally-grouped, not the generic default.
  // Every other preset resolves both to undefined, an exact no-op.
  const depthStrength = dna.hierarchyPreset === 'heroFocus' ? 0.3 : undefined;
  const professionalRules = dna.premiumHero ? true : undefined;
  // Build 011, Section 1 (Artistic Balance Engine): the same `premiumHero`
  // signal that already opts a preset into the Professional Illustrator
  // Rules also opts it into perceptually-weighted balance correction — a
  // style sophisticated enough to assemble a real bouquet hero is exactly
  // the one whose balance should read as "this hero's real weight" rather
  // than a flat scale²×role proxy. Every other preset resolves to
  // `undefined`, a strict no-op (see `compositionIntelligence.ts`'s own
  // doc comment on `artisticBalance`).
  const artisticBalance = dna.premiumHero ? true : undefined;

  return {
    categoryId,
    motifSize: generator ? generator.defaultMotifSize : 70,
    layoutId,
    paletteId,
    colorCount: COMPLEXITY_COLOR_COUNT[dna.motifComplexity] + (COLOR_STRATEGY_COUNT[dna.colorStrategy] - 4),
    colorStory: COLOR_STRATEGY_STORY[dna.colorStrategy],
    // Build 011, Section 3 (Color Harmony Intelligence): universal, like
    // Build 009's `asymmetryDirection` -- every Style DNA preset gets a
    // real, computed dominant-accent lead instead of an equal-odds random
    // pick, the same "avoid equal-distribution coloring" principle applied
    // across the whole preset library, not opt-in per style.
    colorHarmonyBias: true,
    density: dna.density,
    negativeSpace: dna.negativeSpace,
    overlapAmount: dna.overlapAmount,
    rotationJitter: FLOW_ROTATION_JITTER[dna.flowProfile] + COMPLEXITY_ROTATION_BUMP[dna.motifComplexity],
    scaleJitter: COMPLEXITY_SCALE_JITTER[dna.motifComplexity],
    fillerStyle: BACKGROUND_FILLER[dna.backgroundStrategy],
    flatShadow: depth.flatShadow,
    flatHighlight: depth.flatHighlight,
    // Build 010, Section 8 (Signature Style Engine): `premiumRhythm` merged
    // in (never mutating the shared preset object) only for `premiumHero`
    // styles -- see `professionalRules`'s own doc comment above for why.
    // Build 022, Phase 3 (Style-Aware Composition Repair): applied last,
    // on top of premiumRhythm — `applyCompositionEnvelope` is a strict
    // no-op for every style id without a registered override (see
    // compositionEnvelopes.ts), so this changes nothing for 13 of the 15
    // built-in presets.
    hierarchy: applyCompositionEnvelope(
      dna.id,
      dna.premiumHero ? { ...HIERARCHY_PRESETS[dna.hierarchyPreset].value, premiumRhythm: true } : HIERARCHY_PRESETS[dna.hierarchyPreset].value,
    ),
    compositionIntelligence: {
      balanceStrength: CLUSTER_BALANCE_STRENGTH[dna.clusterStyle] * (1 - dna.clusterDensity * 0.4),
      rhythmStrength: RHYTHM_STRENGTH[dna.rhythmProfile],
      attractionStrength: CLUSTER_ATTRACTION_STRENGTH[dna.clusterStyle] * (0.6 + dna.clusterDensity * 0.4),
      negativeSpaceStrength: 0.2 + dna.negativeSpace * 0.5,
      flowProfile: dna.flowProfile,
      flowBiasStrength: FLOW_BIAS_STRENGTH[dna.flowProfile],
      // Build 009, Section 2 (Eye Flow Engine): only set for presets whose
      // real `compositionZone` maps honestly to an Eye Flow path (see
      // `mapCompositionZoneToEyeFlow`'s own doc comment) -- every other
      // preset leaves both fields undefined, a strict no-op.
      eyeFlowPath,
      eyeFlowStrength: eyeFlowPath ? 0.3 : undefined,
      // Build 009, Section 5 (Natural Asymmetry Engine): a modest, universal
      // nudge -- every style gets a real, deliberate lean (see
      // `asymmetryDirection` above), kept subtle (0.2) since this is meant
      // to read as "the supporting texture leans one way", not a redesign.
      asymmetryDirection,
      asymmetryStrength: 0.2,
      artisticBalance,
    },
    tileSize: dna.exportRecommendation.tileSize,
    patternScale: dna.exportRecommendation.patternScale,
    styleDnaId: dna.id,
    compositionZone,
    botanicalFamily,
    clusterArchetypes: dna.preferredClusterArchetypes,
    premiumHero: dna.premiumHero,
    // Build 005, Sections 1-2 (Design Knowledge + Design Rule Engine):
    // every Style DNA now generates using its own real, computed rules —
    // see engine/designKnowledge.ts.
    designRules: resolveDesignRules(computeDesignKnowledgeProfile(dna)),
    depthStrength,
    professionalRules,
  };
}

/** One field of drift between the currently-applied params and what the
 * style itself would resolve to for the same seed — powers "display
 * differences from style defaults" and "Reset to Style". */
export interface StyleDriftEntry {
  field: keyof StyleDnaResolvedFields;
  styleValue: unknown;
  currentValue: unknown;
}

function stableStringify(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function computeStyleDrift(params: GenerateParams, dna: StyleDna): StyleDriftEntry[] {
  const resolved = resolveStyleDna(dna, params.seed);
  const drift: StyleDriftEntry[] = [];
  for (const field of Object.keys(resolved) as Array<keyof StyleDnaResolvedFields>) {
    const styleValue = resolved[field];
    const currentValue = params[field];
    if (stableStringify(styleValue) !== stableStringify(currentValue)) {
      drift.push({ field, styleValue, currentValue });
    }
  }
  return drift;
}

/** "Reset to Style": discards any hand-edits and re-resolves the style fresh
 * for the current seed. */
export function resetToStyleDna(dna: StyleDna, seed: string): StyleDnaResolvedFields {
  return resolveStyleDna(dna, seed);
}

/** Style DNA Enforcement (SVG Intelligence Engine Phase 3, Section 12) —
 * `computeStyleDrift` above already checks whether the *input params*
 * (category/layout/palette/...) still match what the style would resolve
 * to; this checks something `computeStyleDrift` can't: whether the
 * *rendered geometry* actually reads as consistent with the style's own
 * declared intent, using metrics `engine/scoring.ts`'s `computeMetrics`
 * already measured from the real tile (no second scoring pass here).
 * Two real signals, averaged:
 *  - density match: measured `occupancyRatio` (0-100, real grid-coverage
 *    fraction) vs. the style's declared `density` (0-1) — a "minimal"
 *    style whose actual output reads as densely packed has drifted from
 *    its own identity regardless of which category/layout produced it.
 *  - complexity match: measured `rotationDiversity` (0-100) vs. what the
 *    style's declared `motifComplexity` predicts (`intricate` styles are
 *    expected to show more placement variation than `simple` ones, per
 *    this same file's own `COMPLEXITY_ROTATION_BUMP` table).
 * Deliberately two signals, not an invented ten — an honest, narrower
 * real measurement beats a wider fabricated one (see this milestone's
 * "never generate fake scores" requirement). */
export function computeStyleDnaConsistency(metrics: { occupancyRatio: number; rotationDiversity: number }, dna: StyleDna): number {
  const densityMatch = 100 - Math.abs(metrics.occupancyRatio - dna.density * 100);
  const expectedRotationDiversity = { simple: 30, moderate: 55, intricate: 80 }[dna.motifComplexity];
  const complexityMatch = 100 - Math.abs(metrics.rotationDiversity - expectedRotationDiversity);
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return Math.round((clamp(densityMatch) + clamp(complexityMatch)) / 2);
}

/** True when every category/layout/palette a Style DNA references actually
 * exists in the currently-registered engine tables — guards against a
 * hand-edited or imported Style DNA JSON pointing at an id that doesn't
 * exist (e.g. an older export referencing a category that was since
 * renamed/removed). */
export function isStyleDnaCompatible(dna: StyleDna, opts: { paletteIds: Set<string> }): boolean {
  if (dna.categories.length === 0 || dna.layouts.length === 0 || dna.paletteIds.length === 0) return false;
  if (!dna.categories.every((id) => GENERATORS[id])) return false;
  if (!dna.paletteIds.every((id) => opts.paletteIds.has(id))) return false;
  if (!(dna.hierarchyPreset in HIERARCHY_PRESETS)) return false;
  return true;
}

/** Picks whichever key of a small lookup table has the value closest to
 * `value` — the generic, data-driven building block `deriveStyleDnaFromParams`
 * uses to reverse-map a numeric param back onto an enum profile, instead of
 * a chain of hardcoded if/else numeric-range checks per field. */
function nearestKeyByValue<K extends string>(table: Record<K, number>, value: number): K {
  let best = Object.keys(table)[0] as K;
  let bestDist = Infinity;
  for (const k of Object.keys(table) as K[]) {
    const dist = Math.abs(table[k] - value);
    if (dist < bestDist) {
      bestDist = dist;
      best = k;
    }
  }
  return best;
}

function nearestHierarchyPreset(hierarchy: GenerateParams['hierarchy']): keyof typeof HIERARCHY_PRESETS {
  const keys = Object.keys(HIERARCHY_PRESETS) as Array<keyof typeof HIERARCHY_PRESETS>;
  if (!hierarchy) return 'balancedEditorial';
  let best = keys[0];
  let bestDist = Infinity;
  for (const k of keys) {
    const v = HIERARCHY_PRESETS[k].value;
    const dist =
      (v.heroRatio - hierarchy.heroRatio) ** 2 +
      (v.secondaryRatio - hierarchy.secondaryRatio) ** 2 +
      (v.fillerRatio - hierarchy.fillerRatio) ** 2 +
      (v.accentRatio - hierarchy.accentRatio) ** 2 +
      (v.heroScale - hierarchy.heroScale) ** 2 * 0.1;
    if (dist < bestDist) {
      bestDist = dist;
      best = k;
    }
  }
  return best;
}

function overlapAmountToMode(amount: number): OverlapMode {
  if (amount <= 0) return 'none';
  if (amount <= 0.15) return 'subtle';
  if (amount <= 0.25) return 'natural';
  return 'dense';
}

/** Best-effort reverse mapping: turns the *current* GenerateParams (whatever
 * the user has hand-tuned it to) into a new named Style DNA capturing that
 * configuration as a reusable profile. Style DNA is a higher-level
 * abstraction over the raw params by design, so this is intentionally
 * lossy (e.g. many exact rotationJitter values all map to the nearest
 * flowProfile) rather than a lossless snapshot — "Create Style" is meant to
 * produce a reusable *identity*, not a pixel-exact clone. */
export function deriveStyleDnaFromParams(params: GenerateParams, label: string): StyleDna {
  const flowProfile = nearestKeyByValue(FLOW_ROTATION_JITTER, params.rotationJitter);
  const motifComplexity = nearestKeyByValue(COMPLEXITY_SCALE_JITTER, params.scaleJitter);
  const rhythmProfile = nearestKeyByValue(
    RHYTHM_STRENGTH,
    params.compositionIntelligence?.rhythmStrength ?? RHYTHM_STRENGTH.regular,
  );
  const balanceStrength = params.compositionIntelligence?.balanceStrength ?? CLUSTER_BALANCE_STRENGTH.none;
  const clusterStyle = nearestKeyByValue(CLUSTER_BALANCE_STRENGTH, balanceStrength);
  const colorStrategy: ColorStrategy = !params.colorStory
    ? 'fullPalette'
    : params.colorCount <= 2
      ? 'monochromeAccent'
      : params.colorCount >= 5
        ? 'highContrast'
        : 'dominantDuo';
  const backgroundStrategy: BackgroundStrategy =
    params.fillerStyle === 'rich' ? 'richContrast' : params.fillerStyle === 'none' ? 'minimalLight' : 'neutralPaper';
  const svgDepthMode: SvgDepthMode = params.flatShadow ? 'dimensional' : params.flatHighlight ? 'soft' : 'flat';

  return {
    id: `custom-${randomSeed()}`,
    label,
    description: `สไตล์ที่บันทึกจากการตั้งค่าปัจจุบัน (${label})`,
    custom: true,
    categories: params.mixCategoryIds && params.mixCategoryIds.length >= 2 ? params.mixCategoryIds : [params.categoryId],
    layouts: [params.layoutId],
    hierarchyPreset: nearestHierarchyPreset(params.hierarchy),
    density: params.density,
    negativeSpace: params.negativeSpace ?? 0,
    overlapMode: overlapAmountToMode(params.overlapAmount ?? 0),
    overlapAmount: params.overlapAmount ?? 0,
    flowProfile,
    rhythmProfile,
    clusterStyle,
    clusterDensity: 0.3,
    motifComplexity,
    colorStrategy,
    paletteIds: [params.paletteId],
    backgroundStrategy,
    svgDepthMode,
    exportRecommendation: { tileSize: params.tileSize, patternScale: params.patternScale ?? 1, recommendedSites: ['adobestock', 'shutterstock'] },
  };
}

/** Duplicates any style (built-in or custom) as a new custom style with a
 * fresh id, ready for independent editing. */
export function duplicateStyleDna(dna: StyleDna, newLabel: string): StyleDna {
  return { ...dna, id: `custom-${randomSeed()}`, label: newLabel, custom: true };
}

export interface StyleDnaExport {
  schemaVersion: number;
  style: StyleDna;
}

export function exportStyleDnaJson(dna: StyleDna): string {
  return JSON.stringify({ schemaVersion: STYLE_DNA_SCHEMA_VERSION, style: dna } satisfies StyleDnaExport, null, 2);
}

/** Parses a Style DNA JSON export. Returns null (rather than throwing) for
 * malformed JSON or a style missing required fields — callers show a Thai
 * error message rather than crashing, matching ai/aiAssist.ts's convention
 * for user-provided JSON. */
export function importStyleDnaJson(json: string, opts: { paletteIds: Set<string> }): StyleDna | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  const style = (parsed as Partial<StyleDnaExport>)?.style ?? (parsed as StyleDna);
  if (!style || typeof style !== 'object') return null;
  const dna = style as StyleDna;
  if (!dna.id || !dna.label || !Array.isArray(dna.categories) || !Array.isArray(dna.layouts) || !Array.isArray(dna.paletteIds)) {
    return null;
  }
  if (!isStyleDnaCompatible(dna, opts)) return null;
  return { ...dna, custom: true };
}
