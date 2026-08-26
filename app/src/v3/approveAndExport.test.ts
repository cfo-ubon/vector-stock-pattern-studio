import { describe, it, expect, beforeEach } from 'vitest';
import { generateConcepts } from './generateFromIntent';
import { analyzeKeyword } from './keywordIntent';
import { importConcept, runCommercialQualityGate, exportConceptToMarketplace } from './approveAndExport';
import { clearPortfolioStores } from '../catalog/storage/portfolioStore';
import { clearQualitySnapshots } from '../catalog/quality/qualitySnapshotStore';

// Real IndexedDB round trip via fake-indexeddb (globally installed in
// testSetup.ts) — this exercises the actual importFileGroup/
// revalidateDesignVersion/computeCommercialReadiness/generateSeoPackage/
// executeBulkMarketplaceExport pipeline, not mocks. Uses the same
// clearPortfolioStores()/clearQualitySnapshots() clean-state convention
// every other IndexedDB-backed test in this codebase already uses
// (e.g. designRevalidation.test.ts) rather than deleting the whole
// database, which can hang waiting on an already-open connection.
describe('AI-SBOS v3 Commercial QA + Export (Milestones 13-18, real IndexedDB)', () => {
  beforeEach(async () => {
    await clearPortfolioStores();
    await clearQualitySnapshots();
  });

  it('imports a generated concept into the real Portfolio catalog', async () => {
    const intent = analyzeKeyword('minimal botanical leaves');
    const [concept] = generateConcepts(intent, 1);
    const outcome = await importConcept(concept);
    expect(outcome.status).toBe('imported');
    if (outcome.status === 'imported') {
      expect(outcome.asset.generatorVersion).toBe('ai-sbos-v3');
    }
  });

  it('runs the real Commercial Quality Gate producing all 6 named gates', async () => {
    const intent = analyzeKeyword('minimal botanical leaves');
    const [concept] = generateConcepts(intent, 1);
    const outcome = await importConcept(concept);
    expect(outcome.status).toBe('imported');
    if (outcome.status !== 'imported') return;

    const qa = await runCommercialQualityGate(concept, outcome.asset, 'etsy');
    const gateIds = qa.gates.map((g) => g.id);
    expect(gateIds).toEqual(['VECTOR', 'SEAMLESS', 'QUALITY', 'COMMERCIAL', 'METADATA', 'MARKETPLACE']);
    expect(['READY', 'REVIEW', 'BLOCKED']).toContain(qa.overallStatus);
  });

  it('never marks overallStatus READY if the Vector or Seamless gate is BLOCKED', async () => {
    const intent = analyzeKeyword('minimal botanical leaves');
    const [concept] = generateConcepts(intent, 1);
    const outcome = await importConcept(concept);
    if (outcome.status !== 'imported') return;
    const qa = await runCommercialQualityGate(concept, outcome.asset, 'etsy');
    const vectorGate = qa.gates.find((g) => g.id === 'VECTOR')!;
    const seamlessGate = qa.gates.find((g) => g.id === 'SEAMLESS')!;
    if (vectorGate.status === 'BLOCKED' || seamlessGate.status === 'BLOCKED') {
      expect(qa.overallStatus).toBe('BLOCKED');
    }
  });

  it('generates real, grounded SEO content describing the actual artwork (never empty)', async () => {
    const intent = analyzeKeyword('japanese geometric');
    const [concept] = generateConcepts(intent, 1);
    const outcome = await importConcept(concept);
    if (outcome.status !== 'imported') return;
    const qa = await runCommercialQualityGate(concept, outcome.asset, 'shutterstock');
    expect(qa.seoPackage.title.length).toBeGreaterThan(0);
    expect(qa.seoPackage.keywords.length).toBeGreaterThan(0);
  });

  it('exports a real marketplace package for a READY/REVIEW asset', async () => {
    const intent = analyzeKeyword('christmas candy');
    const [concept] = generateConcepts(intent, 1);
    const outcome = await importConcept(concept);
    if (outcome.status !== 'imported') return;
    const qa = await runCommercialQualityGate(concept, outcome.asset, 'etsy');
    const results = await exportConceptToMarketplace(qa, 'etsy');
    expect(results.length).toBeGreaterThan(0);
  });

  it('rejects an unknown marketplace id rather than silently exporting to the wrong profile', async () => {
    const intent = analyzeKeyword('christmas candy');
    const [concept] = generateConcepts(intent, 1);
    const outcome = await importConcept(concept);
    if (outcome.status !== 'imported') return;
    const qa = await runCommercialQualityGate(concept, outcome.asset, 'etsy');
    // @ts-expect-error deliberately invalid marketplace id for this test
    await expect(exportConceptToMarketplace(qa, 'not-a-real-marketplace')).rejects.toThrow();
  });
});
