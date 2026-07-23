// Build 026, Phase 18 (validation) — confirms the synthetic dataset
// `build026ValidationDataset.ts` produced actually exercises every
// engine it was built to demonstrate: the Commercial Feedback Engine's
// confidence gating (both a high-confidence preset and a genuine
// insufficient-data preset), the Production Recommendations engine, and
// the duplicate-submission detector's `same-production-asset` rule.
// Read-only: loads the JSON bundle and calls the same pure functions the
// app itself calls, never writes anything.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateCommercialFeedback } from '../src/catalog/commercial/commercialFeedbackEngine';
import { generateProductionRecommendations } from '../src/catalog/commercial/productionRecommendations';
import { detectDuplicateSubmission } from '../src/catalog/submission/submissionDuplicateDetection';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const bundlePath = path.resolve(__dirname, '../../reports/build_026/validation_dataset/DEMO_DATASET.json');
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf-8'));

  const feedback = generateCommercialFeedback({
    assets: bundle.assets,
    submissions: bundle.submissions,
    salesEvents: bundle.salesEvents,
    rejectionRecords: bundle.rejectionRecords,
  });

  const highConfidence = feedback.dimensions.filter((d: { confidence: string }) => d.confidence === 'high');
  const lowConfidence = feedback.dimensions.filter((d: { confidence: string; dimension: string; value: string }) => d.confidence === 'low' && d.dimension === 'presetId' && d.value === 'terrazzoAbstract');
  console.log(`Commercial Feedback: ${feedback.dimensions.length} dimension insights, ${highConfidence.length} at high confidence, terrazzoAbstract (deliberately small) present as low-confidence: ${lowConfidence.length > 0}`);

  const availablePresetIds = [...new Set(bundle.assets.map((a: { presetId: string | null }) => a.presetId).filter(Boolean))] as string[];
  const recommendations = generateProductionRecommendations({ assets: bundle.assets, availablePresetIds, commercialFeedback: feedback });
  console.log(`Production Recommendations: ${recommendations.recommendations.length} recommendations, ${recommendations.excludedDueToDuplicateRisk.length} excluded for duplicate risk`);

  const byProductionId = new Map<string, { assetId: string; productionAssetId: string | null }[]>();
  for (const a of bundle.assets) {
    if (!a.productionAssetId) continue;
    const list = byProductionId.get(a.productionAssetId) ?? [];
    list.push(a);
    byProductionId.set(a.productionAssetId, list);
  }
  let sameProductionAssetHits = 0;
  for (const [, group] of byProductionId) {
    if (group.length < 2) continue;
    const [a, b] = group;
    const submissionForA = bundle.submissions.find((s: { patternId: string }) => s.patternId === a.assetId);
    if (!submissionForA) continue;
    const result = detectDuplicateSubmission(
      { patternId: b.assetId, marketplaceId: submissionForA.marketplaceId, version: 1, productionAssetId: b.productionAssetId },
      bundle.submissions,
    );
    if (result.conflicts.some((c: { reason: string }) => c.reason === 'same-production-asset')) sameProductionAssetHits++;
  }
  console.log(`Duplicate detection: same-production-asset rule triggered for ${sameProductionAssetHits} of ${byProductionId.size} shared-productionAssetId groups checked`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
