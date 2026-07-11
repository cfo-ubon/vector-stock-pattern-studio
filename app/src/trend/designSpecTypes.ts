import type { LayoutId } from '../engine/types';
import type { HierarchyParams } from '../engine/hierarchy';
import type { FlowProfile, RhythmProfile } from '../engine/styleDna';
import type { MarketplaceId } from '../metadata/marketplaceProfiles';
import type { AssetType } from '../collection/collectionGenerator';

// Trend Intelligence Studio — Phase 1: the Design Specification JSON shape
// (Section 5 of the brief) and its inputs (Keyword Bundle, Trend Pack).
// This is the schema layer only — pure types plus the small derived
// unions below. Every field re-uses a *real* existing engine concept
// instead of inventing a parallel one, specifically so a later "SVG Engine
// consumes the Design Specification directly, no duplicated logic" phase
// has a mechanical (not re-designed) mapping to build from:
//   repeatType    -> GenerateParams.layoutId (LayoutId, unchanged)
//   hierarchy     -> GenerateParams.hierarchy (HierarchyParams, unchanged)
//   flow / rhythm -> engine/styleDna.ts's FlowProfile/RhythmProfile enums
//                    (already resolved into rotationJitter/scaleJitter/
//                    rhythmStrength by resolveStyleDna — reused, not
//                    reimplemented)
//   negativeSpace -> GenerateParams.negativeSpace (unchanged)
//   svgHints.*    -> the remaining GenerateParams fields 1:1

/** Only the 7 asset kinds Section 11 ("Collection Generator") names —
 * `Extract` against the real `AssetType` union from
 * collection/collectionGenerator.ts so this can never drift from what the
 * Collection Generator actually produces. */
export type CollectionAssetKind = Extract<
  AssetType,
  'heroPattern' | 'secondaryPattern' | 'blenderPattern' | 'miniPattern' | 'stripePattern' | 'borderPattern' | 'cornerPattern' | 'spotMotifSheet'
>;

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter' | 'yearRound';

export type DifficultyId = 'simple' | 'moderate' | 'complex';

/** A short, descriptive composition label — what Trend Packs call
 * "Composition Style" (Section 3). Distinct from the concrete engine
 * `hierarchy`/`density`/`negativeSpace` numbers below: this is the
 * human-readable direction those numbers are resolved *from* (see
 * `designIntelligence.ts`'s `COMPOSITION_STYLE_TO_HIERARCHY`). */
export type CompositionStyle = 'airy' | 'balanced' | 'dense' | 'editorial' | 'maximalist' | 'minimal';

export interface KeywordBundle {
  primaryKeyword: string;
  secondaryKeywords: string[];
  marketplace: MarketplaceId;
  season: SeasonId;
  audience: string;
  commercialCategory: string;
  /** References engine/styleDna.ts's STYLE_DNA_PRESETS (or a custom saved
   * style's id) — undefined means "let Design Intelligence resolve one
   * from the keyword signals". */
  styleDnaId?: string;
  /** A real category id from generators/index.ts's GENERATORS registry
   * (e.g. 'botanical', 'geometric') — the "Pattern Type" input. */
  patternType: string;
  /** Free-text palette direction (e.g. "muted green", "jewel tones") —
   * resolved to a real Palette id via keywordMap.ts's palette hints, not
   * used directly as an id. */
  paletteDirection: string;
  difficulty: DifficultyId;
  collectionSize: number;
}

export interface DesignSpecMotifRef {
  categoryId: string;
  role: 'hero' | 'secondary' | 'filler' | 'accent';
  notes?: string;
}

/** Named palette roles resolved from the chosen Palette's color array —
 * distinct from engine/motifFactory.ts's unrelated `colorRoles` field
 * (that one is a per-motif "which colors did this specific motif actually
 * use" audit list; this one is a named background/primary/secondary/accent
 * assignment used for moodboard/preview/SEO copy). */
export interface DesignColorRoles {
  background: string;
  primary: string;
  secondary: string;
  accent: string;
}

export interface DesignSvgHints {
  motifSize: number;
  rotationJitter: number;
  scaleJitter: number;
  mirror: boolean;
  radialSymmetry: number;
  colorStory: boolean;
  fillerStyle: 'none' | 'subtle' | 'rich';
  flatShadow: boolean;
  flatHighlight: boolean;
  patternScale: number;
}

export interface DesignSeoHints {
  primaryKeyword: string;
  secondaryKeywords: string[];
  commercialCategory: string;
  audience: string;
  season: SeasonId;
}

export interface DesignExportHints {
  tileSize: number;
  collectionSize: number;
  assetTypes: CollectionAssetKind[];
  /** File extension(s) the selected marketplace's profile expects
   * (metadata/marketplaceProfiles.ts's `filenameRules.extension`). */
  exportFormats: string[];
}

/** Forward-looking targets for the Section 12 auto-improve quality loop
 * (not wired to the scoring engine yet in this phase — field names are
 * chosen to line up with engine/scoring.ts's real metric names so that
 * wiring is a lookup, not a redesign, when it's built). */
export interface DesignQualityTargets {
  minOverallScore: number;
  minSeamlessIntegrity: number;
  minMotifDiversity: number;
  minCommercialReadiness: number;
}

export const DESIGN_SPEC_SCHEMA_VERSION = 1;

export interface DesignSpecification {
  schemaVersion: number;
  project: {
    id: string;
    name: string;
    createdAt: number;
  };
  collection: {
    size: number;
    assetTypes: CollectionAssetKind[];
  };
  marketplace: {
    id: MarketplaceId;
  };
  /** Null when the spec was built without selecting/matching a Trend
   * Pack — every other field still resolves, just without a trend
   * narrative attached. */
  trend: {
    trendPackId: string;
    theme: string;
    mood: string;
  } | null;
  keywordBundle: KeywordBundle;
  styleDnaId: string;
  palette: {
    id: string;
    colors: string[];
  };
  colorRoles: DesignColorRoles;
  composition: CompositionStyle;
  repeatType: LayoutId;
  density: number;
  hierarchy: HierarchyParams;
  flow: FlowProfile;
  rhythm: RhythmProfile;
  negativeSpace: number;
  heroMotifs: DesignSpecMotifRef[];
  secondaryMotifs: DesignSpecMotifRef[];
  fillers: DesignSpecMotifRef[];
  background: {
    color: string;
  };
  svgHints: DesignSvgHints;
  seoHints: DesignSeoHints;
  exportHints: DesignExportHints;
  qualityTargets: DesignQualityTargets;
}
