import type { PortfolioAsset, PortfolioFileRecord } from '../catalog/domain/types';
import type { Collection } from '../catalog/domain/collection';
import type { SubmissionRecord } from '../catalog/submission/submissionRecord';
import { buildAssetZipEntries } from '../catalog/services/exportAsset';
import { buildZip, type ZipEntry } from '../export/zip';
import { MARKETPLACE_PROFILES, type MarketplaceId } from '../metadata/marketplaceProfiles';
import { sanitizeZipEntryName } from '../catalog/submission/submissionPackageBuilder';
import type { CommercialReadinessReport, CommercialPackageManifest, CommercialPackageResult, CommercialPackageStatus } from './domain/types';

// Build 031A, Phase 2 — Commercial Package Builder. Generalizes
// `catalog/submission/submissionPackageBuilder.ts`'s ZIP-assembly pattern
// (reusing its own `buildAssetZipEntries`/`sanitizeZipEntryName` rather
// than re-implementing them) beyond one (asset, submission) pair: a
// Commercial Package can be built for any READY-enough asset even before a
// marketplace submission exists, embedding whatever real SEO/collection/
// traceability data is actually on hand and honestly labeling anything
// that isn't (`hasSubmission: false`, empty keyword list) rather than
// inventing placeholder text. If the target marketplace profile isn't yet
// verified (`contributorUrlVerified === false`) or is still `future`, the
// package is still built — but its status is `NEEDS_VERIFICATION`, the
// exact wording Phase 2 of the spec asks for, never a silent failure.

export class CommercialPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommercialPackageError';
  }
}

export interface PackageBuilderInput {
  asset: PortfolioAsset;
  files: PortfolioFileRecord[];
  marketplaceId: MarketplaceId;
  readiness: CommercialReadinessReport;
  /** The best available submission for this asset (if any) — its
   * title/description/keywords are embedded as-is, never regenerated. */
  submission: SubmissionRecord | null;
  /** Collections this asset belongs to, resolved by the caller from
   * `asset.collectionIds` — only used for display names in the manifest. */
  collections: Collection[];
}

function safeFilenameFragment(value: string): string {
  return (
    value
      .replace(/[^a-z0-9-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'untitled'
  );
}

function sanitizeZipEntries(entries: ZipEntry[]): ZipEntry[] {
  const used = new Set<string>();
  return entries.map((entry) => {
    let name = sanitizeZipEntryName(entry.name);
    let n = 2;
    while (used.has(name)) {
      name = `${sanitizeZipEntryName(entry.name)}-${n}`;
      n += 1;
    }
    used.add(name);
    return { name, data: entry.data };
  });
}

function resolveStatus(profile: { future: boolean; contributorUrlVerified: boolean }): CommercialPackageStatus {
  return profile.future || !profile.contributorUrlVerified ? 'NEEDS_VERIFICATION' : 'BUILT';
}

export async function buildCommercialPackage(input: PackageBuilderInput): Promise<CommercialPackageResult> {
  const { asset, files, marketplaceId, readiness, submission, collections } = input;
  const profile = MARKETPLACE_PROFILES[marketplaceId];
  if (!profile) {
    throw new CommercialPackageError(`"${marketplaceId}" is not a registered marketplace profile — cannot build a Commercial Package for it.`);
  }

  const status = resolveStatus(profile);
  const verificationNotes: string[] = [];
  if (status === 'NEEDS_VERIFICATION') {
    if (profile.future) verificationNotes.push(`"${profile.label}" isn't yet a verified, ready-to-submit marketplace in this app.`);
    if (!profile.contributorUrlVerified) verificationNotes.push(`"${profile.label}"'s contributor portal link hasn't been manually verified.`);
  }

  const usedNames = new Set<string>(['manifest.json', 'readiness-report.json']);
  const { entries: rawEntries } = await buildAssetZipEntries(asset, files, usedNames);
  const assetEntries = sanitizeZipEntries(rawEntries);

  const manifest: CommercialPackageManifest = {
    manifestVersion: 1,
    builtAt: Date.now(),
    marketplaceId: profile.id,
    marketplaceLabel: profile.label,
    status,
    readiness: { score: readiness.score, band: readiness.band },
    asset: { assetId: asset.assetId, displayName: asset.displayName, productionAssetId: asset.productionAssetId },
    seo: {
      hasSubmission: submission !== null,
      title: submission?.titleSnapshot ?? '',
      description: submission?.descriptionSnapshot ?? '',
      keywords: submission?.keywordSnapshot ?? [],
    },
    collection: {
      collectionIds: asset.collectionIds,
      collectionNames: collections.map((c) => c.name),
    },
    traceability: {
      generatorVersion: asset.generatorVersion,
      presetId: asset.presetId,
      styleDna: asset.styleDna,
      generatorSeed: asset.generatorSeed,
      productionAssetId: asset.productionAssetId,
    },
    verificationNotes,
  };

  const textEntries: ZipEntry[] = [
    { name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) },
    { name: 'readiness-report.json', data: new TextEncoder().encode(JSON.stringify(readiness, null, 2)) },
  ];

  const blob = buildZip([...textEntries, ...assetEntries]);
  const filename = `${safeFilenameFragment(profile.id)}-${safeFilenameFragment(asset.displayName)}-${asset.assetId}-commercial-package.zip`;

  return { blob, filename, manifest };
}
