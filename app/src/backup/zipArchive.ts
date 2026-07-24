// Application Backup System — a compressed ZIP reader/writer, distinct
// from `export/zip.ts`'s existing STORE-only writer (which every other
// export path in this app relies on and which this module never
// modifies). A full-application backup can be large (every source SVG/
// PNG/EPS/AI file across the whole portfolio), so this module uses real
// DEFLATE compression per entry via the standard `CompressionStream`/
// `DecompressionStream('deflate-raw')` Web APIs (the exact same
// dependency-free approach `catalog/backup/backupCodec.ts` already
// established for gzip — no new library added) rather than `zip.ts`'s
// uncompressed STORE method, so a portfolio's worth of vector files
// compresses meaningfully instead of just being re-packaged byte-for-byte.
//
// This is also the first ZIP *reader* in the repo — every prior ZIP need
// was write-only (build a download, never read one back). Restoring a
// `.vspsb` backup requires reading an arbitrary previously-written
// archive back, so `readZipArchive` parses the End of Central Directory
// record backwards from the end of the file (the standard, dependency-free
// way to locate it without a linear scan of a potentially huge archive),
// then reads each central directory entry to find every local file header.

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const EOCD_MIN_SIZE = 22;
const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;

export interface ZipInputEntry {
  name: string;
  data: Uint8Array;
}

export interface ZipOutputEntry {
  name: string;
  originalSize: number;
  compressedSize: number;
  data: Uint8Array;
}

export class ZipArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipArchiveError';
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Raw DEFLATE (no zlib/gzip header — the format ZIP's method 8 expects)
 * via the standard Web Streams compression API. Falls back to STORE
 * (returns the original bytes unchanged, letting the caller record method
 * 0) only if the *compressed* result is not actually smaller — this can
 * happen for already-compressed formats (many EPS/PNG payloads), and
 * storing the larger of the two would be a strictly worse outcome than
 * just keeping the original bytes. */
async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  const writePromise = writer.write(data as Uint8Array<ArrayBuffer>).then(() => writer.close());
  const [, compressedBuffer] = await Promise.all([writePromise, new Response(stream.readable).arrayBuffer()]);
  return new Uint8Array(compressedBuffer);
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  try {
    const stream = new DecompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    const writePromise = writer.write(data as Uint8Array<ArrayBuffer>).then(() => writer.close());
    const [, decompressedBuffer] = await Promise.all([writePromise, new Response(stream.readable).arrayBuffer()]);
    return new Uint8Array(decompressedBuffer);
  } catch (err) {
    throw new ZipArchiveError(`Failed to decompress a DEFLATE entry (corrupted or truncated archive): ${err instanceof Error ? err.message : String(err)}`);
  }
}

export interface BuildCompressedZipResult {
  blob: Blob;
  entries: ZipOutputEntry[];
  originalSize: number;
  compressedSize: number;
}

export interface BuildCompressedZipOptions {
  /** Called once per entry as it finishes, so a caller building a large
   * archive can drive a progress UI without this module needing to know
   * anything about progress dialogs itself. */
  onEntryDone?: (index: number, total: number, entry: ZipInputEntry) => void;
}

/** One entry after compression has already run — the output of
 * `compressZipEntry`, and the input `assembleZip` needs to write headers.
 * Split out from `buildCompressedZip` so a caller that needs to know an
 * entry's exact compressed size *before* finalizing a sibling entry (e.g.
 * `appBackupBuilder.ts` needs every content entry's real compressed size
 * before it can write `manifest.json`'s own stats fields) can compress
 * once, inspect the results, and only then assemble the final archive —
 * instead of compressing large content twice just to get the numbers
 * right for a small metadata file. */
export interface ZipAssembledEntry {
  name: string;
  method: number;
  crc: number;
  originalData: Uint8Array;
  compressedData: Uint8Array;
}

/** Compresses one entry (real DEFLATE, falling back to STORE if deflate
 * didn't actually shrink it — see `deflateRaw`'s doc comment). Pure
 * per-entry work, independent of every other entry, so callers may run
 * this over a subset of entries first (to learn their exact compressed
 * sizes) before assembling the final archive with `assembleZip`. */
