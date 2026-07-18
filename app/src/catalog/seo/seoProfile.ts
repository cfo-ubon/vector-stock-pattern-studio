// Build 016 — SEO Profile. The data half of "how does marketplace X's
// listing form constrain title/description/keywords" — the rule-
// evaluation half lives in `marketplaceRules.ts`, which reads this same
// profile shape. Deliberately its own registry, NOT a re-export or
// extension of `catalog/submission/marketplaceProfile.ts`'s
// `MarketplaceProfile` (which only carries what Submission Center's
// *readiness gate* needs — keyword count + description/category
// requiredness) or of `src/marketplaces/*.json` (the pattern generator's
// own SEO/export-package system). The brief requires this engine to be
// "completely service-layer and reusable" — a hard dependency on
// Submission Center's module would make that untrue, and "Do NOT modify
// Submission Center architecture" is trivially satisfied by never
// importing from it at all. Both registries happen to use the same
// marketplace id strings (`shutterstock`, `adobestock`, `freepik`,
// `gettyimages`, `etsy`), so a future integration layer can bridge them
// by id equality without either module depending on the other.

export interface SeoProfile {
  id: string;
  label: string;
  /** True only for the 5 profiles this module ships with. */
  builtin: boolean;
  title: { minLength: number; maxLength: number };
  description: { required: boolean; minLength: number; maxLength: number };
  keywords: { minCount: number; maxCount: number; maxKeywordLength: number };
}

/** Real published length/count bounds, reused from this repo's own
 * researched `src/marketplaces/*.json` profiles where one already exists
 * (Shutterstock/Adobe Stock/Freepik/Etsy) so the two independent SEO rule
 * systems in this repo do not quietly disagree about the same real-world
 * marketplace. Getty Images has no existing profile in this repo — its
 * bounds here are a conservative estimate in the same ballpark as the
 * other stock-photo marketplaces (title 20-200, description required,
 * 7-50 keywords); confirm against Getty's current contributor
 * documentation before treating this as verified. `maxKeywordLength`
 * defaults to a generous 60 characters except Etsy, whose real tag limit
 * (20 characters) is a hard platform constraint worth modeling exactly. */
export const BUILT_IN_SEO_PROFILES: SeoProfile[] = [
  { id: 'shutterstock', label: 'Shutterstock', builtin: true, title: { minLength: 20, maxLength: 200 }, description: { required: true, minLength: 20, maxLength: 200 }, keywords: { minCount: 7, maxCount: 50, maxKeywordLength: 60 } },
  { id: 'adobestock', label: 'Adobe Stock', builtin: true, title: { minLength: 20, maxLength: 70 }, description: { required: false, minLength: 0, maxLength: 200 }, keywords: { minCount: 7, maxCount: 49, maxKeywordLength: 60 } },
  { id: 'freepik', label: 'Freepik', builtin: true, title: { minLength: 20, maxLength: 100 }, description: { required: false, minLength: 0, maxLength: 200 }, keywords: { minCount: 7, maxCount: 50, maxKeywordLength: 60 } },
  { id: 'gettyimages', label: 'Getty Images', builtin: true, title: { minLength: 20, maxLength: 200 }, description: { required: true, minLength: 20, maxLength: 200 }, keywords: { minCount: 7, maxCount: 50, maxKeywordLength: 60 } },
  { id: 'etsy', label: 'Etsy', builtin: true, title: { minLength: 10, maxLength: 140 }, description: { required: true, minLength: 40, maxLength: 5000 }, keywords: { minCount: 5, maxCount: 13, maxKeywordLength: 20 } },
];

const registry = new Map<string, SeoProfile>(BUILT_IN_SEO_PROFILES.map((p) => [p.id, p]));

export class DuplicateSeoProfileError extends Error {
  constructor(id: string) {
    super(`An SEO profile with id "${id}" is already registered.`);
    this.name = 'DuplicateSeoProfileError';
  }
}

/** "Architecture must allow new marketplace profiles without changing
 * the engine" (brief) — adds a profile to the live registry at runtime;
 * no edit to this file is required for a new marketplace to become
 * usable by every other module (`marketplaceRules.ts`, the analyzers,
 * `seoValidator.ts`, `seoScoring.ts`, `seoGenerator.ts`,
 * `batchSeoService.ts`), all of which resolve profiles exclusively
 * through `getSeoProfile`/`listSeoProfiles` below. */
export function registerSeoProfile(profile: SeoProfile): void {
  if (registry.has(profile.id)) {
    throw new DuplicateSeoProfileError(profile.id);
  }
  registry.set(profile.id, profile);
}

export function getSeoProfile(id: string): SeoProfile | undefined {
  return registry.get(id);
}

export function isKnownSeoMarketplace(id: string): boolean {
  return registry.has(id);
}

export function listSeoProfiles(): SeoProfile[] {
  return [...registry.values()];
}

/** Test-only escape hatch, same rationale as
 * `catalog/submission/marketplaceProfile.ts`'s
 * `resetMarketplaceProfileRegistry` — the registry is deliberately
 * mutable module-level state, so tests that register a profile need a
 * clean way back to the built-in baseline. */
export function resetSeoProfileRegistry(): void {
  registry.clear();
  for (const profile of BUILT_IN_SEO_PROFILES) registry.set(profile.id, profile);
}
