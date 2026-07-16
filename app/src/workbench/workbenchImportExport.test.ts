import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildDesignSpecification } from '../trend/designIntelligence';
import type { KeywordBundle } from '../trend/designSpecTypes';
import { TREND_PACK_LIST } from '../trend/trendPacks';
import { DEFAULT_WORKSPACE_SETTINGS } from './workspaceSettings';
import { MARKETPLACE_DATA_BY_ID } from '../marketplaces';
import {
  exportDesignSpecificationFile,
  readDesignSpecificationFile,
  exportTrendPackFile,
  readTrendPackFile,
  exportWorkspaceSettingsFile,
  readWorkspaceSettingsFile,
  exportCollectionSpecificationFile,
  exportMarketplaceProfileFile,
  readMarketplaceProfileFile,
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

describe('workbenchImportExport: Workspace Settings (Phase 6, Section 10)', () => {
  it('exportWorkspaceSettingsFile triggers a download without throwing', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(() => exportWorkspaceSettingsFile(DEFAULT_WORKSPACE_SETTINGS)).not.toThrow();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('readWorkspaceSettingsFile round-trips a real WorkspaceSettings object', async () => {
    const settings = { ...DEFAULT_WORKSPACE_SETTINGS, leftWidth: 340, theme: 'light' as const };
    const file = new File([JSON.stringify(settings)], 'settings.json', { type: 'application/json' });
    const parsed = await readWorkspaceSettingsFile(file);
    expect(parsed).toEqual(settings);
  });

  it('readWorkspaceSettingsFile rejects malformed JSON', async () => {
    const file = new File(['not json'], 'settings.json', { type: 'application/json' });
    await expect(readWorkspaceSettingsFile(file)).rejects.toThrow();
  });
});

describe('workbenchImportExport: Collection Specification (Phase 6, Section 10)', () => {
  it('exportCollectionSpecificationFile builds a real Collection Spec from the spec/seed and triggers a download', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(() => exportCollectionSpecificationFile(spec, 'export-collection-spec-seed')).not.toThrow();
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});

describe('workbenchImportExport: Marketplace Profile (Phase 6, Section 10)', () => {
  it('exportMarketplaceProfileFile downloads a real committed profile', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(() => exportMarketplaceProfileFile('shutterstock')).not.toThrow();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('exportMarketplaceProfileFile is a no-op for an unknown marketplace id', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    exportMarketplaceProfileFile('not-a-real-marketplace');
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('readMarketplaceProfileFile reports zero issues for a valid, real, committed profile', async () => {
    const data = MARKETPLACE_DATA_BY_ID.shutterstock;
    const file = new File([JSON.stringify(data)], 'profile.json', { type: 'application/json' });
    const { data: parsed, issues } = await readMarketplaceProfileFile(file);
    expect(parsed.id).toBe('shutterstock');
    expect(issues).toEqual([]);
  });

  it('readMarketplaceProfileFile reports schema issues for an invalid profile, without throwing', async () => {
    const broken = { ...MARKETPLACE_DATA_BY_ID.shutterstock, titleRules: undefined };
    const file = new File([JSON.stringify(broken)], 'profile.json', { type: 'application/json' });
    const { issues } = await readMarketplaceProfileFile(file);
    expect(issues.length).toBeGreaterThan(0);
  });
});
