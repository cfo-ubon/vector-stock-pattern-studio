import type { CompositionStyle } from './designSpecTypes';

// Keyword Map — Section 14's "no hardcoded data" config for how individual
// keyword tokens translate into real engine signals (a Palette direction,
// a category id, a Style DNA id, a composition style). Editable/
// extendable in one place; `resolveKeywordBundle` (keywordBundle.ts) is
// the logic that *uses* this table, kept separate so the data can be
// edited without touching the merge/weighting logic.

export interface KeywordSignal {
  /** Free-text palette direction tokens this keyword nudges toward (fed
   * into palettes.ts's PALETTE_DIRECTION_MAP in designIntelligence.ts —
   * kept as text here, not a resolved Palette id, since one keyword can
   * reasonably suggest more than one direction). */
  paletteHints: string[];
  /** Real generators/index.ts category ids. */
  motifHints: string[];
  /** Real engine/styleDna.ts STYLE_DNA_PRESETS ids. */
  styleDnaHints: string[];
  compositionHints: CompositionStyle[];
  /** Free-text mood words surfaced in previews/SEO copy. */
  moodHints: string[];
  /** Relative influence when this keyword is merged with others in a
   * bundle — higher wins ties in `resolveKeywordBundle`. */
  weight: number;
}

const s = (partial: Partial<KeywordSignal>): KeywordSignal => ({
  paletteHints: [],
  motifHints: [],
  styleDnaHints: [],
  compositionHints: [],
  moodHints: [],
  weight: 1,
  ...partial,
});

/** Keys are matched case-insensitively as whole tokens against every word
 * in a keyword phrase (see `matchKeywordTokens` in keywordBundle.ts), so
 * "Luxury Botanical" matches both `luxury` and `botanical` independently
 * before `COMBO_RULES` looks for the pair. */
export const KEYWORD_MAP: Record<string, KeywordSignal> = {
  luxury: s({ paletteHints: ['jewel tones', 'gold'], styleDnaHints: ['luxuryFloral', 'luxuryWallpaper'], compositionHints: ['editorial'], moodHints: ['elevated', 'refined'], weight: 1.4 }),
  premium: s({ paletteHints: ['jewel tones', 'earth tone'], styleDnaHints: ['premiumTextile', 'luxuryWallpaper'], compositionHints: ['editorial'], moodHints: ['polished'], weight: 1.3 }),
  botanical: s({ motifHints: ['botanical'], styleDnaHints: ['editorialBotanical', 'luxuryFloral'], moodHints: ['organic', 'natural'], weight: 1.2 }),
  floral: s({ motifHints: ['botanical'], styleDnaHints: ['editorialBotanical', 'bohoFloral'], moodHints: ['romantic'], weight: 1.2 }),
  wallpaper: s({ compositionHints: ['dense', 'editorial'], styleDnaHints: ['luxuryWallpaper'], moodHints: ['decorative'], weight: 1.1 }),
  textile: s({ compositionHints: ['balanced'], styleDnaHints: ['premiumTextile'], moodHints: ['tactile'], weight: 1 }),
  packaging: s({ compositionHints: ['minimal', 'balanced'], styleDnaHints: ['boutiquePackaging'], moodHints: ['clean'], weight: 1 }),
  spring: s({ paletteHints: ['pastel', 'muted green'], moodHints: ['fresh', 'blooming'], weight: 0.8 }),
  summer: s({ paletteHints: ['vibrant', 'citrus'], moodHints: ['bright', 'energetic'], weight: 0.8 }),
  autumn: s({ paletteHints: ['earth tone', 'terracotta'], moodHints: ['warm', 'cozy'], weight: 0.8 }),
  winter: s({ paletteHints: ['jewel tones', 'monochrome'], moodHints: ['cool', 'crisp'], weight: 0.8 }),
  muted: s({ paletteHints: ['muted green', 'coastal neutral'], moodHints: ['calm', 'quiet'], weight: 1 }),
  'muted green': s({ paletteHints: ['muted green'], moodHints: ['calm'], weight: 1.1 }),
  green: s({ paletteHints: ['muted green', 'sage'], weight: 0.7 }),
  pastel: s({ paletteHints: ['pastel'], moodHints: ['soft', 'gentle'], weight: 1 }),
  vibrant: s({ paletteHints: ['vibrant'], compositionHints: ['maximalist'], moodHints: ['bold', 'energetic'], weight: 1 }),
  bold: s({ paletteHints: ['vibrant'], compositionHints: ['maximalist'], moodHints: ['confident'], weight: 1 }),
  editorial: s({ compositionHints: ['editorial'], styleDnaHints: ['editorialBotanical'], moodHints: ['curated'], weight: 1.2 }),
  minimal: s({ compositionHints: ['minimal'], styleDnaHints: ['minimalBotanical', 'scandinavianOrganic'], moodHints: ['restrained'], weight: 1.2 }),
  scandinavian: s({ compositionHints: ['minimal', 'airy'], styleDnaHints: ['scandinavianOrganic'], moodHints: ['understated'], weight: 1.1 }),
  maximalist: s({ compositionHints: ['maximalist', 'dense'], moodHints: ['exuberant'], weight: 1.2 }),
  dense: s({ compositionHints: ['dense'], weight: 1 }),
  airy: s({ compositionHints: ['airy'], moodHints: ['light', 'breathable'], weight: 1.1 }),
  vintage: s({ paletteHints: ['earth tone', 'terracotta'], styleDnaHints: ['vintageHerbarium', 'retroOrganic'], moodHints: ['nostalgic'], weight: 1.1 }),
  retro: s({ paletteHints: ['retro sunset'], styleDnaHints: ['retroOrganic'], moodHints: ['playful nostalgia'], weight: 1.1 }),
  dark: s({ paletteHints: ['midnight botanical', 'monochrome'], styleDnaHints: ['darkBotanical'], moodHints: ['moody', 'dramatic'], weight: 1.1 }),
  moody: s({ paletteHints: ['midnight botanical'], styleDnaHints: ['darkBotanical'], moodHints: ['dramatic'], weight: 1 }),
  tropical: s({ motifHints: ['tropical'], styleDnaHints: ['modernTropical'], paletteHints: ['citrus'], moodHints: ['lush', 'exotic'], weight: 1.2 }),
  geometric: s({ motifHints: ['geometric'], compositionHints: ['minimal', 'balanced'], moodHints: ['structured'], weight: 1.2 }),
  boho: s({ motifHints: ['boho'], styleDnaHints: ['bohoFloral'], moodHints: ['free-spirited'], weight: 1.1 }),
  kids: s({ motifHints: ['cute'], styleDnaHints: ['kidsPlayful'], paletteHints: ['candy shop', 'vibrant'], moodHints: ['playful', 'fun'], weight: 1.3 }),
  playful: s({ styleDnaHints: ['kidsPlayful'], moodHints: ['fun'], weight: 1 }),
  watercolor: s({ styleDnaHints: ['softWatercolorInspired'], moodHints: ['painterly'], weight: 1.1 }),
  organic: s({ motifHints: ['organic'], styleDnaHints: ['organicAbstract'], moodHints: ['flowing'], weight: 1 }),
  mandala: s({ motifHints: ['mandala'], compositionHints: ['dense', 'editorial'], moodHints: ['intricate', 'meditative'], weight: 1.2 }),
  damask: s({ motifHints: ['damask'], compositionHints: ['editorial', 'dense'], moodHints: ['classic', 'ornate'], weight: 1.2 }),
};

