import { describe, it, expect, beforeEach } from 'vitest';
import { File as NodeFile } from 'node:buffer';
import {
  detectBuildLabel,
  isHistoricalManifestOrReportFile,
  importHistoricalPortfolio,
  type HistoricalFileEntry,
} from './historicalPortfolioImport';
import { clearPortfolioStores, loadPortfolioAssets } from '../storage/portfolioStore';

beforeEach(async () => {
  await clearPortfolioStores();
});

function makeFile(name: string, content: string, type = 'text/plain'): File {
  return new NodeFile([content], name, { type }) as unknown as File;
}

describe('detectBuildLabel', () => {
  it('detects build_025 from a nested relative path', () => {
    expect(detectBuildLabel('reports/build_025/portfolio_100/svg/luxuryFloral_1.svg')).toBe('build_025');
  });

  it('detects portfolio_phase_1 (not the b-review variant) from its own path', () => {
    expect(detectBuildLabel('portfolio_phase_1/01_premium_botanical_floral/x.svg')).toBe('portfolio_phase_1');
  });

  it('detects portfolio_phase_1b_review distinctly, never falling through to portfolio_phase_1', () => {
    expect(detectBuildLabel('portfolio_phase_1b_review/contact_sheets/x.png')).toBe('portfolio_phase_1b_review');
  });

  it('falls back to unknown-build for an unrecognized path', () => {
    expect(detectBuildLabel('some/random/folder/x.svg')).toBe('unknown-build');
  });
});

describe('isHistoricalManifestOrReportFile', () => {
  it('recognizes known aggregate manifest/report filenames case-insensitively', () => {
    expect(isHistoricalManifestOrReportFile('portfolio_manifest.csv')).toBe(true);
    expect(isHistoricalManifestOrReportFile('MANIFEST.json')).toBe(true);
    expect(isHistoricalManifestOrReportFile('HUMAN_REVIEW_CHECKLIST.csv')).toBe(true);
    expect(isHistoricalManifestOrReportFile('README.md')).toBe(true);
    expect(isHistoricalManifestOrReportFile('01_premium_botanical_floral.zip')).toBe(true);
  });

  it('does not flag a per-pattern JSON sidecar or a real asset file', () => {
    expect(isHistoricalManifestOrReportFile('berry-punch-botanical-floral-0.json')).toBe(false);
    expect(isHistoricalManifestOrReportFile('berry-punch-botanical-floral-0.svg')).toBe(false);
    expect(isHistoricalManifestOrReportFile('berry-punch-botanical-floral-0.png')).toBe(false);
  });
});

describe('importHistoricalPortfolio', () => {
  function buildFixture(): HistoricalFileEntry[] {
    const patternJson = JSON.stringify({ seed: 'phase1-01-0', styleDna: 'premiumBotanical', compositionType: 'bouquet' });
    const csv = ['filename,decision', 'berry-punch-0,READY', 'missing-pattern-99,REJECT'].join('\n');

    return [
      { file: makeFile('berry-punch-0.svg', '<svg>content</svg>', 'image/svg+xml'), relativePath: 'portfolio_phase_1/01_premium_botanical_floral/berry-punch-0.svg' },
      { file: makeFile('berry-punch-0.json', patternJson, 'application/json'), relativePath: 'portfolio_phase_1/01_premium_botanical_floral/berry-punch-0.json' },
      { file: makeFile('portfolio_manifest.csv', csv, 'text/csv'), relativePath: 'portfolio_phase_1/portfolio_manifest.csv' },
      { file: makeFile('01_premium_botanical_floral.zip', 'not really a zip', 'application/zip'), relativePath: 'portfolio_phase_1/01_premium_botanical_floral/01_premium_botanical_floral.zip' },
      { file: makeFile('phase1_summary.json', 'this is not valid json {{{', 'application/json'), relativePath: 'portfolio_phase_1/phase1_summary.json' },
    ];
  }

  it('imports the real asset quad and skips manifest/report/zip files', async () => {
    const { report, batchResult } = await importHistoricalPortfolio(buildFixture(), []);
    expect(batchResult.importedCount).toBe(1);
    expect(batchResult.errorCount).toBe(0);
    expect(report.buildLabelsSeen).toEqual(['portfolio_phase_1']);
    expect(report.skippedFiles.map((f) => f.filename)).toContain('01_premium_botanical_floral.zip');
  });

  it('parses the CSV manifest and reports how many entries it found', async () => {
    const { report } = await importHistoricalPortfolio(buildFixture(), []);
    expect(report.manifestEntriesFound).toBe(2);
  });

  it('reports a malformed manifest file rather than silently dropping it', async () => {
    const { report } = await importHistoricalPortfolio(buildFixture(), []);
    expect(report.malformedManifestFiles).toContain('portfolio_phase_1/phase1_summary.json');
  });

  it('reports a manifest row referencing a file that was never provided', async () => {
    const { report } = await importHistoricalPortfolio(buildFixture(), []);
    expect(report.missingReferences).toContainEqual({ key: 'missing-pattern-99', buildLabel: 'portfolio_phase_1' });
  });

  it('tags the imported asset with its build label and original decision', async () => {
    await importHistoricalPortfolio(buildFixture(), []);
    const assets = await loadPortfolioAssets();
    expect(assets).toHaveLength(1);
    expect(assets[0].tags).toContain('historical-import:portfolio_phase_1');
    expect(assets[0].tags).toContain('historical-decision:READY');
  });

  it('never modifies the input File objects (browser File API has no write-back)', async () => {
    const fixture = buildFixture();
    const originalNames = fixture.map((e) => e.file.name);
    await importHistoricalPortfolio(fixture, []);
    expect(fixture.map((e) => e.file.name)).toEqual(originalNames);
  });
});