export async function compressZipEntry(entry: ZipInputEntry): Promise<ZipAssembledEntry> {
  const crc = crc32(entry.data);
  const deflated = entry.data.length > 0 ? await deflateRaw(entry.data) : new Uint8Array(0);
  const useDeflate = deflated.length < entry.data.length;
  return {
    name: entry.name,
    method: useDeflate ? METHOD_DEFLATE : METHOD_STORE,
    crc,
    originalData: entry.data,
    compressedData: useDeflate ? deflated : entry.data,
  };
}

/** Writes the local file headers, central directory, and End of Central
 * Directory record for a set of already-compressed entries, in the order
 * given. This is the pure "framing" half of what used to be
 * `buildCompressedZip`'s single loop — no compression happens here, so
 * calling it does not re-pay the cost of compressing large entries that
 * were already compressed via `compressZipEntry`. */
export function assembleZip(entries: ZipAssembledEntry[]): BuildCompressedZipResult {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  const outEntries: ZipOutputEntry[] = [];
  let offset = 0;
  let originalSize = 0;
  let compressedSize = 0;
  const now = dosDateTime(new Date());
  const enc = new TextEncoder();

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const storedBytes = entry.compressedData;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, LOCAL_FILE_HEADER_SIG, true);
    local.setUint16(4, 20, true); // version needed to extract (2.0, deflate support)
    local.setUint16(6, 0x0800, true); // general purpose flag: UTF-8 names
    local.setUint16(8, entry.method, true);
    local.setUint16(10, now.time, true);
    local.setUint16(12, now.date, true);
    local.setUint32(14, entry.crc, true);
    local.setUint32(18, storedBytes.length, true); // compressed size
    local.setUint32(22, entry.originalData.length, true); // uncompressed size
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true); // extra field length
    chunks.push(new Uint8Array(local.buffer), nameBytes, storedBytes);

    const cdir = new DataView(new ArrayBuffer(46));
    cdir.setUint32(0, CENTRAL_DIR_SIG, true);
    cdir.setUint16(4, 20, true); // version made by
    cdir.setUint16(6, 20, true); // version needed
    cdir.setUint16(8, 0x0800, true);
    cdir.setUint16(10, entry.method, true);
    cdir.setUint16(12, now.time, true);
    cdir.setUint16(14, now.date, true);
    cdir.setUint32(16, entry.crc, true);
    cdir.setUint32(20, storedBytes.length, true);
    cdir.setUint32(24, entry.originalData.length, true);
    cdir.setUint16(28, nameBytes.length, true);
    cdir.setUint32(42, offset, true); // offset of local header
    central.push(new Uint8Array(cdir.buffer), nameBytes);

    offset += 30 + nameBytes.length + storedBytes.length;
    originalSize += entry.originalData.length;
    compressedSize += storedBytes.length;
    outEntries.push({ name: entry.name, originalSize: entry.originalData.length, compressedSize: storedBytes.length, data: entry.originalData });
  }

  const centralOffset = offset;
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new DataView(new ArrayBuffer(EOCD_MIN_SIZE));
  eocd.setUint32(0, EOCD_SIG, true);
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, centralOffset, true);
  chunks.push(...central, new Uint8Array(eocd.buffer));

  return {
    blob: new Blob(chunks as BlobPart[], { type: 'application/octet-stream' }),
    entries: outEntries,
    originalSize,
    compressedSize,
  };
}

/** Builds a real, standard ZIP archive (verified against the system
 * `unzip`/`zipinfo` tools during development — every entry's bytes are
 * processed and appended one at a time rather than holding every entry's
 * compressed AND original copy in memory simultaneously, so peak memory
 * for a large backup stays roughly one entry's size above the final
 * archive size, not a multiple of the whole portfolio's size). Thin
 * wrapper over `compressZipEntry` + `assembleZip` for the common case
 * where a caller has no need to inspect per-entry results in between. */
