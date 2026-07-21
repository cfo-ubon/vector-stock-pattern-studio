import { isSafeZipEntryName } from '../security/paths';
import type { VspsManifest } from '../ipcContract';

// Reads back a `.vsps` package (a plain STORE-method ZIP — see
// `vspsWriter.ts` and the app's own `export/zip.ts`). No existing ZIP
// *reader* exists anywhere in this repo (only a writer) — this is
// genuinely new code, not a reuse, documented as such in
// DESKTOP_MIGRATION_AUDIT.md Section 8. Deliberately minimal: supports
// exactly the STORE-only, non-ZIP64 subset this app's own writer
// produces, not a general-purpose ZIP reader. Every entry name is
// validated with `isSafeZipEntryName` before being surfaced — a
// malformed or tampered `.vsps` file can never cause a path-traversal
// write when its contents are later extracted to disk.

export interface VspsEntry {
  name: string;
  data: Buffer;
}

export class VspsFormatError extends Error {}

function readUInt32LE(buf: Buffer, offset: number): number {
  return buf.readUInt32LE(offset);
}

function readUInt16LE(buf: Buffer, offset: number): number {
  return buf.readUInt16LE(offset);
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

function findEndOfCentralDirectory(buf: Buffer): number {
  // EOCD is at least 22 bytes and sits at the very end unless a comment
  // follows it (this app's own writer never writes one) — scan backward
  // from the end, bounded to a generous 4KB search window.
  const searchStart = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= searchStart; i--) {
    if (readUInt32LE(buf, i) === EOCD_SIGNATURE) return i;
  }
  throw new VspsFormatError('Not a valid .vsps package: end-of-central-directory record not found.');
}

/** Parses the raw bytes of a `.vsps` file into its member entries. Throws
 * `VspsFormatError` for anything structurally invalid (not a ZIP,
 * truncated, unsupported compression method) or unsafe (a path-traversal
 * entry name) — callers must not attempt a partial/best-effort read on
 * failure. */
export function readVspsPackage(buf: Buffer): VspsEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buf);
  const entryCount = readUInt16LE(buf, eocdOffset + 10);
  const centralDirOffset = readUInt32LE(buf, eocdOffset + 16);

  const entries: VspsEntry[] = [];
  let ptr = centralDirOffset;

  for (let i = 0; i < entryCount; i++) {
    if (ptr + 46 > buf.length || readUInt32LE(buf, ptr) !== CENTRAL_DIR_SIGNATURE) {
      throw new VspsFormatError('Not a valid .vsps package: corrupted central directory.');
    }
    const compressionMethod = readUInt16LE(buf, ptr + 10);
    const compressedSize = readUInt32LE(buf, ptr + 20);
    const nameLength = readUInt16LE(buf, ptr + 28);
    const extraLength = readUInt16LE(buf, ptr + 30);
    const commentLength = readUInt16LE(buf, ptr + 32);
    const localHeaderOffset = readUInt32LE(buf, ptr + 42);
    const name = buf.toString('utf-8', ptr + 46, ptr + 46 + nameLength);

    if (compressionMethod !== 0) {
      throw new VspsFormatError(`Unsupported compression method for entry "${name}" — only STORE (0) is supported.`);
    }
    if (!isSafeZipEntryName(name)) {
      throw new VspsFormatError(`Refusing to read unsafe entry name "${name}" (path traversal or absolute path).`);
    }

    // Local file header: signature(4) version(2) flags(2) method(2) time(2)
    // date(2) crc(4) compSize(4) uncompSize(4) nameLen(2) extraLen(2) = 30 bytes
    if (readUInt32LE(buf, localHeaderOffset) !== LOCAL_FILE_SIGNATURE) {
      throw new VspsFormatError(`Corrupted local file header for entry "${name}".`);
    }
    const localNameLength = readUInt16LE(buf, localHeaderOffset + 26);
    const localExtraLength = readUInt16LE(buf, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const data = buf.subarray(dataStart, dataStart + compressedSize);

    entries.push({ name, data: Buffer.from(data) });
    ptr += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

export interface ParsedVsps {
  manifest: VspsManifest;
  projectJson: string;
  previews: Array<{ filename: string; pngBytes: Buffer }>;
}

/** High-level parse: extracts and structurally validates `manifest.json`
 * and `project.json` from a `.vsps` package. Does NOT validate
 * `project.json`'s own Project shape — that's the existing, unmodified
 * `importProjectJson()` in the renderer's own `project/projectJson.ts`,
 * called after this returns the raw string, per
 * DESKTOP_MIGRATION_AUDIT.md's "reuse, don't reinvent" principle. */
export function parseVspsPackage(buf: Buffer): ParsedVsps {
  const entries = readVspsPackage(buf);
  const manifestEntry = entries.find((e) => e.name === 'manifest.json');
  const projectEntry = entries.find((e) => e.name === 'project.json');
  if (!manifestEntry) throw new VspsFormatError('.vsps package is missing manifest.json.');
  if (!projectEntry) throw new VspsFormatError('.vsps package is missing project.json.');

  let manifest: VspsManifest;
  try {
    manifest = JSON.parse(manifestEntry.data.toString('utf-8'));
  } catch {
    throw new VspsFormatError('manifest.json is not valid JSON.');
  }
  if (typeof manifest.schema_version !== 'number') {
    throw new VspsFormatError('manifest.json is missing a valid schema_version.');
  }

  const previews = entries
    .filter((e) => e.name.startsWith('previews/'))
    .map((e) => ({ filename: e.name.slice('previews/'.length), pngBytes: e.data }));

  return { manifest, projectJson: projectEntry.data.toString('utf-8'), previews };
}
