import type { GenerateParams } from '../engine/types';
import { buildFilenameParts } from '../export/svgExporter';
import type { MarketplaceProfile } from './marketplaceProfiles';

// Filename Engine — marketplace-specific filenames from a configurable
// template (`profile.filenameRules.template`), instead of one generic
// filename shape reused everywhere. Reuses `buildFilenameParts` (the exact
// same palette/category/layout labels the app's own single-file export
// already uses) so a marketplace-specific filename and the plain "Export
// SVG" filename never drift into describing the same pattern differently.

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Resolves a filename template's placeholders — {palette} {category}
 * {layout} {seed} {site} — against one pattern's real params. Every
 * placeholder is optional; an unrecognized one is left as literal text
 * (never throws), so a hand-edited custom template with a typo just
 * produces a slightly odd filename instead of breaking export. */
export function resolveFilenameTemplate(template: string, params: GenerateParams, marketplaceId: string): string {
  const [paletteName, categoryName, layoutName] = buildFilenameParts(params);
  const safeSeed = slugify(params.seed) || 'seed';
  const replacements: Record<string, string> = {
    palette: slugify(paletteName),
    category: slugify(categoryName),
    layout: slugify(layoutName),
    seed: safeSeed,
    site: slugify(marketplaceId),
  };
  return template.replace(/\{(\w+)\}/g, (match, key: string) => replacements[key] ?? match);
}

/** Builds one marketplace-specific filename (no extension) — the template
 * comes from the profile by default, but `customTemplate` lets the user
 * override it (the Filename Engine's "allow user customization"
 * requirement) without touching the profile config itself. Truncates to
 * the profile's `filenameRules.maxLength` at a hyphen boundary so a very
 * long category/palette combination never produces a filename a
 * marketplace's upload form would reject outright. */
export function buildMarketplaceFilenameBase(
  params: GenerateParams,
  profile: MarketplaceProfile,
  customTemplate?: string,
): string {
  const resolved = resolveFilenameTemplate(customTemplate ?? profile.filenameRules.template, params, profile.id);
  const { maxLength } = profile.filenameRules;
  if (resolved.length <= maxLength) return resolved;
  const cut = resolved.slice(0, maxLength);
  const lastHyphen = cut.lastIndexOf('-');
  return lastHyphen > 0 ? cut.slice(0, lastHyphen) : cut;
}

export function buildMarketplaceFilename(
  params: GenerateParams,
  profile: MarketplaceProfile,
  customTemplate?: string,
): string {
  return `${buildMarketplaceFilenameBase(params, profile, customTemplate)}.${profile.filenameRules.extension}`;
}

/** Avoids duplicate filenames within one export batch (e.g. a Collection's
 * 5 pattern assets, which could legitimately resolve to the same slug if
 * two share palette/category/layout and only differ by seed suffix
 * collision, or a user-edited custom template that drops the {seed}
 * placeholder entirely) — appends `-2`, `-3`, ... until the name is free.
 * `used` is mutated in place so repeated calls against the same batch
 * naturally build up the full used-name set. */
export function dedupeFilename(filename: string, used: Set<string>): string {
  if (!used.has(filename)) {
    used.add(filename);
    return filename;
  }
  const dotIndex = filename.lastIndexOf('.');
  const base = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const ext = dotIndex > 0 ? filename.slice(dotIndex) : '';
  let n = 2;
  let candidate = `${base}-${n}${ext}`;
  while (used.has(candidate)) {
    n++;
    candidate = `${base}-${n}${ext}`;
  }
  used.add(candidate);
  return candidate;
}
