// AI-SBOS v3, Milestone 4 — Keyword Intent Engine. Converts a free-text
// keyword/phrase into structured design intent using ONLY local,
// deterministic, inspectable rules over data that already exists in the
// shared engine (`STYLE_DNA_DATA`, `GENERATOR_LIST`) — no new AI/ML
// model, no network call, no fabricated market-demand claim. Every field
// below is either directly derived from a real matched `StyleDnaData`
// record or from an explicit, readable keyword->bucket rule table in this
// file — nothing is invented at runtime.
import { STYLE_DNA_DATA, type StyleDnaData } from '../style-dna';
import { GENERATOR_LIST } from '../generators';

export type DensityBucket = 'low' | 'medium' | 'high';

export interface DesignIntent {
  keyword: string;
  tokens: string[];
  subject: string;
  style: string;
  styleDnaId?: string;
  categoryId: string;
  motifComplexity: string;
  density: DensityBucket;
  paletteDirection: string;
  paletteId?: string;
  composition: string;
  targetUses: string[];
  commercialIntent: string;
  /** 0-100. A measure of keyword<->library token overlap, NOT a market
   * signal. Deliberately capped below 100 — a keyword match to a
   * hand-authored style preset is evidence of relevance, never proof of
   * commercial demand. */
  confidence: number;
  matchedTokens: string[];
  /** Always true — this engine runs entirely from local data bundled in
   * the app, no network access of any kind. */
  offline: true;
}

function tokenize(raw: string): string[] {
  return raw
    .toLowerCase()
    .split(/[,;/]|\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function scoreStyleDna(tokens: string[], dna: StyleDnaData): { score: number; matched: string[] } {
  const haystack = `${dna.label} ${dna.description} ${dna.categories.join(' ')}`.toLowerCase();
  const matched: string[] = [];
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 1;
      matched.push(token);
    }
  }
  return { score, matched };
}

function scoreCategory(tokens: string[], categoryId: string, label: string, description: string): { score: number; matched: string[] } {
  const haystack = `${categoryId} ${label} ${description}`.toLowerCase();
  const matched: string[] = [];
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 1;
      matched.push(token);
    }
  }
  return { score, matched };
}

const DENSE_TOKENS = ['dense', 'busy', 'maximal', 'packed', 'rich', 'lush', 'ornate'];
const SPARSE_TOKENS = ['minimal', 'sparse', 'simple', 'airy', 'clean', 'subtle', 'quiet'];

function inferDensity(tokens: string[], fallback: number): DensityBucket {
  if (tokens.some((t) => DENSE_TOKENS.includes(t))) return 'high';
  if (tokens.some((t) => SPARSE_TOKENS.includes(t))) return 'low';
  if (fallback >= 0.6) return 'high';
  if (fallback <= 0.35) return 'low';
  return 'medium';
}

const USE_RULES: Array<{ tokens: string[]; use: string }> = [
  { tokens: ['kids', 'nursery', 'baby', 'children', 'dinosaur'], use: 'Nursery / kids apparel' },
  { tokens: ['wallpaper'], use: 'Wallpaper' },
  { tokens: ['textile', 'fabric'], use: 'Textile / fabric print' },
  { tokens: ['christmas', 'holiday', 'seasonal'], use: 'Seasonal / holiday stock' },
  { tokens: ['luxury', 'premium'], use: 'Premium packaging / stationery' },
  { tokens: ['boho', 'rainbow'], use: 'Home decor / lifestyle print' },
];

function inferTargetUses(tokens: string[]): string[] {
  const uses = new Set<string>();
  for (const rule of USE_RULES) {
    if (rule.tokens.some((t) => tokens.includes(t))) uses.add(rule.use);
  }
  uses.add('Surface pattern / stock vector marketplace');
  return Array.from(uses);
}

/** Deterministic, keyword->text-only. Never claims a demand number or
 * trend signal — only describes the intended commercial USE category,
 * which is not a market-demand claim. */
function describeCommercialIntent(targetUses: string[]): string {
  return `General commercial licensing for ${targetUses[0].toLowerCase()} via stock marketplaces (no market-demand data consulted — this is a use-case description only).`;
}

export function analyzeKeyword(rawKeyword: string): DesignIntent {
  const keyword = rawKeyword.trim();
  const tokens = tokenize(keyword);

  let bestDna: StyleDnaData | null = null;
  let bestScore = 0;
  let bestMatched: string[] = [];
  for (const dna of STYLE_DNA_DATA) {
    const { score, matched } = scoreStyleDna(tokens, dna);
    if (score > bestScore) {
      bestScore = score;
      bestDna = dna;
      bestMatched = matched;
    }
  }

  let categoryId = bestDna?.categories[0] ?? 'organic';
  let subject = bestDna?.label ?? 'General pattern';
  let matchedTokens = bestMatched;

  if (!bestDna) {
    // Fall back to matching a raw generator category directly (e.g. a
    // keyword like "geometric" or "tropical" with no StyleDna preset
    // built around it yet).
    let bestCatScore = 0;
    for (const gen of GENERATOR_LIST) {
      const { score, matched } = scoreCategory(tokens, gen.id, gen.label, gen.description);
      if (score > bestCatScore) {
        bestCatScore = score;
        categoryId = gen.id;
        subject = gen.label;
        matchedTokens = matched;
      }
    }
  }

  const style = bestDna?.label ?? subject;
  const density = inferDensity(tokens, bestDna?.density ?? 0.5);
  const targetUses = inferTargetUses(tokens);

  const confidenceFromMatch = Math.min(90, 30 + matchedTokens.length * 20);
  const confidence = tokens.length === 0 ? 0 : confidenceFromMatch;

  return {
    keyword,
    tokens,
    subject,
    style,
    styleDnaId: bestDna?.id,
    categoryId,
    motifComplexity: bestDna?.motifComplexity ?? 'medium',
    density,
    paletteDirection: bestDna ? `${bestDna.colorStrategy} (${bestDna.paletteIds.join(', ')})` : 'Commercial-neutral (auto-selected at generation)',
    paletteId: bestDna?.paletteIds[0],
    composition: bestDna ? `${bestDna.flowProfile} flow, ${bestDna.rhythmProfile} rhythm, ${bestDna.clusterStyle} clustering` : 'Balanced, marketplace-safe composition',
    targetUses,
    commercialIntent: describeCommercialIntent(targetUses),
    confidence,
    matchedTokens,
    offline: true,
  };
}
