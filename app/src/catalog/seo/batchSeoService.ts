import { generateSeoPackage } from './seoGenerator';
import type { SeoPackage } from './seoGenerator';
import type { SeoContentInput } from './seoValidator';
import { listSeoProfiles } from './seoProfile';

// Build 016 — Batch SEO Service. The brief's three named modes: "Single
// Pattern, Multiple Patterns, Marketplace-specific generation." A thin
// orchestration layer over `seoGenerator.ts` — no new generation/
// scoring/validation logic lives here, only the fan-out across patterns
// and marketplaces. `patternId` is a plain string, the same decoupling
// choice `catalog/submission/submissionRecord.ts` made for the same
// reason: this engine never needs to know what a pattern actually is.

export interface PatternSeoRequest {
  patternId: string;
  content: SeoContentInput;
}

export interface PatternSeoResult {
  patternId: string;
  marketplaceId: string;
  package: SeoPackage;
}

/** Single pattern, single marketplace. */
export function generatePatternSeo(request: PatternSeoRequest, marketplaceId: string): PatternSeoResult {
  return { patternId: request.patternId, marketplaceId, package: generateSeoPackage(request.content, marketplaceId) };
}

/** Single pattern, every requested marketplace — defaults to every
 * currently-registered profile (built-in + any runtime-registered ones)
 * when `marketplaceIds` is omitted, so a newly `registerSeoProfile`'d
 * marketplace is included automatically with no call-site change. */
export function generatePatternSeoForMarketplaces(request: PatternSeoRequest, marketplaceIds?: string[]): PatternSeoResult[] {
  const targets = marketplaceIds ?? listSeoProfiles().map((p) => p.id);
  return targets.map((marketplaceId) => generatePatternSeo(request, marketplaceId));
}

/** Multiple patterns x multiple marketplaces — the full cross product,
 * flattened into one result list. Each `(pattern, marketplace)` pair is
 * generated independently (one pattern's content never influences
 * another's), so this is safe to call with an arbitrarily large
 * `requests` list — see `SEO_TEST_REPORT.md`'s large-dataset coverage. */
export function generateBatchSeo(requests: PatternSeoRequest[], marketplaceIds: string[]): PatternSeoResult[] {
  const results: PatternSeoResult[] = [];
  for (const request of requests) {
    for (const marketplaceId of marketplaceIds) {
      results.push(generatePatternSeo(request, marketplaceId));
    }
  }
  return results;
}
