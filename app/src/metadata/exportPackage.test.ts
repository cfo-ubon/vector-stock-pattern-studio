import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { buildTile } from '../engine/tile';
import { MARKETPLACE_LIST } from './marketplaceProfiles';
import { generateMarketplaceSeo } from './marketplaceSeo';
import { buildMarketplacePackageTextFiles, buildPackageTextFilesFromSeo } from './exportPackage';

function makeTileData(seed: string) {
  return buildTile({ ...defaultParams(), categoryId: 'botanical', seed });
}

describe('exportPackage: package generation', () => {
  it('every marketplace produces title.txt, keywords.txt, filename.txt, metadata.json at minimum', () => {
    const tileData = makeTileData('pkg-basic');
    for (const profile of MARKETPLACE_LIST) {
      const files = buildMarketplacePackageTextFiles(tileData, profile.id);
      const names = files.map((f) => f.name);
      expect(names, `${profile.id}`).toContain('title.txt');
      expect(names, `${profile.id}`).toContain('keywords.txt');
      expect(names, `${profile.id}`).toContain('filename.txt');
      expect(names, `${profile.id}`).toContain('metadata.json');
    }
  });

  it('includes description.txt only for marketplaces that actually have description text', () => {
    const tileData = makeTileData('pkg-description');
    const shutterstockFiles = buildMarketplacePackageTextFiles(tileData, 'shutterstock');
    expect(shutterstockFiles.map((f) => f.name)).toContain('description.txt');
    const adobeFiles = buildMarketplacePackageTextFiles(tileData, 'adobestock');
    expect(adobeFiles.map((f) => f.name)).not.toContain('description.txt');
  });

  it('metadata.json is valid JSON carrying the real generated SEO + validation result', () => {
    const tileData = makeTileData('pkg-metadata-json');
    const files = buildMarketplacePackageTextFiles(tileData, 'shutterstock');
    const metaFile = files.find((f) => f.name === 'metadata.json')!;
    const parsed = JSON.parse(metaFile.content);
    expect(parsed.marketplace).toBe('shutterstock');
    expect(parsed.seed).toBe('pkg-metadata-json');
    expect(typeof parsed.title).toBe('string');
    expect(Array.isArray(parsed.keywords)).toBe(true);
    expect(parsed.validation).toHaveProperty('ready');
    expect(Array.isArray(parsed.validation.issues)).toBe(true);
  });

  it('title.txt and filename.txt content matches what marketplaceSeo would generate', () => {
    const tileData = makeTileData('pkg-content-match');
    const files = buildMarketplacePackageTextFiles(tileData, 'shutterstock');
    const title = files.find((f) => f.name === 'title.txt')!.content;
    const filename = files.find((f) => f.name === 'filename.txt')!.content;
    expect(title.length).toBeGreaterThan(0);
    expect(filename).toMatch(/\.eps$/);
  });

  it('is fully deterministic for the same tileData + marketplace', () => {
    const tileData = makeTileData('pkg-det');
    const a = buildMarketplacePackageTextFiles(tileData, 'etsy');
    const b = buildMarketplacePackageTextFiles(tileData, 'etsy');
    expect(a).toEqual(b);
  });

  it('respects a custom filename template', () => {
    const tileData = makeTileData('pkg-custom-filename');
    const files = buildMarketplacePackageTextFiles(tileData, 'shutterstock', '{seed}-custom-pkg');
    const filename = files.find((f) => f.name === 'filename.txt')!.content;
    expect(filename.startsWith('pkg-custom-filename-custom-pkg')).toBe(true);
  });
});

describe('exportPackage: buildPackageTextFilesFromSeo preserves user edits', () => {
  it('uses the caller-supplied seo verbatim instead of regenerating it', () => {
    const tileData = makeTileData('pkg-user-edit');
    const generated = generateMarketplaceSeo(tileData, 'shutterstock');
    const edited = {
      ...generated,
      title: 'My Hand-Edited Title That Differs From Generated',
      description: 'My hand-edited description text.',
      keywords: ['hand-edited-keyword-one', 'hand-edited-keyword-two'],
      filename: 'my-hand-edited-filename.eps',
    };
    // Sanity check: the edit really does differ from what generation would produce.
    expect(edited.title).not.toBe(generated.title);
    expect(edited.keywords).not.toEqual(generated.keywords);
    expect(edited.filename).not.toBe(generated.filename);

    const files = buildPackageTextFilesFromSeo(tileData, 'shutterstock', edited);
    expect(files.find((f) => f.name === 'title.txt')!.content).toBe(edited.title);
    expect(files.find((f) => f.name === 'description.txt')!.content).toBe(edited.description);
    expect(files.find((f) => f.name === 'keywords.txt')!.content).toBe(edited.keywords.join(', '));
    expect(files.find((f) => f.name === 'filename.txt')!.content).toBe(edited.filename);

    const meta = JSON.parse(files.find((f) => f.name === 'metadata.json')!.content);
    expect(meta.title).toBe(edited.title);
    expect(meta.keywords).toEqual(edited.keywords);
    expect(meta.filename).toBe(edited.filename);
  });

  it('validates the caller-supplied seo (not a freshly generated one) inside metadata.json', () => {
    const tileData = makeTileData('pkg-user-edit-invalid');
    const generated = generateMarketplaceSeo(tileData, 'shutterstock');
    // Deliberately break the title so validation on the edited seo must fail
    // even though a freshly generated seo for this seed would pass.
    const broken = { ...generated, title: 'short' };
    const files = buildPackageTextFilesFromSeo(tileData, 'shutterstock', broken);
    const meta = JSON.parse(files.find((f) => f.name === 'metadata.json')!.content);
    expect(meta.validation.ready).toBe(false);
    expect(meta.validation.issues.some((i: { message: string }) => /title/i.test(i.message))).toBe(true);
  });

  it('buildMarketplacePackageTextFiles delegates to buildPackageTextFilesFromSeo with freshly generated seo', () => {
    const tileData = makeTileData('pkg-delegation-check');
    const generated = generateMarketplaceSeo(tileData, 'freepik');
    const viaWrapper = buildMarketplacePackageTextFiles(tileData, 'freepik');
    const viaDirect = buildPackageTextFilesFromSeo(tileData, 'freepik', generated);
    // Every file matches byte-for-byte except metadata.json, whose
    // `generatedAt` timestamp is allowed to differ by a millisecond between
    // the two independent calls (each does its own `new Date()`).
    const strip = (files: typeof viaWrapper) =>
      files.map((f) => (f.name === 'metadata.json' ? { ...f, content: JSON.stringify({ ...JSON.parse(f.content), generatedAt: null }) } : f));
    expect(strip(viaWrapper)).toEqual(strip(viaDirect));
  });
});
