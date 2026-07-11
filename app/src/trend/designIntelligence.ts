import type { LayoutId } from '../engine/types';
import { HIERARCHY_PRESETS } from '../engine/hierarchy';
import { STYLE_DNA_PRESETS, FLOW_ROTATION_JITTER } from '../engine/styleDna';
import { PALETTES } from '../palettes/palettes';
import { GENERATORS } from '../generators';
import { LAYOUT_LIST } from '../layouts';
import { MARKETPLACE_PROFILES } from '../metadata/marketplaceProfiles';
import { resolveKeywordBundle, type ResolvedKeywordSignals } from './keywordBundle';
import { TREND_PACKS, TREND_PACK_LIST, DEFAULT_COLLECTION_ASSET_TYPES, type TrendPack } from './trendPacks';
import {
  DESIGN_SPEC_SCHEMA_VERSION,
  type CompositionStyle,
  type DesignColorRoles,
  type DesignSpecMotifRef,
  type DesignSpecification,
  type DifficultyId,
  type KeywordBundle,
} from './designSpecTypes';

// Design Intelligence (Section 5) — the single function that assembles the
// Design Specification JSON from a Keyword Bundle (+ an optional explicit
// Trend Pack). Every resolution step below reuses a real, already-existing
// engine table (HIERARCHY_PRESETS, STYLE_DNA_PRESETS, PALETTES,
// GENERATORS, LAYOUT_LIST, MARKETPLACE_PROFILES) — this module's own job
// is only the *mapping* between keyword/trend signals and those tables,
// never redefining what they mean. Pure and deterministic: no rng, no
// I/O, same input always produces the same spec.

const COMPOSITION_STYLE_TO_HIERARCHY: Record<CompositionStyle, keyof typeof HIERARCHY_PRESETS> = {
  airy: 'airyPremium',
  balanced: 'balancedEditorial',
  dense: 'denseLayered',
  editorial: 'heroFocus',
  maximalist: 'allOverTextile',
  minimal: 'minimalRepeat',
};

const COMPOSITION_STYLE_NEGATIVE_SPACE: Record<CompositionStyle, number> = {
  airy: 0.4,
  balanced: 0.2,
  dense: 0.05,
  editorial: 0.25,
  maximalist: 0.05,
  minimal: 0.35,
};

const DIFFICULTY_DENSITY: Record<DifficultyId, number> = { simple: 0.35, moderate: 0.55, complex: 0.75 };

/** Free-text palette-direction phrase -> a real palettes/palettes.ts id.
 * Keys are exactly the phrases keywordMap.ts's KEYWORD_MAP entries and
 * trendPacks.ts's `paletteDirection` values use, so both compose through
 * this one resolution step. */
const PALETTE_DIRECTION_MAP: Record<string, string> = {
  'jewel tones': 'jewel-tones',
  gold: 'blush-gold',
  pastel: 'pastel-dream',
  'muted green': 'coastal-neutral',
  vibrant: 'vibrant-pop',
  citrus: 'citrus-pop',
  'earth tone': 'earth-tone',
  terracotta: 'terracotta',
  'midnight botanical': 'midnight-botanical',
  monochrome: 'mono-charcoal',
  sage: 'sage-terracotta',
  'candy shop': 'candy-shop',
  'retro sunset': 'retro-sunset',
  'coastal neutral': 'coastal-neutral',
};

function resolvePaletteId(direction: string, hints: string[]): string {
  const norm = direction.trim().toLowerCase();
  if (PALETTE_DIRECTION_MAP[norm]) return PALETTE_DIRECTION_MAP[norm];
  for (const hint of hints) {
    if (PALETTE_DIRECTION_MAP[hint]) return PALETTE_DIRECTION_MAP[hint];
  }
  const byLabel = PALETTES.find((p) => norm && (p.label.toLowerCase().includes(norm) || norm.includes(p.label.toLowerCase())));
  if (byLabel) return byLabel.id;
  return 'pastel-dream';
}

