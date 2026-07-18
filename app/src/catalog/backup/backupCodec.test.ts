import { describe, it, expect } from 'vitest';
import { compressToBase64, decompressFromBase64, computePayloadChecksum, BackupCodecError } from './backupCodec';

describe('backupCodec', () => {
  it('round-trips a small JSON payload through compress/decompress', async () => {
    const payload = { collections: [{ id: 'c1', name: 'Spring' }], memberships: [] };
    const text = JSON.stringify(payload);
    const compressed = await compressToBase64(text);
    expect(compressed).not.toBe(text);
    const decompressed = await decompressFromBase64(compressed);
    expect(decompressed).toBe(text);
  });

  it('round-trips a large payload (10,000 synthetic records)', async () => {
    const big = { collections: Array.from({ length: 10000 }, (_, i) => ({ id: `c${i}`, name: `Collection ${i}`, description: 'x'.repeat(50) })) };
    const text = JSON.stringify(big);
    const compressed = await compressToBase64(text);
    // Real JSON with repeated structure compresses well — confirms gzip is actually doing work, not just base64-wrapping.
    expect(compressed.length).toBeLessThan(text.length);
    const decompressed = await decompressFromBase64(compressed);
    expect(decompressed).toBe(text);
  });

  it('produces a deterministic checksum for the same payload', async () => {
    const payload = { a: 1, b: [1, 2, 3] };
    const c1 = await computePayloadChecksum(payload);
    const c2 = await computePayloadChecksum(payload);
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a different checksum when the payload changes', async () => {
    const c1 = await computePayloadChecksum({ a: 1 });
    const c2 = await computePayloadChecksum({ a: 2 });
    expect(c1).not.toBe(c2);
  });

  it('throws BackupCodecError on invalid base64', async () => {
    await expect(decompressFromBase64('not-valid-base64!!!')).rejects.toBeInstanceOf(BackupCodecError);
  });

  it('throws BackupCodecError on valid base64 that is not gzip data (truncated/corrupted archive)', async () => {
    const garbage = btoa('this is not gzip data at all');
    await expect(decompressFromBase64(garbage)).rejects.toBeInstanceOf(BackupCodecError);
  });

  it('throws BackupCodecError on truncated gzip data', async () => {
    const compressed = await compressToBase64(JSON.stringify({ a: 1, b: 2, c: 3, d: 'some longer text to ensure multiple gzip blocks' }));
    const truncated = compressed.slice(0, Math.floor(compressed.length / 2));
    await expect(decompressFromBase64(truncated)).rejects.toBeInstanceOf(BackupCodecError);
  });
});
