import type { PortfolioAsset, PortfolioFileRecord, SourceFileReference } from '../domain/types';
import { createPortfolioAsset } from '../domain/asset';
import { generateFileId } from '../domain/id';
import { sha256Hex, normalizedJsonHash } from '../domain/hash';
import { classifyFile, isUnsupportedFileType } from './fileValidation';
import { groupFilesByBasename, type FileGroup } from './basenameGrouping';
import { selectPreviewReference } from './previewSelection';
import { parseJsonText } from './jsonCompat';
import { detectDuplicate, type DuplicateOutcome } from './duplicates';
import { importAssetTransaction } from '../storage/portfolioStore';

// Sprint P1, Section 5 (Import Workflow) — the orchestrator. One call =
// one candidate asset (one basename group); the caller (UI layer) is
// responsible for looping over `groupFilesByBasename(...)` and deciding
// how to react to each `ImportOutcome` (prompt on `possibleDuplicate`,
// surface `blockedDuplicate`/`error`, move on after `imported`).
// `importAssetTransaction` is the *only* write path — a failure partway
// through (steps 1-7 below) never touches storage at all, and step 8's
// write is atomic, so there is no interrupted-import state that leaves a
// partial asset behind (Section 11: "import rollback on failure").

export interface ImportedOutcome {
  status: 'imported';
  basename: string;
  asset: PortfolioAsset;
  warnings: string[];
}

export interface BlockedDuplicateOutcome {
  status: 'blockedDuplicate';
  basename: string;
  existingAsset: PortfolioAsset;
  /** The original file group, kept so the UI can offer an explicit
   * "import as new" retry (`importFileGroup(group, ..., { forceImportAsNew: true })`)
   * without asking the user to re-select the files. */
  group: FileGroup<File>;
}

export interface PossibleDuplicateOutcome {
  status: 'possibleDuplicate';
  basename: string;
  existingAsset: PortfolioAsset;
  matchedOn: string[];
  group: FileGroup<File>;
}

export interface ImportErrorOutcome {
  status: 'error';
  basename: string;
  message: string;
}

export type ImportOutcome = ImportedOutcome | BlockedDuplicateOutcome | PossibleDuplicateOutcome | ImportErrorOutcome;

export interface ImportGroupOptions {
  /** Explicit "import as new" decision — bypasses the `possibleDuplicate`
   * warn-and-stop behavior (never bypasses `blockedDuplicate`, which
   * requires the same explicit override for a *different*, stronger
   * reason — see `importFileGroup`'s exact-duplicate branch). */
  forceImportAsNew?: boolean;
  displayName?: string;
  parentAssetId?: string | null;
  variationGroupId?: string | null;
  /** The generator that produced this file group, when it came from an
   * in-app generation pipeline (Factory/Autopilot) rather than a manual
   * drag-and-drop import — passed straight through to `createPortfolioAsset`
   * so the Commercial Readiness engine's "Generator completed" check has a
   * real value to read. Omitted (or left undefined) for manual imports,
   * which correctly have no generator to record. */
  generatorVersion?: string | null;
}

async function readFileSafely(file: File): Promise<ArrayBuffer | null> {
  try {
    return await file.arrayBuffer();
  } catch {
    return null;
  }
}