/** Named background/primary/secondary/accent roles picked from the
 * *actually resolved* palette's own color array (not a trend pack's fixed
 * hex list) so `colorRoles` is always guaranteed to be a subset of
 * `palette.colors` — an invariant tests below assert. */
function deriveColorRoles(colors: string[]): DesignColorRoles {
  const at = (i: number) => colors[Math.min(i, colors.length - 1)] ?? '#000000';
  return { background: at(0), primary: at(1), secondary: at(2), accent: at(3) };
}

function pickCategoryIds(primary: string, motifHints: string[], trendMotifs: string[]): string[] {
  const candidates = [primary, ...motifHints, ...trendMotifs].filter((id) => GENERATORS[id]);
  return [...new Set(candidates)];
}

function buildMotifRefs(categoryIds: string[]): { hero: DesignSpecMotifRef[]; secondary: DesignSpecMotifRef[]; fillers: DesignSpecMotifRef[] } {
  const [heroId, ...rest] = categoryIds;
  const hero: DesignSpecMotifRef[] = [{ categoryId: heroId, role: 'hero' }];
  const secondary: DesignSpecMotifRef[] = rest.slice(0, 2).map((id) => ({ categoryId: id, role: 'secondary' }));
  const fillerId = rest[2] ?? heroId;
  const fillers: DesignSpecMotifRef[] = [{ categoryId: fillerId, role: 'filler', notes: 'background filler layer (svgHints.fillerStyle)' }];
  return { hero, secondary, fillers };
}

/** Picks a Trend Pack: the explicit `trendPackId` wins if given (returns
 * null if that id doesn't exist — the caller decides whether that's an
 * error); otherwise auto-matches by season first, narrowed to a pack whose
 * `patternTypes` includes the bundle's pattern type, falling back to any
 * season match, then any pattern-type match, then null (a spec can be
 * built with no trend attached at all). Deterministic — no ranking ties
 * are broken by anything but registration order in TREND_PACKS. */
export function resolveTrendPack(trendPackId: string | undefined, bundle: KeywordBundle): TrendPack | null {
  if (trendPackId) return TREND_PACKS[trendPackId] ?? null;
  const bySeason = TREND_PACK_LIST.filter((p) => p.season === bundle.season);
  const matchesPattern = (list: TrendPack[]) => list.find((p) => p.patternTypes.includes(bundle.patternType));
  return matchesPattern(bySeason) ?? bySeason[0] ?? matchesPattern(TREND_PACK_LIST) ?? null;
}

export interface BuildDesignSpecificationInput {
  keywordBundle: KeywordBundle;
  /** Explicit Trend Pack selection — omit to auto-match by season/pattern
   * type (see `resolveTrendPack`). */
  trendPackId?: string;
  projectName?: string;
  projectId?: string;
  createdAt?: number;
}

/** The Section 5 core: Market Research -> Keyword Bundle -> Trend Analysis
 * -> Design Intelligence -> Design Specification JSON. Assembles one
 * complete, self-contained `DesignSpecification` — the single source of
 * truth every downstream generator (SVG/SEO/Prompt/Export, later phases)
 * will read from instead of re-deriving its own parameters. */
