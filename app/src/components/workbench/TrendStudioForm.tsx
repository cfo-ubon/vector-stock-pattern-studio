import type { KeywordBundle, DifficultyId, SeasonId } from '../../trend/designSpecTypes';
import { listMarketplaces } from '../../services/marketplaceService';
import { listStyleDna } from '../../services/styleDnaService';
import { listMotifGrammars } from '../../services/motifGrammarService';
import { TREND_PACK_LIST } from '../../trend/trendPacks';
import type { MarketplaceId } from '../../metadata/marketplaceProfiles';

// Design Workbench Section 1 ("Trend Studio") — every field the brief
// names (Keyword Bundle, Marketplace, Season, Audience, Style DNA,
// Commercial Category, Pattern Type, Palette Direction, Difficulty,
// Collection Size) plus Trend Pack loading. Purely a controlled form over
// a `KeywordBundle` — `trend/designIntelligence.ts`'s
// `buildDesignSpecification` (called by the parent on submit) is what
// turns it into a Design Specification; this component has no
// design-intelligence logic of its own.

const SEASONS: Array<{ id: SeasonId; label: string }> = [
  { id: 'spring', label: 'Spring' },
  { id: 'summer', label: 'Summer' },
  { id: 'autumn', label: 'Autumn' },
  { id: 'winter', label: 'Winter' },
  { id: 'yearRound', label: 'Year-round' },
];

const DIFFICULTIES: Array<{ id: DifficultyId; label: string }> = [
  { id: 'simple', label: 'Simple' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'complex', label: 'Complex' },
];

const MARKETPLACE_OPTIONS = listMarketplaces();
const STYLE_DNA_OPTIONS = listStyleDna();
const PATTERN_TYPE_OPTIONS = listMotifGrammars();

interface Props {
  bundle: KeywordBundle;
  onBundleChange: (bundle: KeywordBundle) => void;
  secondaryKeywordsText: string;
  onSecondaryKeywordsTextChange: (text: string) => void;
  trendPackId: string | undefined;
  onTrendPackIdChange: (id: string | undefined) => void;
  onGenerate: () => void;
}

export function TrendStudioForm({
  bundle,
  onBundleChange,
  secondaryKeywordsText,
  onSecondaryKeywordsTextChange,
  trendPackId,
  onTrendPackIdChange,
  onGenerate,
}: Props) {
  function patch(partial: Partial<KeywordBundle>) {
    onBundleChange({ ...bundle, ...partial });
  }

  return (
    <div className="workbench-trend-studio-form">
      <div className="trend-studio-form">
        <label>
          Primary Keyword
          <input type="text" value={bundle.primaryKeyword} onChange={(e) => patch({ primaryKeyword: e.target.value })} />
        </label>
        <label>
          Secondary Keywords (comma-separated)
          <input type="text" value={secondaryKeywordsText} onChange={(e) => onSecondaryKeywordsTextChange(e.target.value)} />
        </label>
        <label>
          Marketplace
          <select value={bundle.marketplace} onChange={(e) => patch({ marketplace: e.target.value as MarketplaceId })}>
            {MARKETPLACE_OPTIONS.map((p) => (
              <option key={p.id} value={p.id} disabled={p.future}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Season
          <select value={bundle.season} onChange={(e) => patch({ season: e.target.value as SeasonId })}>
            {SEASONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Audience
          <input type="text" value={bundle.audience} onChange={(e) => patch({ audience: e.target.value })} />
        </label>
        <label>
          Style DNA
          <select value={bundle.styleDnaId ?? ''} onChange={(e) => patch({ styleDnaId: e.target.value || undefined })}>
            <option value="">— auto-resolve from Keyword/Trend Pack —</option>
            {STYLE_DNA_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Commercial Category
          <input type="text" value={bundle.commercialCategory} onChange={(e) => patch({ commercialCategory: e.target.value })} />
        </label>
        <label>
          Pattern Type
          <select value={bundle.patternType} onChange={(e) => patch({ patternType: e.target.value })}>
            {PATTERN_TYPE_OPTIONS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Palette Direction
          <input
            type="text"
            placeholder="e.g. muted green, jewel tones (blank = auto)"
            value={bundle.paletteDirection}
            onChange={(e) => patch({ paletteDirection: e.target.value })}
          />
        </label>
        <label>
          Difficulty
          <select value={bundle.difficulty} onChange={(e) => patch({ difficulty: e.target.value as DifficultyId })}>
            {DIFFICULTIES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Collection Size
          <input type="number" min={1} value={bundle.collectionSize} onChange={(e) => patch({ collectionSize: Math.max(1, Number(e.target.value) || 1) })} />
        </label>
      </div>

      <div className="trend-pack-picker">
        <span className="metadata-hint">Trend Pack:</span>
        <button type="button" className={`marketplace-chip${trendPackId === undefined ? ' active' : ''}`} onClick={() => onTrendPackIdChange(undefined)}>
          ✨ Auto-match
        </button>
        {TREND_PACK_LIST.map((p) => (
          <button key={p.id} type="button" className={`marketplace-chip${trendPackId === p.id ? ' active' : ''}`} onClick={() => onTrendPackIdChange(p.id)} title={p.mood}>
            {p.label}
          </button>
        ))}
      </div>

      <button type="button" className="btn btn--primary" onClick={onGenerate}>
        🧠 Generate Design Specification
      </button>
    </div>
  );
}