export async function importFileGroup(
  group: FileGroup<File>,
  existingAssets: PortfolioAsset[],
  options: ImportGroupOptions = {},
): Promise<ImportOutcome> {
  const warnings: string[] = [];
  const refs: SourceFileReference[] = [];
  const bodies = new Map<string, File>();
  let jsonHash: string | undefined;
  let extractedSeed: string | undefined;
  let extractedMetadata: ReturnType<typeof parseJsonText>['metadata'] | null = null;

  for (const file of group.files) {
    if (file.size === 0) {
      return { status: 'error', basename: group.basename, message: `"${file.name}" is empty (0 bytes) — not imported.` };
    }
    if (isUnsupportedFileType(file.name)) {
      return { status: 'error', basename: group.basename, message: `"${file.name}" has an unsupported file type for the Portfolio catalog.` };
    }

    const buffer = await readFileSafely(file);
    if (!buffer) {
      return { status: 'error', basename: group.basename, message: `Could not read "${file.name}" — the import was interrupted.` };
    }

    const { role, mimeType } = classifyFile(file.name);
    const sha256 = await sha256Hex(buffer);
    const fileId = generateFileId();
    refs.push({ fileId, role, filename: file.name, mimeType, fileSize: file.size, sha256 });
    bodies.set(fileId, file);

    if (role === 'json') {
      const text = new TextDecoder().decode(buffer);
      const parsed = parseJsonText(text);
      if (!parsed.ok) {
        warnings.push(`"${file.name}" is not valid JSON (${parsed.error}) — the file was still imported, but no metadata could be extracted from it.`);
      } else {
        extractedMetadata = parsed.metadata;
        extractedSeed = parsed.metadata.seed ?? undefined;
        jsonHash = await normalizedJsonHash(parsed.value);
      }
    }
  }

  const totalFileSize = refs.reduce((sum, r) => sum + r.fileSize, 0);
  const fileHashes = refs.map((r) => r.sha256);

  const duplicate: DuplicateOutcome = detectDuplicate(
    { fileHashes, jsonHash, originalFilename: group.files[0]?.name ?? group.basename, totalFileSize, generatorSeed: extractedSeed },
    existingAssets,
  );

  if (duplicate.kind === 'exact' && !options.forceImportAsNew) {
    return { status: 'blockedDuplicate', basename: group.basename, existingAsset: duplicate.existingAsset, group };
  }
  if (duplicate.kind === 'possible' && !options.forceImportAsNew) {
    return { status: 'possibleDuplicate', basename: group.basename, existingAsset: duplicate.existingAsset, matchedOn: duplicate.matchedOn, group };
  }

  const previewReference = selectPreviewReference(refs);
  const metadataRef = refs.find((r) => r.role === 'json');

  const asset = createPortfolioAsset({
    displayName: options.displayName ?? group.basename,
    originalFilename: group.files[0]?.name ?? group.basename,
    sourceFileReferences: refs,
    previewReference,
    metadataReference: metadataRef?.fileId ?? null,
    createdAt: extractedMetadata?.createdAt ?? undefined,
    styleDna: extractedMetadata?.styleDna ?? null,
    patternType: extractedMetadata?.patternType ?? null,
    compositionType: extractedMetadata?.compositionType ?? null,
    generatorSeed: extractedMetadata?.seed ?? null,
    productTargets: extractedMetadata?.productTargets ?? [],
    colorPalette: extractedMetadata?.colorPalette ?? [],
    parentAssetId: options.parentAssetId ?? (duplicate.kind === 'possible' ? duplicate.existingAsset.assetId : null),
    variationGroupId: options.variationGroupId ?? null,
    generatorVersion: options.generatorVersion ?? null,
  });

  const now = Date.now();
  const fileRecords: PortfolioFileRecord[] = refs.map((r) => ({
    fileId: r.fileId,
    assetId: asset.assetId,
    role: r.role,
    filename: r.filename,
    mimeType: r.mimeType,
    fileSize: r.fileSize,
    sha256: r.sha256,
    blob: bodies.get(r.fileId)!,
    storedAt: now,
  }));

  try {
    await importAssetTransaction(asset, fileRecords);
  } catch (e) {
    return { status: 'error', basename: group.basename, message: e instanceof Error ? e.message : 'Import transaction failed.' };
  }

  return { status: 'imported', basename: group.basename, asset, warnings };
}

export interface ImportBatchResult {
  outcomes: ImportOutcome[];
  importedCount: number;
  errorCount: number;
  duplicateBlockedCount: number;
  possibleDuplicateCount: number;
}

/** Imports every basename group in a file list, running groups
 * sequentially (never in parallel — each group's duplicate check reads
 * `existingAssets`, which must include every asset imported earlier *in
 * this same batch*, or two files sharing a basename+content within one
 * drop wouldn't catch each other). One group's error never stops the
 * rest of the batch (Section 6: "allow importing the remaining valid
 * files when appropriate"). */
export async function importFiles(
  files: File[],
  existingAssets: PortfolioAsset[],
  optionsPerGroup?: (group: FileGroup<File>) => ImportGroupOptions,
): Promise<ImportBatchResult> {
  const groups = groupFilesByBasename(files);
  const outcomes: ImportOutcome[] = [];
  const knownAssets = [...existingAssets];

  for (const group of groups) {
    const outcome = await importFileGroup(group, knownAssets, optionsPerGroup?.(group) ?? {});
    outcomes.push(outcome);
    if (outcome.status === 'imported') knownAssets.push(outcome.asset);
  }

  return {
    outcomes,
    importedCount: outcomes.filter((o) => o.status === 'imported').length,
    errorCount: outcomes.filter((o) => o.status === 'error').length,
    duplicateBlockedCount: outcomes.filter((o) => o.status === 'blockedDuplicate').length,
    possibleDuplicateCount: outcomes.filter((o) => o.status === 'possibleDuplicate').length,
  };
}
