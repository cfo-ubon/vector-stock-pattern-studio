import { describe, it, expect } from 'vitest';
import { buildCompressedZip, readZipArchive, compressZipEntry, assembleZip, ZipArchiveError } from './zipArchive';
import type { ZipInputEntry } from './zipArchive';

const enc = new TextEncoder();
const dec = new TextDecoder();

function sampleEntries(): ZipInputEntry[] {
  return [
    { name: 'manifest.json', data: enc.encode(JSON.stringify({ hello: 'world' })) },
    { name: 'assets/big.svg', data: enc.encode('<svg>' + 'x'.repeat(20000) + '</svg>') },
    { name: 'empty.txt', data: new Uint8Array(0) },
    { name: 'settings/vsp-gallery-v1.json', data: enc.encode('[]') },
  ];
}

describe('buildCompressedZip / readZipArchive — round-trip', () => {
  it('every entry decompresses back to byte-identical content', async () => {
    const files = sampleEntries();
    const result = await buildCompressedZip(files);
    const back = await readZipArchive(result.blob);
    expect(back).toHaveLength(files.length);
    for (const f of files) {
      const entry = back.find((e) => e.name === f.name);
      expect(entry).toBeDefined();
      expect(dec.decode(entry!.data)).toBe(dec.decode(f.data));
    }
  });

  it('compresses large repetitive content meaningfully smaller than original', async () => {
    const files = sampleEntries();
    const result = await buildCompressedZip(files);
    expect(result.compressedSize).toBeLessThan(result.originalSize);
  });

  it('reports per-entry progress via onEntryDone in order', async () => {
    const files = sampleEntries();
    const seen: number[] = [];
    await buildCompressedZip(files, { onEntryDone: (index) => seen.push(index) });
    expect(seen).toEqual([1, 2, 3, 4]);
  });
});

describe('compressZipEntry + assembleZip — split path matches buildCompressedZip', () => {
  it('produces a byte-for-byte readable archive identical in content to the wrapper', async () => {
    const files = sampleEntries();
    const assembled = [];
    for (const f of files) assembled.push(await compressZipEntry(f));
    const split = assembleZip(assembled);
    const wrapper = await buildCompressedZip(files);

    expect(split.originalSize).toBe(wrapper.originalSize);
    expect(split.compressedSize).toBe(wrapper.compressedSize);

    const back = await readZipArchive(split.blob);
    for (const f of files) {
      const entry = back.find((e) => e.name === f.name);
      expect(dec.decode(entry!.data)).toBe(dec.decode(f.data));
    }
  });

  it('exposes exact per-entry compressed size before assembly (the whole point of the split)', async () => {
    const files = sampleEntries();
    const assembled = await Promise.all(files.map(compressZipEntry));
    // The big.svg entry should have compressed well below its original size.
    const big = assembled.find((a) => a.name === 'assets/big.svg')!;
    expect(big.compressedData.length).toBeLessThan(big.originalData.length);
  });
});

describe('readZipArchive — corruption detection', () => {
  it('rejects a truncated archive', async () => {
    const result = await buildCompressedZip(sampleEntries());
    const buf = new Uint8Array(await result.blob.arrayBuffer());
    const truncated = new Blob([buf.slice(0, buf.length - 40)]);
    await expect(readZipArchive(truncated)).rejects.toThrow(ZipArchiveError);
  });

  it('rejects garbage bytes that are not a ZIP at all', async () => {
    await expect(readZipArchive(new Blob([new Uint8Array([1, 2, 3, 4, 5])]))).rejects.toThrow(ZipArchiveError);
  });

  it('rejects an empty blob', async () => {
    await expect(readZipArchive(new Blob([]))).rejects.toThrow(ZipArchiveError);
  });

  it('detects a decompression failure from a bit-flipped entry somewhere in the archive', async () => {
    const result = await buildCompressedZip(sampleEntries());
    const buf = new Uint8Array(await result.blob.arrayBuffer());
    let caughtSomewhere = false;
    // Flip bytes across several offsets — DEFLATE corruption doesn't always
    // land on a byte that changes the decompressed length/content, but at
    // least one of these should trigger a detectable failure.
    for (let frac = 0.1; frac < 0.95; frac += 0.1) {
      const tampered = buf.slice();
      const offset = Math.floor(buf.length * frac);
      tampered[offset] ^= 0xff;
      try {
        await readZipArchive(new Blob([tampered]));
      } catch (err) {
        expect(err).toBeInstanceOf(ZipArchiveError);
        caughtSomewhere = true;
      }
    }
    expect(caughtSomewhere).toBe(true);
  });
});

describe('buildCompressedZip — STORE fallback', () => {
  it('never inflates content that does not compress (falls back to STORE, not a larger DEFLATE stream)', async () => {
    // A single already-random-looking byte is too small for DEFLATE to
    // ever shrink; the archive must not be larger than STORE would produce.
    const files: ZipInputEntry[] = [{ name: 'tiny.bin', data: new Uint8Array([7]) }];
    const result = await buildCompressedZip(files);
    const entry = result.entries[0];
    expect(entry.compressedSize).toBeLessThanOrEqual(entry.originalSize);
  });
});
