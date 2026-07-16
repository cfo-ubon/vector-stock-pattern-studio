import { describe, it, expect } from 'vitest';
import type { MarketplaceSeo } from './marketplaceSeo';
import { MARKETPLACE_PROFILES } from './marketplaceProfiles';
import {
  validateMarketplaceSeo,
  isMarketplaceReady,
  validateCollectionName,
  validateAssetName,
  validatePreview,
  validateExportPackage,
  validateDisplay,
  validateMarketplaceSubmission,
} from './marketplaceValidation';

function baseSeo(overrides: Partial<MarketplaceSeo> = {}): MarketplaceSeo {
  return {
    marketplaceId: 'shutterstock',
    title: 'A perfectly reasonable seamless vector pattern title',
    description: 'A perfectly reasonable description that is long enough to pass validation checks easily.',
    keywords: ['seamless', 'pattern', 'vector', 'floral', 'botanical', 'flower', 'garden'],
    filename: 'my-pattern-abc123.eps',
    ...overrides,
  };
}

describe('marketplaceValidation: validation', () => {
  it('a healthy SEO package produces zero issues and is ready', () => {
    const issues = validateMarketplaceSeo(baseSeo(), MARKETPLACE_PROFILES.shutterstock);
    expect(issues).toEqual([]);
    expect(isMarketplaceReady(issues)).toBe(true);
  });

  it('flags title too short', () => {
    const issues = validateMarketplaceSeo(baseSeo({ title: 'short' }), MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'titleTooShort')).toBe(true);
    expect(isMarketplaceReady(issues)).toBe(false);
  });

  it('flags title too long', () => {
    const issues = validateMarketplaceSeo(baseSeo({ title: 'x'.repeat(300) }), MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'titleTooLong')).toBe(true);
    expect(isMarketplaceReady(issues)).toBe(false);
  });

  it('flags description missing when the marketplace requires one', () => {
    const issues = validateMarketplaceSeo(baseSeo({ description: '' }), MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'descriptionMissing')).toBe(true);
  });

  it('does not flag a missing description for a marketplace with no description field (Adobe Stock)', () => {
    const issues = validateMarketplaceSeo(baseSeo({ description: '' }), MARKETPLACE_PROFILES.adobestock);
    expect(issues.some((i) => i.code === 'descriptionMissing')).toBe(false);
  });

  it('flags missing keywords (below minCount)', () => {
    const issues = validateMarketplaceSeo(baseSeo({ keywords: ['seamless'] }), MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'keywordsMissing')).toBe(true);
  });

  it('flags too many keywords (above maxCount)', () => {
    const manyKeywords = Array.from({ length: 60 }, (_, i) => `kw${i}`);
    const issues = validateMarketplaceSeo(baseSeo({ keywords: manyKeywords }), MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'keywordsTooMany')).toBe(true);
  });

  it('flags duplicate keywords (case-insensitive)', () => {
    const issues = validateMarketplaceSeo(baseSeo({ keywords: ['Seamless', 'seamless', 'pattern', 'vector', 'floral', 'botanical', 'flower'] }), MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'duplicateKeywords')).toBe(true);
  });

  it('flags an Etsy tag that exceeds the 20-character-per-tag limit', () => {
    const issues = validateMarketplaceSeo(
      baseSeo({ keywords: ['this-tag-is-way-too-long-for-etsy', 'seamless', 'pattern', 'vector', 'floral'] }),
      MARKETPLACE_PROFILES.etsy,
    );
    expect(issues.some((i) => i.code === 'keywordTooLong')).toBe(true);
  });

  it('flags an invalid filename (unsafe characters)', () => {
    const issues = validateMarketplaceSeo(baseSeo({ filename: 'my pattern!@#.svg' }), MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'filenameInvalid')).toBe(true);
  });

  it('accepts a clean lowercase-hyphenated filename', () => {
    const issues = validateMarketplaceSeo(baseSeo({ filename: 'my-clean-filename-123.svg' }), MARKETPLACE_PROFILES.creativefabrica);
    expect(issues.some((i) => i.code === 'filenameInvalid')).toBe(false);
  });

  it('errors make isMarketplaceReady false; warnings alone keep it true', () => {
    const warningOnly = [{ code: 'keywordsMissing' as const, severity: 'warning' as const, message: 'x' }];
    const withError = [{ code: 'titleTooLong' as const, severity: 'error' as const, message: 'x' }];
    expect(isMarketplaceReady(warningOnly)).toBe(true);
    expect(isMarketplaceReady(withError)).toBe(false);
  });
});

describe('validateCollectionName (Section 3)', () => {
  it('a real, in-range name produces zero issues', () => {
    expect(validateCollectionName('Luxury Botanical Collection', MARKETPLACE_PROFILES.shutterstock)).toEqual([]);
  });

  it('an empty name is a suggestion, not an error (never blocks readiness)', () => {
    const issues = validateCollectionName('', MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'collectionNameMissing' && i.severity === 'suggestion')).toBe(true);
    expect(isMarketplaceReady(issues)).toBe(true);
  });

  it('a too-long name is a warning', () => {
    const issues = validateCollectionName('x'.repeat(500), MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'collectionNameTooLong' && i.severity === 'warning')).toBe(true);
  });
});

