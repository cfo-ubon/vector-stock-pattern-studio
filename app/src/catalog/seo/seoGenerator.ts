import { getSeoProfile } from './seoProfile';
import { deduplicateKeywords } from './keywordDeduplicator';
import { validateSeoContent } from './seoValidator';
import type { SeoContentInput, SeoValidationReport } from './seoValidator';
import { computeSeoScore } from './seoScoring';
import type { SeoScoreReport } from './seoScoring';

// Build 016 — SEO Generator. An honest scope note: this engine has no
// access to a pattern's visual content (see `seoProfile.ts`'s module
// header on decoupling), so it cannot invent title/description copy
// from nothing. What it generates is a marketplace-*adapted* package
// from caller-supplied candidate content — deduplicating keywords,
// trimming the keyword list to the marketplace's count bound, and
// truncating title/description at a word boundary to the marketplace's
// length bound — then validates and scores the result it actually
// produced, not the caller's original input. A future creative-copy
// generator (drawing on Trend Intelligence Studio's keyword/style data,
// for instance) can sit in front of this module without this module
// needing to change: it would just become another `SeoContentInput`
// producer.

export interface SeoPackage {
  marketplaceId: string;
  title: string;
  description: string;
  keywords: string[];
  validation: SeoValidationReport;
  score: SeoScoreReport;
}

export class UnknownSeoMarketplaceError extends Error {
  constructor(marketplaceId: string) {
    super(`"${marketplaceId}" is not a registered SEO profile.`);
    this.name = 'UnknownSeoMarketplaceError';
  }
}

function truncateAtWordBoundary(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const slice = trimmed.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trim();
}

/** Throws (unlike `seoValidator.ts`, whose "never throw" requirement is
 * scoped explicitly to SEO Validation) — an unknown marketplace means
 * there is no profile to adapt content *to* at all, a programming error
 * on the caller's part rather than a validatable content problem. */
export function generateSeoPackage(input: SeoContentInput, marketplaceId: string): SeoPackage {
  const profile = getSeoProfile(marketplaceId);
  if (!profile) throw new UnknownSeoMarketplaceError(marketplaceId);

  const { unique: dedupedKeywords } = deduplicateKeywords(input.keywords);
  const keywords = dedupedKeywords.slice(0, profile.keywords.maxCount).map((k) => (k.length > profile.keywords.maxKeywordLength ? k.slice(0, profile.keywords.maxKeywordLength).trim() : k));

  const title = truncateAtWordBoundary(input.title, profile.title.maxLength);
  const description = input.description.trim() ? truncateAtWordBoundary(input.description, profile.description.maxLength) : '';

  const content: SeoContentInput = { title, description, keywords };
  return {
    marketplaceId,
    title,
    description,
    keywords,
    validation: validateSeoContent(content, marketplaceId),
    score: computeSeoScore(content, marketplaceId),
  };
}
