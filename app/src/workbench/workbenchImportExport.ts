import type { DesignSpecification } from '../trend/designSpecTypes';
import { parseDesignSpecificationJson } from '../trend/designSpecValidation';
import { exportTrendPackJson, importTrendPackJson, type TrendPack } from '../trend/trendPacks';
import { downloadBlobFile } from '../export/svgExporter';
import { buildCollectionFromDesignSpec } from '../trend/designSpecCollection';
import { buildCollectionSpecification } from '../trend/collectionPlan';
import { validateMarketplaceProfileData, type ValidationIssue } from '../validators';
import { MARKETPLACE_DATA_BY_ID, type MarketplaceProfileData } from '../marketplaces';
import {
  parseWorkspaceSettingsJson,
  serializeWorkspaceSettings,
  type WorkspaceSettings,
} from './workspaceSettings';

// Design Workbench Section 9/10 ("Import / Export"). Thin file I/O glue
// only — parsing/serialization is entirely delegated to the existing
// engine functions (trend/designSpecValidation.ts, trend/trendPacks.ts,
// trend/collectionPlan.ts, workbench/workspaceSettings.ts, validators/*);
// this module just turns their JSON strings into a downloaded file, and a
// dropped/picked File into a JSON string to feed back into them.
//
// Honest scope note on "Import Marketplace Profiles" (Phase 6, Section
// 10): `marketplaces/index.ts`'s `MARKETPLACE_DATA` is a static array
// built from the 6 committed JSON files at build time — there is no
// runtime registry a freshly-imported profile could be added to without a
// real backend or a rebuild. `readMarketplaceProfileFile` below is
// therefore honestly scoped to validating an uploaded profile against the
// real schema (`validators/index.ts`'s `validateMarketplaceProfileData`,
// the same validator that gates the committed profiles in
// marketplaceProfiles.test.ts) and returning the parsed data plus any
// issues for read-only inspection — it does not pretend the app can start
// using an imported profile for SEO/filenames/readiness scoring this
// session.

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function safeFileNamePart(text: string): string {
  return text.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'design-spec';
}

export function exportDesignSpecificationFile(spec: DesignSpecification): void {
  const filename = `${safeFileNamePart(spec.project.name)}-design-spec.json`;
  downloadBlobFile(filename, new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json;charset=utf-8' }));
}

export async function readDesignSpecificationFile(file: File): Promise<DesignSpecification> {
  const text = await readFileAsText(file);
  return parseDesignSpecificationJson(text);
}

export function exportTrendPackFile(pack: TrendPack): void {
  const filename = `${safeFileNamePart(pack.id)}-trend-pack.json`;
  downloadBlobFile(filename, new Blob([exportTrendPackJson(pack)], { type: 'application/json;charset=utf-8' }));
}

export async function readTrendPackFile(file: File): Promise<TrendPack> {
  const text = await readFileAsText(file);
  return importTrendPackJson(text);
}

export function exportWorkspaceSettingsFile(settings: WorkspaceSettings): void {
  downloadBlobFile('workbench-settings.json', new Blob([serializeWorkspaceSettings(settings)], { type: 'application/json;charset=utf-8' }));
}

export async function readWorkspaceSettingsFile(file: File): Promise<WorkspaceSettings> {
  const text = await readFileAsText(file);
  return parseWorkspaceSettingsJson(text);
}

/** Builds the Collection this spec/seed would generate, then the full
 * Section 7/8 Collection Specification for it (`trend/collectionPlan.ts`,
 * already used by the main Collection Studio flow) and downloads it —
 * self-contained, no dependency on a Project already having saved a
 * Collection for this exact spec/seed pair. */
export function exportCollectionSpecificationFile(spec: DesignSpecification, seed: string): void {
  const collection = buildCollectionFromDesignSpec(spec, seed);
  const collectionSpec = buildCollectionSpecification(spec, collection);
  const filename = `${safeFileNamePart(spec.project.name)}-collection-spec.json`;
  downloadBlobFile(filename, new Blob([JSON.stringify(collectionSpec, null, 2)], { type: 'application/json;charset=utf-8' }));
}

export function exportMarketplaceProfileFile(marketplaceId: string): void {
  const data = MARKETPLACE_DATA_BY_ID[marketplaceId];
  if (!data) return;
  downloadBlobFile(`${safeFileNamePart(marketplaceId)}-marketplace-profile.json`, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }));
}

export interface MarketplaceProfileImportResult {
  data: MarketplaceProfileData;
  issues: ValidationIssue[];
}

/** Validates-only — see the header comment above for why this can't
 * register the profile into the live app. */
export async function readMarketplaceProfileFile(file: File): Promise<MarketplaceProfileImportResult> {
  const text = await readFileAsText(file);
  const data = JSON.parse(text) as MarketplaceProfileData;
  return { data, issues: validateMarketplaceProfileData(data) };
}