describe('validateAssetName (Section 3)', () => {
  it('a real name produces zero issues', () => {
    expect(validateAssetName('Hero Pattern', MARKETPLACE_PROFILES.shutterstock)).toEqual([]);
  });

  it('an empty asset name is a warning', () => {
    const issues = validateAssetName('   ', MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'assetNameMissing')).toBe(true);
  });

  it('an overly long asset name is a warning, using titleRules.maxLength as the ceiling', () => {
    const issues = validateAssetName('x'.repeat(MARKETPLACE_PROFILES.adobestock.titleRules.maxLength + 10), MARKETPLACE_PROFILES.adobestock);
    expect(issues.some((i) => i.code === 'assetNameTooLong')).toBe(true);
  });
});

describe('validatePreview (Section 3)', () => {
  it('a preview meeting the profile\'s minimums and format produces zero issues', () => {
    const req = MARKETPLACE_PROFILES.shutterstock.previewRequirements;
    const issues = validatePreview({ width: req.minWidth, height: req.minHeight, format: req.format }, MARKETPLACE_PROFILES.shutterstock);
    expect(issues).toEqual([]);
  });

  it('a too-small preview is an error', () => {
    const issues = validatePreview({ width: 10, height: 10, format: MARKETPLACE_PROFILES.shutterstock.previewRequirements.format }, MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'previewTooSmall' && i.severity === 'error')).toBe(true);
  });

  it('a mismatched format is a warning, not an error', () => {
    const req = MARKETPLACE_PROFILES.shutterstock.previewRequirements;
    const issues = validatePreview({ width: req.minWidth, height: req.minHeight, format: 'bmp' }, MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'previewFormatMismatch' && i.severity === 'warning')).toBe(true);
  });
});

describe('validateExportPackage (Section 3)', () => {
  it('a complete package (every required file present) produces zero issues', () => {
    expect(validateExportPackage(MARKETPLACE_PROFILES.shutterstock.exportPackageFiles, MARKETPLACE_PROFILES.shutterstock)).toEqual([]);
  });

  it('a package missing required files is an error naming exactly what\'s missing', () => {
    const issues = validateExportPackage(['pattern.svg'], MARKETPLACE_PROFILES.shutterstock);
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('title.txt');
  });
});

describe('validateDisplay (Section 3, near-limit "suggestion" tier)', () => {
  it('a title near the marketplace\'s max length produces a suggestion', () => {
    const maxLength = MARKETPLACE_PROFILES.adobestock.titleRules.maxLength;
    const issues = validateDisplay(baseSeo({ title: 'x'.repeat(maxLength - 1) }), MARKETPLACE_PROFILES.adobestock);
    expect(issues.some((i) => i.code === 'titleNearLimit' && i.severity === 'suggestion')).toBe(true);
  });

  it('a comfortably short title produces no display suggestions', () => {
    const issues = validateDisplay(baseSeo(), MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'titleNearLimit')).toBe(false);
  });
});

describe('validateMarketplaceSubmission (Section 3, full surface)', () => {
  it('only runs checks for fields actually present in the input', () => {
    const issues = validateMarketplaceSubmission({ seo: baseSeo() }, MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'collectionNameMissing')).toBe(false);
    expect(issues.some((i) => i.code === 'assetNameMissing')).toBe(false);
    expect(issues.some((i) => i.code === 'previewTooSmall')).toBe(false);
    expect(issues.some((i) => i.code === 'exportPackageMissingFiles')).toBe(false);
  });

  it('runs every check once all fields are supplied', () => {
    const profile = MARKETPLACE_PROFILES.shutterstock;
    const issues = validateMarketplaceSubmission(
      {
        seo: baseSeo(),
        collectionName: 'Luxury Botanical Collection',
        assetName: 'Hero Pattern',
        preview: { width: profile.previewRequirements.minWidth, height: profile.previewRequirements.minHeight, format: profile.previewRequirements.format },
        packageFiles: profile.exportPackageFiles,
      },
      profile,
    );
    expect(issues).toEqual([]);
  });

  it('a genuinely incomplete submission surfaces issues across multiple sections at once', () => {
    const profile = MARKETPLACE_PROFILES.shutterstock;
    const issues = validateMarketplaceSubmission(
      { seo: baseSeo({ title: 'short' }), collectionName: '', assetName: '', packageFiles: [] },
      profile,
    );
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('titleTooShort');
    expect(codes).toContain('collectionNameMissing');
    expect(codes).toContain('assetNameMissing');
    expect(codes).toContain('exportPackageMissingFiles');
  });
});
