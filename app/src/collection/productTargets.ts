// Product Targets — Commercial Collection Engine Phase 4, Section 6. A
// deliberately honest rule-based recommender (no ML, no invented "AI
// confidence" numbers): each of the 10 named product uses has a real,
// inspectable rule (keyword hints, well-suited generator categories, and
// tile-size/density fit bands) and every score is the sum of which of
// those rules actually fired for the given collection — the same
// "real, narrowly-scoped, directly-tested" convention every other scoring
// module in this app follows (engine/scoring.ts, collection/collectionScore.ts).

export type ProductUseId =
  | 'wallpaper'
  | 'fabric'
  | 'wrappingPaper'
  | 'giftWrap'
  | 'packaging'
  | 'notebookCovers'
  | 'stationery'
  | 'homeDecor'
  | 'textile'
  | 'digitalPaper';

export const PRODUCT_USE_IDS: ProductUseId[] = [
  'wallpaper', 'fabric', 'wrappingPaper', 'giftWrap', 'packaging',
  'notebookCovers', 'stationery', 'homeDecor', 'textile', 'digitalPaper',
];

const PRODUCT_USE_LABELS: Record<ProductUseId, string> = {
  wallpaper: 'Wallpaper',
  fabric: 'Fabric',
  wrappingPaper: 'Wrapping Paper',
  giftWrap: 'Gift Wrap',
  packaging: 'Packaging',
  notebookCovers: 'Notebook Covers',
  stationery: 'Stationery',
  homeDecor: 'Home Decor',
  textile: 'Textile',
  digitalPaper: 'Digital Paper',
};

interface ProductUseRule {
  /** Lowercase words/phrases — if any appears in the caller's free-text
   * signal (commercial category + primary/secondary keywords), this
   * product gets a strong, explicit-intent bonus. */
  keywords: string[];
  /** Generator category ids this product traditionally suits well. */
  categories: string[];
  minTileSize?: number;
  maxTileSize?: number;
  minDensity?: number;
  maxDensity?: number;
}

const RULES: Record<ProductUseId, ProductUseRule> = {
  wallpaper: { keywords: ['wallpaper', 'wall mural', 'mural'], categories: ['botanical', 'damask', 'mandala', 'tropical', 'organic'], minTileSize: 1200 },
  fabric: { keywords: ['fabric', 'apparel', 'upholstery', 'quilt', 'quilting'], categories: ['botanical', 'tropical', 'paisley', 'plaid', 'animalprint', 'boho'], minTileSize: 1000 },
  wrappingPaper: { keywords: ['wrapping paper', 'wrap'], categories: ['cute', 'seasonal', 'geometric', 'retro'], maxTileSize: 1400 },
  giftWrap: { keywords: ['gift wrap', 'gift'], categories: ['cute', 'seasonal', 'retro', 'geometric'], maxTileSize: 1400 },
  packaging: { keywords: ['packaging', 'box', 'label'], categories: ['geometric', 'plaid', 'terrazzo', 'lineart'], maxDensity: 0.6 },
  notebookCovers: { keywords: ['notebook', 'journal', 'planner', 'cover'], categories: ['geometric', 'mandala', 'boho', 'lineart'], maxTileSize: 1200 },
  stationery: { keywords: ['stationery', 'card', 'paper goods', 'invitation'], categories: ['geometric', 'cute', 'lineart', 'damask'], maxDensity: 0.55 },
  homeDecor: { keywords: ['home decor', 'decor', 'cushion', 'pillow', 'rug', 'throw'], categories: ['damask', 'botanical', 'mandala', 'terrazzo'], minDensity: 0.4 },
  textile: { keywords: ['textile', 'yardage', 'curtain', 'upholstery'], categories: ['botanical', 'tropical', 'damask', 'paisley'], minTileSize: 1000 },
  digitalPaper: { keywords: ['digital paper', 'scrapbook', 'printable'], categories: ['cute', 'geometric', 'retro', 'plaid'], maxTileSize: 1400 },
};

export interface ProductUseEvaluation {
  id: ProductUseId;
  label: string;
  /** 0-100, the sum of whichever real rules below actually fired. */
  score: number;
  /** score >= SUITABILITY_THRESHOLD. */
  suitable: boolean;
  /** One entry per rule that actually fired — always traceable back to a
   * real input signal, never generic marketing copy. */
  reasons: string[];
}

export interface ProductTargetsInput {
  /** A real generator category id (`GenerateParams.categoryId`). */
  categoryId: string;
  tileSize: number;
  density: number;
  /** Free text to scan for explicit product-intent keywords — callers
   * typically join commercialCategory + primaryKeyword + secondaryKeywords.
   * Matching is case-insensitive; this function lowercases internally. */
  keywordText: string;
}

const SUITABILITY_THRESHOLD = 60;

/** Scores all 10 named product uses (Section 6) against one collection's
 * real, already-resolved signals. Always returns all 10, sorted by score
 * descending, so a caller can either show the full evaluated table
 * (Section 6) or take the top N as "recommended" (Section 1). */
export function evaluateProductTargets(input: ProductTargetsInput): ProductUseEvaluation[] {
  const text = input.keywordText.toLowerCase();
  const results = PRODUCT_USE_IDS.map((id): ProductUseEvaluation => {
    const rule = RULES[id];
    let score = 40; // neutral baseline — every product starts "possible"
    const reasons: string[] = [];

    const matchedKeyword = rule.keywords.find((kw) => text.includes(kw));
    if (matchedKeyword) {
      score += 35;
      reasons.push(`matches your product/keyword intent ("${matchedKeyword}")`);
    }

    if (rule.categories.includes(input.categoryId)) {
      score += 15;
      reasons.push(`this motif category is well-suited to ${PRODUCT_USE_LABELS[id]}`);
    }

    if (rule.minTileSize !== undefined || rule.maxTileSize !== undefined) {
      const withinMin = rule.minTileSize === undefined || input.tileSize >= rule.minTileSize;
      const withinMax = rule.maxTileSize === undefined || input.tileSize <= rule.maxTileSize;
      if (withinMin && withinMax) {
        score += 10;
        reasons.push(`tile size (${input.tileSize}px) fits ${PRODUCT_USE_LABELS[id]}'s typical repeat scale`);
      } else {
        score -= 10;
      }
    }

    if (rule.minDensity !== undefined || rule.maxDensity !== undefined) {
      const withinMin = rule.minDensity === undefined || input.density >= rule.minDensity;
      const withinMax = rule.maxDensity === undefined || input.density <= rule.maxDensity;
      if (withinMin && withinMax) {
        score += 10;
        reasons.push(`pattern density fits ${PRODUCT_USE_LABELS[id]}'s typical look`);
      } else {
        score -= 10;
      }
    }

    return { id, label: PRODUCT_USE_LABELS[id], score: Math.max(0, Math.min(100, score)), suitable: false, reasons };
  });

  for (const r of results) r.suitable = r.score >= SUITABILITY_THRESHOLD;
  return results.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/** Takes the already-sorted output of `evaluateProductTargets` and returns
 * the recommended subset (Section 1's single "Recommended Product Uses"
 * field) — every `suitable` entry, capped at `max`, or (if nothing cleared
 * the suitability bar) the top `max` anyway so a Collection Plan is never
 * left with an empty recommendation list. */
export function recommendedProductUses(evaluations: ProductUseEvaluation[], max = 4): ProductUseId[] {
  const suitable = evaluations.filter((e) => e.suitable);
  const pool = suitable.length > 0 ? suitable : evaluations;
  return pool.slice(0, max).map((e) => e.id);
}
