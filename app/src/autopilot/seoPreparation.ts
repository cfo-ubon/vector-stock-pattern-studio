import type { GenerateParams, TileData } from '../engine/types';
import { computeCore } from '../metadata/shutterstock';
import type { SeoContentInput } from '../catalog/seo/seoValidator';
import { generatePatternSeoForMarketplaces, type PatternSeoResult } from '../catalog/seo/batchSeoService';
import { listSeoProfiles } from '../catalog/seo/seoProfile';
import type { PortfolioAsset } from '../catalog/domain/types';
import { getPortfolioFile } from '../catalog/storage/portfolioStore';

/** Reads back the real `GenerateParams` an autopilot-generated asset was
 * built with, from its own JSON sidecar file (the same
 * `metadataReference` every import — manual or autopilot — already
 * writes). Returns `null` honestly when no sidecar exists or it doesn't
 * parse, rather than fabricating params. */
export async function loadGenerateParamsForAsset(asset: PortfolioAsset): Promise<GenerateParams | null> {
  if (!asset.metadataReference) return null;
  const file = await getPortfolioFile(asset.metadataReference);
  if (!file) return null;
  try {
    const text = await file.blob.text();
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as GenerateParams) : null;
  } catch {
    return null;
  }
}

// Build 029, Module 9 — Automatic SEO and Export Prep. Reuses two already-
// verified, already-shipped systems rather than inventing new ones: the
// real per-pattern content generator `metadata/shutterstock.ts`'s
// `computeCore` (title/description/exactly-50-canonical-English-keywords,
// Build 016's own engine) and the real per-marketplace SEO validation/
// scoring pipeline `catalog/seo/batchSeoService.ts` (Build 016). This
// module only bridges the two — no new keyword generation, no new
// marketplace rule invented here.

/** The Design Plan's `targetMarketplace` is a human display label (e.g.
 * "Adobe Stock", "Getty-iStock"); the SEO profile registry keys on a
 * lowercase id (e.g. "adobestock"). This table only maps names to real,
 * registered profile ids — it never invents a marketplace rule of its
 * own. `null` for a label with no matching registered profile (including
 * "Auto", which is not a real marketplace). */
const MARKETPLACE_LABEL_TO_SEO_PROFILE_ID: Record<string, string> = {
  shutterstock: 'shutterstock',
  'adobe stock': 'adobestock',
  adobestock: 'adobestock',
  freepik: 'freepik',
  'getty images': 'gettyimages',
  'getty-istock': 'gettyimages',
  gettyimages: 'gettyimages',
  istock: 'gettyimages',
  etsy: 'etsy',
};

export function resolveSeoProfileId(marketplaceLabel: string): string | null {
  const id = MARKETPLACE_LABEL_TO_SEO_PROFILE_ID[marketplaceLabel.trim().toLowerCase()];
  if (!id) return null;
  return listSeoProfiles().some((p) => p.id === id) ? id : null;
}

/** Builds real SEO candidate content from the pattern's own generator
 * params — the exact real title/description/keyword generator every
 * manual per-site metadata panel already uses (Build 016's
 * `computeCore`), never a fabricated summary. `computeCore` only reads
 * `tileData.params`, so a minimal `{ params }` stand-in is sufficient and
 * honest — no other `TileData` field is touched. */
export function buildSeoContentInputFromParams(params: GenerateParams): SeoContentInput {
  const core = computeCore({ params } as TileData);
  return { title: core.titleLong, description: core.description, keywords: core.keywords };
}

export type AutopilotSeoPreparationResult =
  | { status: 'ready'; results: PatternSeoResult[] }
  | { status: 'needsProfileVerification'; reason: string };

/** Module 9's per-item entry point — for one READY pattern, generates real
 * SEO packages for its target marketplace via the existing, unmodified
 * `generatePatternSeoForMarketplaces`. If the Design Plan's target
 * marketplace label doesn't resolve to a known, registered SEO profile
 * (e.g. "Auto", or a marketplace this build's SEO system doesn't cover
 * yet), this honestly reports "Needs marketplace profile verification"
 * rather than fabricating a rule or silently skipping the pattern — and
 * per Module 9's own spec, this NEVER blocks Portfolio import, only SEO
 * package generation for that one item. */
export function prepareAutopilotSeoForItem(patternId: string, params: GenerateParams, targetMarketplace: string): AutopilotSeoPreparationResult {
  const profileId = resolveSeoProfileId(targetMarketplace);
  if (!profileId) {
    return {
      status: 'needsProfileVerification',
      reason: `"${targetMarketplace}" has no registered SEO profile — needs marketplace profile verification.`,
    };
  }
  const content = buildSeoContentInputFromParams(params);
  const results = generatePatternSeoForMarketplaces({ patternId, content }, [profileId]);
  return { status: 'ready', results };
}
