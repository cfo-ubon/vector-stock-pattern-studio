import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { buildTileForGenerate } from '../engine/heroDetector';
import {
  productionBundleBaseName,
  buildProductionItemFiles,
  buildProductionCsvBundle,
  buildProductionManifest,
  type ProductionBundleSource,
} from './productionBundleService';

function makeSource(seed: string, categoryId = 'botanical'): ProductionBundleSource {
  const variantParams = { ...defaultParams(), categoryId, seed };
  const { tileData } = buildTileForGenerate(variantParams);
  return { tileData, variantParams: tileData.params };
}

describe('productionBundleBaseName', () => {
  it('is deterministic for the same params', () => {
    const source = makeSource('bundle-det-1');
    expect(productionBundleBaseName(source.variantParams)).toBe(productionBundleBaseName(source.variantParams));
  });

  it('produces distinct base names for distinct seeds (uniqueness across a batch)', () => {
    const names = new Set<string>();
    for (let i = 0; i < 60; i++) {
      names.add(productionBundleBaseName(makeSource(`bundle-uniq-${i}`).variantParams));
    }
    expect(names.size).toBe(60);
  });
});

describe('buildProductionItemFiles', () => {
  it('produces non-empty, well-formed SVG and EPS text with a matching base name', () => {
    const source = makeSource('bundle-files-1');
    const files = buildProductionItemFiles(source);
    expect(files.baseName).toBe(productionBundleBaseName(source.variantParams));
    expect(files.svg).toContain('<svg');
    expect(files.svg).not.toMatch(/NaN|Infinity|undefined/);
    expect(files.eps).toContain('%!PS-Adobe-3.0 EPSF-3.0');
    expect(files.eps).not.toMatch(/NaN|Infinity|undefined/);
  });
});

describe('buildProductionCsvBundle', () => {
  it('produces one CSV row per item (plus header) with non-empty required fields, for every category', () => {
    const categories = ['botanical', 'geometric', 'tropical'];
    for (const categoryId of categories) {
      const sources = [makeSource(`bundle-csv-${categoryId}-1`, categoryId), makeSource(`bundle-csv-${categoryId}-2`, categoryId)];
      const { shutterstockCsv, adobeStockCsv } = buildProductionCsvBundle(sources);
      const shutterstockRows = shutterstockCsv.split('\r\n');
      const adobeRows = adobeStockCsv.split('\r\n');
      expect(shutterstockRows.length).toBe(sources.length + 1);
      expect(adobeRows.length).toBe(sources.length + 1);
      for (let i = 1; i < shutterstockRows.length; i++) {
        // Filename,Description,Keywords,Categories,Editorial,Mature content,Illustration
        const cols = shutterstockRows[i];
        expect(cols).toContain('.eps');
        expect(cols).not.toMatch(/^"",|,"",/); // no field is a bare empty quoted string
      }
      for (let i = 1; i < adobeRows.length; i++) {
        expect(adobeRows[i]).toContain('.eps');
      }
    }
  });

  it('gives distinct items distinct filenames inside the CSV (no accidental filename collapse)', () => {
    const sources = [makeSource('bundle-csv-distinct-1'), makeSource('bundle-csv-distinct-2'), makeSource('bundle-csv-distinct-3')];
    const { shutterstockCsv } = buildProductionCsvBundle(sources);
    const rows = shutterstockCsv.split('\r\n').slice(1);
    const filenames = rows.map((r) => r.split(',')[0]);
    expect(new Set(filenames).size).toBe(sources.length);
  });
});

describe('buildProductionManifest', () => {
  it('carries one entry per item with the same base name buildProductionItemFiles used', () => {
    const source = makeSource('bundle-manifest-1');
    const manifest = buildProductionManifest([{ source, attempts: 2, regenerated: true, status: 'imported' }]);
    expect(manifest.itemCount).toBe(1);
    expect(manifest.items[0].baseName).toBe(productionBundleBaseName(source.variantParams));
    expect(manifest.items[0].attempts).toBe(2);
    expect(manifest.items[0].regenerated).toBe(true);
    expect(manifest.items[0].status).toBe('imported');
    expect(() => new Date(manifest.generatedAt).toISOString()).not.toThrow();
  });
});
