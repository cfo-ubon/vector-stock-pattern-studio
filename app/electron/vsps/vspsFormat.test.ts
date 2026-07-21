import { describe, it, expect } from 'vitest';
import { buildVspsPackage } from './vspsWriter';
import { readVspsPackage, parseVspsPackage, VspsFormatError } from './vspsReader';
import { isSafeZipEntryName, sanitizeFilename, resolveWithinBase, hasAllowedExtension } from '../security/paths';

// Desktop migration Phase 4 — `.vsps` project package format. Pure Node
// logic (no Electron APIs), so runs under this repo's normal `vitest`
// suite exactly like every other module — a real, executed regression
// test, not a manual one-off script.

describe('.vsps package round-trip', () => {
  it('preserves project.json content and Thai project names exactly', async () => {
    const projectJson = JSON.stringify({
      schemaVersion: 1,
      project: { id: 'proj-1', name: 'ทดสอบ Thai Name', collections: [], savedItemIds: [], exportHistory: [] },
    });
    const buf = await buildVspsPackage({
      projectJson,
      projectId: 'proj-1',
      projectName: 'ทดสอบ Thai Name',
      appVersion: '1.0.0-desktop.1',
      createdAt: 1000,
      updatedAt: 2000,
      previews: [{ filename: 'pattern-a.png', pngBytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3]) }],
    });

    const parsed = parseVspsPackage(buf);
    expect(parsed.projectJson).toBe(projectJson);
    expect(parsed.manifest.project_name).toBe('ทดสอบ Thai Name');
    expect(parsed.manifest.schema_version).toBe(1);
    expect(parsed.manifest.project_id).toBe('proj-1');
    expect(parsed.previews).toHaveLength(1);
    expect(parsed.previews[0].filename).toBe('pattern-a.png');
    expect([...parsed.previews[0].pngBytes]).toEqual([137, 80, 78, 71, 1, 2, 3]);
  });

  it('round-trips a package with no previews', async () => {
    const projectJson = JSON.stringify({ schemaVersion: 1, project: { id: 'p2', name: 'Empty' } });
    const buf = await buildVspsPackage({
      projectJson,
      projectId: 'p2',
      projectName: 'Empty',
      appVersion: '1.0.0-desktop.1',
      createdAt: 1,
      updatedAt: 2,
    });
    const parsed = parseVspsPackage(buf);
    expect(parsed.previews).toEqual([]);
    expect(parsed.projectJson).toBe(projectJson);
  });

  it('rejects a corrupted/non-ZIP buffer', () => {
    expect(() => readVspsPackage(Buffer.from('not a zip file'))).toThrow(VspsFormatError);
  });

  it('rejects a valid ZIP missing project.json', async () => {
    const { buildZip } = await import('../../src/export/zip');
    const blob = buildZip([{ name: 'manifest.json', data: new TextEncoder().encode('{"schema_version":1}') }]);
    const buf = Buffer.from(await blob.arrayBuffer());
    expect(() => parseVspsPackage(buf)).toThrow(VspsFormatError);
  });
});

describe('security/paths', () => {
  it('sanitizeFilename strips Windows-reserved characters and names', () => {
    expect(sanitizeFilename('CON')).toBe('_CON');
    expect(sanitizeFilename('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j');
    expect(sanitizeFilename('')).toBe('untitled');
  });

  it('isSafeZipEntryName rejects traversal and absolute paths', () => {
    expect(isSafeZipEntryName('../../etc/passwd')).toBe(false);
    expect(isSafeZipEntryName('/etc/passwd')).toBe(false);
    expect(isSafeZipEntryName('previews/ok.png')).toBe(true);
    expect(isSafeZipEntryName('')).toBe(false);
  });

  it('resolveWithinBase rejects escape attempts, allows nested paths', () => {
    expect(resolveWithinBase('/base/dir', '../../etc/passwd')).toBeNull();
    expect(resolveWithinBase('/base/dir', 'sub/file.txt')).toBe('/base/dir/sub/file.txt');
  });

  it('hasAllowedExtension only accepts the known export types', () => {
    expect(hasAllowedExtension('pattern.svg')).toBe(true);
    expect(hasAllowedExtension('project.vsps')).toBe(true);
    expect(hasAllowedExtension('malware.exe')).toBe(false);
  });
});