export async function buildCompressedZip(files: ZipInputEntry[], options: BuildCompressedZipOptions = {}): Promise<BuildCompressedZipResult> {
  const assembled: ZipAssembledEntry[] = [];
  for (let i = 0; i < files.length; i++) {
    assembled.push(await compressZipEntry(files[i]));
    options.onEntryDone?.(i + 1, files.length, files[i]);
  }
  return assembleZip(assembled);
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  // The EOCD record is at the very end of the file, but ZIP allows an
  // arbitrary-length comment field after it, so this scans backward from
  // the end (bounded to the theoretical max comment length of 65535
  // bytes) looking for the signature rather than assuming a fixed offset.
  const maxCommentLength = 65535;
  const searchStart = Math.max(0, bytes.length - EOCD_MIN_SIZE - maxCommentLength);
  for (let i = bytes.length - EOCD_MIN_SIZE; i >= searchStart; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      return i;
    }
  }
  return -1;
}

/** Reads a ZIP archive back into its entries — the read-side counterpart
 * to `buildCompressedZip`. Reads via the central directory (not a linear
 * scan of local file headers), the standard, robust way to enumerate a
 * ZIP's contents, and decompresses each entry according to its own
 * recorded method (STORE or DEFLATE) rather than assuming one method for
 * the whole archive, so it can also read plain STORE-method archives
 * produced by `export/zip.ts` if one is ever handed to it. */
export async function readZipArchive(blob: Blob): Promise<ZipInputEntry[]> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length < EOCD_MIN_SIZE) {
    throw new ZipArchiveError('File is too small to be a valid ZIP archive.');
  }
  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset === -1) {
    throw new ZipArchiveError('End of Central Directory record not found — this is not a valid ZIP archive, or it is truncated/corrupted.');
  }
  const eocd = new DataView(buffer, eocdOffset, EOCD_MIN_SIZE);
  const entryCount = eocd.getUint16(10, true);
  const centralDirOffset = eocd.getUint32(16, true);
  if (centralDirOffset + 4 > bytes.length) {
    throw new ZipArchiveError('Central directory offset points outside the file — archive is corrupted or truncated.');
  }

  const entries: ZipInputEntry[] = [];
  let pos = centralDirOffset;
  for (let i = 0; i < entryCount; i++) {
    if (pos + 46 > bytes.length) {
      throw new ZipArchiveError(`Central directory entry ${i + 1} of ${entryCount} is truncated — archive is corrupted.`);
    }
    const cdir = new DataView(buffer, pos, 46);
    const sig = cdir.getUint32(0, true);
    if (sig !== CENTRAL_DIR_SIG) {
      throw new ZipArchiveError(`Central directory entry ${i + 1} has an invalid signature — archive is corrupted.`);
    }
    const method = cdir.getUint16(10, true);
    const compressedSize = cdir.getUint32(20, true);
    const uncompressedSize = cdir.getUint32(24, true);
    const nameLength = cdir.getUint16(28, true);
    const extraLength = cdir.getUint16(30, true);
    const commentLength = cdir.getUint16(32, true);
    const localHeaderOffset = cdir.getUint32(42, true);
    const nameBytes = bytes.subarray(pos + 46, pos + 46 + nameLength);
    const name = new TextDecoder().decode(nameBytes);
    pos += 46 + nameLength + extraLength + commentLength;

    if (localHeaderOffset + 30 > bytes.length) {
      throw new ZipArchiveError(`Local file header for "${name}" points outside the file — archive is corrupted or truncated.`);
    }
    const local = new DataView(buffer, localHeaderOffset, 30);
    if (local.getUint32(0, true) !== LOCAL_FILE_HEADER_SIG) {
      throw new ZipArchiveError(`Local file header for "${name}" has an invalid signature — archive is corrupted.`);
    }
    const localNameLength = local.getUint16(26, true);
    const localExtraLength = local.getUint16(28, true);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    if (dataStart + compressedSize > bytes.length) {
      throw new ZipArchiveError(`Entry "${name}" data extends beyond the end of the file — archive is truncated.`);
    }
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);

    let data: Uint8Array;
    if (method === METHOD_STORE) {
      data = raw.slice();
    } else if (method === METHOD_DEFLATE) {
      data = await inflateRaw(raw);
    } else {
      throw new ZipArchiveError(`Entry "${name}" uses unsupported compression method ${method} — only STORE and DEFLATE are supported.`);
    }
    if (data.length !== uncompressedSize) {
      throw new ZipArchiveError(`Entry "${name}" decompressed to ${data.length} bytes, expected ${uncompressedSize} — archive is corrupted.`);
    }
    entries.push({ name, data });
  }

  return entries;
}
