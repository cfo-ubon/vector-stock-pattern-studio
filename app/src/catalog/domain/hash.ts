// SHA-256 content hashing for imported source files. No hashing utility
// existed anywhere in the repo before this (checked: zero `sha256`/
// `crypto.subtle` hits outside this module) — this is the one place it's
// implemented, via the browser-native SubtleCrypto API (no dependency
// added). Hashing never touches/normalizes/re-encodes the file bytes
// first — the hash is of the exact ArrayBuffer read from disk, so it
// matches what a user's own `sha256sum` of the original file would
// produce.

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

export async function sha256HexOfFile(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  return sha256Hex(buffer);
}

/** A cheap, order-independent hash of a *parsed* JSON value's normalized
 * string form — used to catch "same design, re-exported/re-serialized
 * JSON" duplicates that a raw byte hash would miss (whitespace/key-order
 * differences). Not a cryptographic hash; only used as a secondary
 * duplicate-detection signal, never for identity. */
export async function normalizedJsonHash(value: unknown): Promise<string> {
  const normalized = normalizeForHash(value);
  const encoder = new TextEncoder();
  return sha256Hex(encoder.encode(normalized).buffer as ArrayBuffer);
}

function normalizeForHash(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(normalizeForHash).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${normalizeForHash((value as Record<string, unknown>)[k])}`).join(',')}}`;
}
