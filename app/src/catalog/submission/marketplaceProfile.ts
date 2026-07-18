// Build 015 — Marketplace Profiles for the Submission Center. A distinct,
// deliberately lighter-weight concept from `src/marketplaces/*.json` +
// `metadata/marketplaceProfiles.ts` (which drive SEO text generation and
// export-package building for the pattern generator's own Stock
// Submission Center). This module only carries what submission
// *readiness validation* needs (keyword count bounds, whether a
// description/category is required) — it does not duplicate or replace
// the export/SEO profile system, and reads/imports nothing from it.
//
// "Architecture must allow future marketplaces without code changes"
// (brief) is satisfied two ways: the 5 built-ins are plain data (adding
// a 6th built-in is a one-object addition, not a logic change), AND
// `registerMarketplaceProfile` lets any caller (a future settings
// screen, a config file loader, a test) add a marketplace to the live
// registry at runtime — no edit to this file is required for that path.

export interface MarketplaceProfile {
  id: string;
  label: string;
  /** True only for the 5 profiles this module ships with — informational,
   * never used to gate behavior differently. */
  builtin: boolean;
  minKeywords: number;
  maxKeywords: number;
  requiresDescription: boolean;
  requiresCategory: boolean;
}

/** Real published keyword-count ranges, reused from this repo's own
 * researched `src/marketplaces/*.json` profiles where one already exists
 * (Shutterstock/Adobe Stock/Freepik/Etsy) for consistency between the two
 * marketplace-profile systems, rather than inventing different numbers.
 * Getty Images has no existing profile in this repo — 7-50 is a
 * conservative estimate matching the same ballpark as the other stock-
 * photo marketplaces (Shutterstock/Adobe Stock/Freepik all cluster around
 * 7-50); confirm against Getty's current contributor documentation before
 * treating this as verified. */
export const BUILT_IN_MARKETPLACE_PROFILES: MarketplaceProfile[] = [
  { id: 'shutterstock', label: 'Shutterstock', builtin: true, minKeywords: 7, maxKeywords: 50, requiresDescription: true, requiresCategory: true },
  { id: 'adobestock', label: 'Adobe Stock', builtin: true, minKeywords: 7, maxKeywords: 49, requiresDescription: true, requiresCategory: true },
  { id: 'freepik', label: 'Freepik', builtin: true, minKeywords: 7, maxKeywords: 50, requiresDescription: true, requiresCategory: true },
  { id: 'gettyimages', label: 'Getty Images', builtin: true, minKeywords: 7, maxKeywords: 50, requiresDescription: true, requiresCategory: true },
  { id: 'etsy', label: 'Etsy', builtin: true, minKeywords: 5, maxKeywords: 13, requiresDescription: true, requiresCategory: true },
];

const registry = new Map<string, MarketplaceProfile>(BUILT_IN_MARKETPLACE_PROFILES.map((p) => [p.id, p]));

export class DuplicateMarketplaceProfileError extends Error {
  constructor(id: string) {
    super(`A marketplace profile with id "${id}" is already registered.`);
    this.name = 'DuplicateMarketplaceProfileError';
  }
}

/** Adds a new marketplace to the live registry without any change to this
 * file — the mechanism that makes "future marketplaces without code
 * changes" real rather than aspirational. Rejects re-registering an
 * existing id (including a built-in) rather than silently overwriting
 * it; a caller that genuinely wants to replace a profile's rules should
 * do so explicitly and deliberately elsewhere, not accidentally via a
 * same-id registration. */
export function registerMarketplaceProfile(profile: MarketplaceProfile): void {
  if (registry.has(profile.id)) {
    throw new DuplicateMarketplaceProfileError(profile.id);
  }
  registry.set(profile.id, profile);
}

export function getMarketplaceProfile(id: string): MarketplaceProfile | undefined {
  return registry.get(id);
}

export function isKnownMarketplace(id: string): boolean {
  return registry.has(id);
}

/** Listed in insertion order — the 5 built-ins first, then any
 * runtime-registered ones in the order they were added. */
export function listMarketplaceProfiles(): MarketplaceProfile[] {
  return [...registry.values()];
}

/** Test-only escape hatch: the registry is module-level mutable state
 * (deliberately, so `registerMarketplaceProfile` can work at all), so
 * tests that register a profile need a way back to a clean baseline
 * without leaking state into unrelated test files. */
export function resetMarketplaceProfileRegistry(): void {
  registry.clear();
  for (const profile of BUILT_IN_MARKETPLACE_PROFILES) registry.set(profile.id, profile);
}
