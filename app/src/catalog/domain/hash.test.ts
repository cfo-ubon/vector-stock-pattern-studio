import { describe, it, expect } from 'vitest';
import { sha256Hex, sha256HexOfFile, normalizedJsonHash } from './hash';

describe('sha256Hex', () => {
  it('matches a known SHA-256 vector for an empty input', async () => {
    const hash = await sha256Hex(new ArrayBuffer(0));
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('is deterministic for the same bytes', async () => {
    const enc = new TextEncoder();
    const a = await sha256Hex(enc.encode('hello world').buffer as ArrayBuffer);
    const b = await sha256Hex(enc.encode('hello world').buffer as ArrayBuffer);
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('produces different hashes for different bytes', async () => {
    const enc = new TextEncoder();
    const a = await sha256Hex(enc.encode('hello').buffer as ArrayBuffer);
    const b = await sha256Hex(enc.encode('world').buffer as ArrayBuffer);
    expect(a).not.toBe(b);
  });
});

describe('sha256HexOfFile', () => {
  it('hashes a Blob/File the same as its raw bytes', async () => {
    const blob = new Blob(['same content']);
    const viaBlob = await sha256HexOfFile(blob);
    const viaBytes = await sha256Hex(new TextEncoder().encode('same content').buffer as ArrayBuffer);
    expect(viaBlob).toBe(viaBytes);
  });
});

describe('normalizedJsonHash', () => {
  it('is stable across key order', async () => {
    const a = await normalizedJsonHash({ b: 1, a: 2 });
    const b = await normalizedJsonHash({ a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it('differs for different content', async () => {
    const a = await normalizedJsonHash({ a: 1 });
    const b = await normalizedJsonHash({ a: 2 });
    expect(a).not.toBe(b);
  });

  it('handles nested arrays/objects', async () => {
    const a = await normalizedJsonHash({ list: [1, { x: 'y' }], n: null });
    const b = await normalizedJsonHash({ n: null, list: [1, { x: 'y' }] });
    expect(a).toBe(b);
  });
});
