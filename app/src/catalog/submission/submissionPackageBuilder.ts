import type { PortfolioAsset, PortfolioFileRecord } from '../domain/types';
import type { SubmissionRecord } from './submissionRecord';
import { buildAssetZipEntries } from '../services/exportAsset';
import { buildZip, type ZipEntry } from '../../export/zip';
import { getMarketplaceProfile } from './marketplaceProfile';
import { validateSubmissionReadiness, type SubmissionValidationReport } from './submissionValidation';
import { detectDuplicateSubmission, type DuplicateDetectionResult } from './submissionDuplicateDetection';
import { sha256Hex } from '../domain/hash';

// Build 026 — Submission Package Builder (Phase 6/BUILD_026_AUDIT.md gap
// #10, "no Submission Package Builder in the brief's sense"). Assembles
// one ready-to-upload marketplace ZIP for a single (asset, submission)
// pair: the asset's own verified source files (reusing
// `services/exportAsset.ts`'s `buildAssetZipEntries` — same hash-integrity
// check every other catalog export already gets, zero duplicated logic),
// plus the paperwork a human would otherwise assemble by hand: a
// per-asset metadata JSON, title/description/keywords text files drawn
// from the submission's own snapshot fields (never regenerated — a
// contributor's edited title must survive into the package unchanged,
// the same non-negotiable `buildPackageTextFilesFromSeo` already commits
// to for the single-pattern export path), a SHA-256SUMS manifest, a
// submission checklist (`submissionValidation.ts`'s existing, unmodified
// readiness report), and a duplicate-warning report
// (`submissionDuplicateDetection.ts`'s existing, unmodified result) so a
// contributor sees any conflict before uploading rather than after a
// marketplace rejects it.

export class SubmissionPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubmissionPackageError';
  }
}

/** Strips path separators, `..` traversal segments, and control
 * characters from a name before it's allowed into the zip — defense in
 * depth on top of `buildAssetZipEntries`'s own dedup logic. Every name
 * that reaches this builder either comes from our own literal string
 * constants (`'metadata.json'`, etc.) or from a stored file's recorded
 * `filename`, but a filename is still attacker-reachable data (an
 * imported file could have been named `../../evil.txt` before it ever
 * entered the catalog), so this is the single point that guarantees no
 * entry can escape the archive root regardless of where its name came
 * from. */
export function sanitizeZipEntryName(name: string): string {
  const stripped = name
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..')
    .join('/');
  const withoutControlChars = stripped.replace(/[\x00-\x1f]/g, '');
  return withoutControlChars || 'unnamed-file';
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

export interface SubmissionPackageOptions {
  asset: PortfolioAsset;
  files: PortfolioFileRecord[];
  submission: SubmissionRecord;
  /** Every other submission record in the catalog (any pattern, any
   * marketplace) — used for the checklist's duplicate-submission check
   * and the standalone duplicate-warning report. Excludes nothing itself;
   * both `validateSubmissionReadiness` and `detectDuplicateSubmission`
   * already exclude the candidate's own `submissionId`. */
  existingSubmissions: SubmissionRecord[];
}

export interface SubmissionPackageManifest {
  manifestVersion: number;
  builtAt: number;
  marketplaceId: string;
  marketplaceLabel: string;
  asset: {
    assetId: string;
    displayName: string;
    productionAssetId: string | null;
  };
  submission: {
    submissionId: string;
    patternId: string;
    version: number;
    status: string;
    title: string;
    description: string;
    keywords: string[];
    category: string | null;
  };
}

export interface SubmissionPackageResult {
  blob: Blob;
  filename: string;
  checklist: SubmissionValidationReport;
  duplicateWarnings: DuplicateDetectionResult;
}

function safeFilenameFragment(value: string): string {
  return (
    value
      .replace(/[^a-z0-9-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'untitled'
  );
}

/** Builds the complete marketplace submission package for one asset. Every
 * text/JSON file's content comes straight from the submission's own
 * snapshot fields or from existing, unmodified validation/duplicate-
 * detection modules — this function introduces no new scoring, SEO, or
 * duplicate-detection logic of its own, only assembly. */
export async function buildSubmissionPackage(options: SubmissionPackageOptions): Promise<SubmissionPackageResult> {
  const { asset, files, submission, existingSubmissions } = options;
  const profile = getMarketplaceProfile(submission.marketplaceId);
  if (!profile) {
    throw new SubmissionPackageError(`"${submission.marketplaceId}" is not a registered marketplace profile — cannot build a package for it.`);
  }

  const usedNames = new Set<string>(['manifest.json', 'title.txt', 'description.txt', 'keywords.txt', 'SHA-256SUMS.txt', 'submission-checklist.json', 'duplicate-warning-report.json']);
  const { entries: rawEntries } = await buildAssetZipEntries(asset, files, usedNames);
  const assetEntries = sanitizeZipEntries(rawEntries);

  const readiness = {
    hasSvg: asset.sourceFileReferences.some((f) => f.role === 'svg'),
    hasPreview: asset.previewReference !== null,
  };
  const checklist = validateSubmissionReadiness(submission, readiness, existingSubmissions);

  const duplicateWarnings = detectDuplicateSubmission(
    {
      patternId: submission.patternId,
      marketplaceId: submission.marketplaceId,
      version: submission.version,
      submissionId: submission.submissionId,
      productionAssetId: asset.productionAssetId,
    },
    existingSubmissions,
  );

  const manifest: SubmissionPackageManifest = {
    manifestVersion: 1,
    builtAt: Date.now(),
    marketplaceId: profile.id,
    marketplaceLabel: profile.label,
    asset: {
      assetId: asset.assetId,
      displayName: asset.displayName,
      productionAssetId: asset.productionAssetId,
    },
    submission: {
      submissionId: submission.submissionId,
      patternId: submission.patternId,
      version: submission.version,
      status: submission.status,
      title: submission.titleSnapshot,
      description: submission.descriptionSnapshot,
      keywords: submission.keywordSnapshot,
      category: submission.category,
    },
  };

  const textEntries: ZipEntry[] = [
    { name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) },
    { name: 'title.txt', data: new TextEncoder().encode(submission.titleSnapshot) },
    { name: 'description.txt', data: new TextEncoder().encode(submission.descriptionSnapshot) },
    { name: 'keywords.txt', data: new TextEncoder().encode(submission.keywordSnapshot.join(', ')) },
    { name: 'submission-checklist.json', data: new TextEncoder().encode(JSON.stringify(checklist, null, 2)) },
    { name: 'duplicate-warning-report.json', data: new TextEncoder().encode(JSON.stringify(duplicateWarnings, null, 2)) },
  ];

  const shaLines: string[] = [];
  for (const entry of assetEntries) {
    const hash = await sha256Hex(entry.data.buffer.slice(entry.data.byteOffset, entry.data.byteOffset + entry.data.byteLength) as ArrayBuffer);
    shaLines.push(`${hash}  ${entry.name}`);
  }
  const shaSumsEntry: ZipEntry = { name: 'SHA-256SUMS.txt', data: new TextEncoder().encode(shaLines.join('\n') + (shaLines.length ? '\n' : '')) };

  const allEntries = [...textEntries, shaSumsEntry, ...assetEntries];
  const blob = buildZip(allEntries);
  const filename = `${safeFilenameFragment(profile.id)}-${safeFilenameFragment(asset.displayName)}-${asset.assetId}-package.zip`;

  return { blob, filename, checklist, duplicateWarnings };
}