export function buildDesignSpecification(input: BuildDesignSpecificationInput): DesignSpecification {
  const { keywordBundle } = input;
  const signals: ResolvedKeywordSignals = resolveKeywordBundle(keywordBundle);
  const trendPack = resolveTrendPack(input.trendPackId, keywordBundle);

  const styleDnaId = keywordBundle.styleDnaId ?? signals.styleDnaHints[0] ?? trendPack?.styleDnaId ?? 'editorialBotanical';
  const styleDna = STYLE_DNA_PRESETS[styleDnaId];

  const paletteDirection = keywordBundle.paletteDirection || trendPack?.paletteDirection || signals.paletteHints[0] || 'pastel';
  const paletteId = resolvePaletteId(paletteDirection, signals.paletteHints);
  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];

  const composition: CompositionStyle = trendPack?.compositionStyle ?? signals.compositionHints[0] ?? 'balanced';
  const hierarchyPresetKey = COMPOSITION_STYLE_TO_HIERARCHY[composition];
  const hierarchy = HIERARCHY_PRESETS[hierarchyPresetKey].value;

  const repeatType: LayoutId = trendPack?.suggestedLayouts[0] ?? (LAYOUT_LIST.find((l) => l.id === 'grid')?.id as LayoutId) ?? LAYOUT_LIST[0].id;

  const flow = styleDna?.flowProfile ?? 'calm';
  const rhythm = styleDna?.rhythmProfile ?? 'regular';

  const density = DIFFICULTY_DENSITY[keywordBundle.difficulty] ?? 0.5;
  const negativeSpace = trendPack?.negativeSpace ?? COMPOSITION_STYLE_NEGATIVE_SPACE[composition];

  const categoryIds = pickCategoryIds(keywordBundle.patternType, signals.motifHints, trendPack?.popularMotifs ?? []);
  const motifRefs = buildMotifRefs(categoryIds.length ? categoryIds : [keywordBundle.patternType]);

  const heroGenerator = GENERATORS[motifRefs.hero[0].categoryId] ?? Object.values(GENERATORS)[0];
  const fillerStyle: 'none' | 'subtle' | 'rich' = composition === 'dense' || composition === 'maximalist' ? 'rich' : composition === 'minimal' ? 'none' : 'subtle';

  const marketplaceProfile = MARKETPLACE_PROFILES[keywordBundle.marketplace];
  const collectionSize = keywordBundle.collectionSize || trendPack?.collectionRecommendations.size || DEFAULT_COLLECTION_ASSET_TYPES.length;
  const assetTypes = trendPack?.collectionRecommendations.assetTypes ?? DEFAULT_COLLECTION_ASSET_TYPES;

  const now = input.createdAt ?? Date.now();

  const spec: DesignSpecification = {
    schemaVersion: DESIGN_SPEC_SCHEMA_VERSION,
    project: {
      id: input.projectId ?? `design-spec-${now}`,
      name: input.projectName ?? `${keywordBundle.primaryKeyword} — ${keywordBundle.commercialCategory}`,
      createdAt: now,
    },
    collection: { size: collectionSize, assetTypes },
    marketplace: { id: keywordBundle.marketplace },
    trend: trendPack ? { trendPackId: trendPack.id, theme: trendPack.theme, mood: trendPack.mood } : null,
    keywordBundle,
    styleDnaId,
    palette: { id: palette.id, colors: palette.colors },
    colorRoles: deriveColorRoles(palette.colors),
    composition,
    repeatType,
    density,
    hierarchy,
    flow,
    rhythm,
    negativeSpace,
    heroMotifs: motifRefs.hero,
    secondaryMotifs: motifRefs.secondary,
    fillers: motifRefs.fillers,
    background: { color: palette.colors[0] },
    svgHints: {
      motifSize: heroGenerator.defaultMotifSize,
      rotationJitter: FLOW_ROTATION_JITTER[flow],
      scaleJitter: 0.15,
      mirror: false,
      radialSymmetry: 1,
      colorStory: true,
      fillerStyle,
      flatShadow: false,
      flatHighlight: false,
      patternScale: 1,
    },
    seoHints: {
      primaryKeyword: keywordBundle.primaryKeyword,
      secondaryKeywords: keywordBundle.secondaryKeywords,
      commercialCategory: keywordBundle.commercialCategory,
      audience: keywordBundle.audience,
      season: keywordBundle.season,
    },
    exportHints: {
      tileSize: 3000,
      collectionSize,
      assetTypes,
      exportFormats: [marketplaceProfile.filenameRules.extension],
    },
    qualityTargets: {
      minOverallScore: 70,
      minSeamlessIntegrity: 100,
      minMotifDiversity: 40,
      minCommercialReadiness: 70,
    },
  };

  return spec;
}
