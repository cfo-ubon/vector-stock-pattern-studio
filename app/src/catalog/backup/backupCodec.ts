import { sha256Hex } from '../domain/hash';

// Portfolio Manager P3 — gzip+base64 codec for the backup payload, and
// the checksum function used on both the write and verify sides.
// `CompressionStream`/`DecompressionStream('gzip')` and `Response` (used
// to drain a stream to an ArrayBuffer) are standard Web APIs, available
// natively in Node 18+ and every evergreen browser — confirmed present
// in this repo's Node 22 test environment, so no new dependency was
// added for this (matching the rest of the app's "dependency-free"
// convention — see `export/zip.ts`, `domain/hash.ts`).

const BASE64_CHUNK_SIZE = 0x8000;

/** `String.fromCharCode(...bytes)` in one call risks a "too many
 * arguments" stack error for large arrays — chunking avoids that while
 * staying allocation-cheap for the common (small-to-medium backup)
 * case. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export class BackupCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupCodecError';
  }
}

/** Compresses a UTF-8 string with gzip and returns it as base64 — the
 * exact `payload` field of a `BackupArchive`. */
export async function compressToBase64(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  // Never awaited separately from `close()` — a partial write followed
  // by a rejected `close()` (e.g. the underlying stream erroring) must
  // surface as one failure, not an unhandled rejection from a dangling
  // `write()` promise.
  const writePromise = writer.write(bytes).then(() => writer.close());
  const [, compressedBuffer] = await Promise.all([writePromise, new Response(stream.readable).arrayBuffer()]);
  return bytesToBase64(new Uint8Array(compressedBuffer));
}

/** Inverse of `compressToBase64`. Throws `BackupCodecError` (never a raw
 * `DOMException`/decoder error) on malformed base64 or invalid gzip
 * data — this is the exact failure mode `backupValidation.ts` simulates
 * for "corrupted archive" and "truncated archive" scenarios, so it must
 * be a typed, catchable error, not a crash. */
export async function decompressFromBase64(base64: string): Promise<string> {
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(base64);
  } catch (err) {
    throw new BackupCodecError(`Backup payload is not valid base64: ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const writePromise = writer.write(bytes as Uint8Array<ArrayBuffer>).then(() => writer.close());
    const [, decompressedBuffer] = await Promise.all([writePromise, new Response(stream.readable).arrayBuffer()]);
    return new TextDecoder().decode(decompressedBuffer);
  } catch (err) {
    throw new BackupCodecError(`Backup payload failed to decompress (corrupted or truncated archive): ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Canonical checksum for a payload object — the exact function both
 * `backupBuilder.ts` (write side) and `backupValidation.ts` (verify
 * side) call, so there is only ever one definition of "the payload's
 * checksum" to keep in sync. `JSON.stringify` with no extra arguments
 * (no indentation) is the canonical form — both sides always serialize
 * this way, so the checksum is deterministic across a full
 * compress/decompress round trip. */
export async function computePayloadChecksum(payload: unknown): Promise<string> {
  const canonical = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(canonical);
  return sha256Hex(bytes.buffer as ArrayBuffer);
}
