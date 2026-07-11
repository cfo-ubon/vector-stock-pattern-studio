import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildDesignSpecification } from '../trend/designIntelligence';
import type { KeywordBundle } from '../trend/designSpecTypes';
import { TREND_PACK_LIST } from '../trend/trendPacks';
import {
  exportDesignSpecificationFile,
  readDesignSpecificationFile,
  exportTrendPackFile,
  readTrendPackFile,
} from './workbenchImportExport';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical',
    secondaryKeywords: ['Wallpaper'],
    marketplace: 'adobestock',
    season: 'spring',
    audience: 'editorial',
    commercialCategory: 'wallpaper',
    patternType: 'botanical',
    paletteDirection: 'muted green',
    difficulty: 'moderate',
    collectionSize: 8,
    ...overrides,
  };
}

beforeEach(() => {
  // jsdom doesn't implement the Blob URL APIs — stub them so the
  // download-trigger code path (anchor click) can run in tests.
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('workbenchImportExport: Design Specification', () => {
  it('exportDesignSpecificationFile triggers a download without throwing', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(() => exportDesignSpecificationFile(spec)).not.toThrow();
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('readDesignSpecificationFile round-trips a spec exported to JSON', async () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const file = new File([JSON.stringify(spec)], 'spec.json', { type: 'application/json' });
    const parsed = await readDesignSpecificationFile(file);
    expect(parsed).toEqual(spec);
  });

  it('readDesignSpecificationFile rejects a malformed file', async () => {
    const file = new File(['not json'], 'spec.json', { type: 'application/json' });
    await expect(readDesignSpecificationFile(file)).rejects.toThrow();
  });
});

describe('workbenchImportExport: Trend Pack', () => {
  it('exportTrendPackFile triggers a download without throwing', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(() => exportTrendPackFile(TREND_PACK_LIST[0])).not.toThrow();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('readTrendPackFile round-trips a real trend pack', async () => {
    const pack = TREND_PACK_LIST[0];
    const file = new File([JSON.stringify({ schemaVersion: 1, exportedAt: 1, trendPack: pack })], 'pack.json', { type: 'application/json' });
    const parsed = await readTrendPackFile(file);
    expect(parsed).toEqual(pack);
  });
});