/** A small set of curated pairwise rules — the "understand the
 * relationship between keywords instead of treating them independently"
 * requirement (Section 2). Order-independent: both token orders match.
 * Applied *in addition to* the individual-keyword signals above, not
 * instead of them, so a combo genuinely narrows/sharpens the result
 * rather than replacing it. */
export interface KeywordComboRule {
  tokens: [string, string];
  bonus: Partial<KeywordSignal>;
  note: string;
}

export const COMBO_RULES: KeywordComboRule[] = [
  {
    tokens: ['luxury', 'botanical'],
    bonus: { styleDnaHints: ['luxuryFloral'], compositionHints: ['editorial'], moodHints: ['elevated florals'] },
    note: 'Luxury + Botanical -> elevated editorial florals, not a generic leaf print',
  },
  {
    tokens: ['minimal', 'botanical'],
    bonus: { styleDnaHints: ['minimalBotanical'], compositionHints: ['minimal'] },
    note: 'Minimal + Botanical -> restrained single-motif botanical, not dense florals',
  },
  {
    tokens: ['dark', 'botanical'],
    bonus: { styleDnaHints: ['darkBotanical'], paletteHints: ['midnight botanical'] },
    note: 'Dark + Botanical -> moody botanical, overrides a bright default palette hint',
  },
  {
    tokens: ['vintage', 'floral'],
    bonus: { styleDnaHints: ['vintageHerbarium'], moodHints: ['pressed botanical'] },
    note: 'Vintage + Floral -> pressed herbarium mood rather than modern floral',
  },
  {
    tokens: ['kids', 'tropical'],
    bonus: { styleDnaHints: ['kidsPlayful'], paletteHints: ['candy shop'] },
    note: 'Kids + Tropical -> playful palette wins over a natural tropical palette',
  },
  {
    tokens: ['scandinavian', 'geometric'],
    bonus: { compositionHints: ['minimal'], moodHints: ['understated grid'] },
    note: 'Scandinavian + Geometric -> reinforces minimal composition strongly',
  },
];
