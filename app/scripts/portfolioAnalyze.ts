import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { STYLE_DNA_PRESETS } from '../src/engine/styleDna';
import type { PortfolioManifest, PortfolioPatternRecord } from '../src/portfolio/types';
import { computePortfolioRanking } from '../src/portfolio/ranking';
import { computePortfolioDuplicates } from '../src/portfolio/duplicates';
import { computePortfolioClusters, type ClusterSummary } from '../src/portfolio/clustering';
import { discoverFailurePatterns, discoverSuccessPatterns, type TraitFinding } from '../src/portfolio/successFailure';
import { buildBuild014Recommendation, computeRecommendationTags } from '../src/portfolio/recommendations';
import { computeSampleConfidence, type SampleConfidenceResult } from '../src/portfolio/confidence';

// Build 013, Sections 5-12 orchestration. Reads the raw 5,000-pattern
// manifest `portfolioGenerate.ts` produced (Section 4) and runs every
// analysis pass on top of it — this script performs NO generation and NO
// new scoring of its own; every number here is derived from fields already
// computed and stored on `PortfolioPatternRecord`.
//
// Output is deliberately split in two:
//  - `BUILD_013_portfolio_raw.json` (gitignored, tens of MB): the full
//    per-tile corpus — kept locally for anyone re-running this analysis,
//    never committed.
//  - `BUILD_013_METRICS.json` (committed, small): every aggregate number
//    `BUILD_013_REPORT.md` quotes — the "lightweight manifest" the brief
//    asks to ship, not a raw dump.

function __dirnameFromUrl(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

function stylePresetLabels(): Record<string, string> {
  return Object.fromEntries(Object.entries(STYLE_DNA_PRESETS).map(([id, dna]) => [id, dna.label]));
}

function summarizeFinding(f: TraitFinding) {
  return { trait: f.traitName, value: f.value, occurrences: f.occurrences, subgroupSize: f.subgroupSize, populationFraction: f.populationFraction, subgroupFraction: f.subgroupFraction, lift: f.lift, confidence: f.confidence, reason: f.reason };
}

function summarizeCluster(c: ClusterSummary) {
  return { clusterId: c.clusterId, label: c.label, styleDnaId: c.styleDnaId, layoutClass: c.layoutClass, scoreBand: c.scoreBand, size: c.size, avgCompositeRankScore: c.avgCompositeRankScore, avgAbsoluteCommercialQualityV2: c.avgAbsoluteCommercialQualityV2, dominantProductTargets: c.dominantProductTargets, dominantFailureModes: c.dominantFailureModes, dominantStrengthTags: c.dominantStrengthTags, samplePatternIds: c.samplePatternIds };
}

function samplePatterns(patterns: PortfolioPatternRecord[], n: number) {
  return patterns.slice(0, n).map((p) => ({
    patternId: p.patternId, styleDnaId: p.styleDnaId, layoutId: p.layoutId, productTarget: p.productTarget,
    compositeRankScore: p.compositeRankScore, percentileOverall: p.percentileOverall, percentileBucket: p.percentileBucket,
    absoluteCommercialQualityV2: p.absoluteCommercialQualityV2, failureModes: p.failureModes, strengthTags: p.strengthTags,
    duplicateStatus: p.duplicateStatus, clusterLabel: p.clusterLabel, evaluatorConfidence: p.evaluatorConfidence,
  }));
}

function presetLevelSummary(patterns: PortfolioPatternRecord[]) {
  const byPreset = new Map<string, PortfolioPatternRecord[]>();
  for (const p of patterns) {
    const group = byPreset.get(p.styleDnaId);
    if (group) group.push(p);
    else byPreset.set(p.styleDnaId, [p]);
  }
  return [...byPreset.entries()].map(([styleDnaId, group]) => {
    const scores = group.map((p) => p.absoluteCommercialQualityV2);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const confidence: SampleConfidenceResult = computeSampleConfidence({ sampleSize: group.length, values: scores, coverageFraction: 1 });
    return { styleDnaId, count: group.length, avgAbsoluteCommercialQualityV2: Math.round(avg * 100) / 100, confidence: confidence.tier, coefficientOfVariation: Math.round(confidence.coefficientOfVariation * 1000) / 1000 };
  }).sort((a, b) => b.avgAbsoluteCommercialQualityV2 - a.avgAbsoluteCommercialQualityV2);
}

function main() {
  const __dirname = __dirnameFromUrl();
  const baselinesDir = path.resolve(__dirname, '../../docs/build_reports/baselines');
  const rawPath = path.join(baselinesDir, 'BUILD_013_portfolio_raw.json');
  // Committed alongside BUILD_013_REPORT.md, matching Build 012's own
  // `docs/build_reports/BUILD_012_METRICS.json` convention — not under
  // `baselines/` (that directory holds gitignored/large working data).
  const metricsPath = path.resolve(__dirname, '../../docs/build_reports/BUILD_013_METRICS.json');

  console.log(`Reading ${rawPath}...`);
  const manifest: PortfolioManifest = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
  const { patterns } = manifest;
  console.log(`Loaded ${patterns.length} patterns.`);

  console.log('Section 5: ranking and percentiles...');
  computePortfolioRanking(patterns);

  console.log('Section 8: similarity and duplicate detection...');
  const duplicateCounts = computePortfolioDuplicates(patterns);

  console.log('Section 9: clustering...');
  const clusters = computePortfolioClusters(patterns, stylePresetLabels());

  console.log('Section 11: per-tile recommendation tags...');
  for (const p of patterns) p.recommendationTags = computeRecommendationTags(p);

  console.log('Section 6/7: success and failure pattern discovery...');
  const successTop10 = discoverSuccessPatterns(patterns, 'top10');
  const successTop5 = discoverSuccessPatterns(patterns, 'top5');
  const successTop1 = discoverSuccessPatterns(patterns, 'top1');
  const failureBottom10 = discoverFailurePatterns(patterns, 'bottom10');
  const failureBottom5 = discoverFailurePatterns(patterns, 'bottom5');
  const failureBottom1 = discoverFailurePatterns(patterns, 'bottom1');

  console.log('Section 12: Build 014 recommendation...');
  const build014Recommendation = buildBuild014Recommendation(failureBottom10, patterns.length);

  console.log('Section 10: portfolio-level confidence...');
  const overallScores = patterns.map((p) => p.compositeRankScore ?? 0);
  const overallConfidence = computeSampleConfidence({ sampleSize: patterns.length, values: overallScores, coverageFraction: 1 });
  const perPresetConfidence = presetLevelSummary(patterns);
  const evaluatorConfidenceCounts = { high: 0, medium: 0, low: 0 };
  for (const p of patterns) evaluatorConfidenceCounts[p.evaluatorConfidence]++;

  const metrics = {
    schemaVersion: manifest.schemaVersion,
    generatedAt: manifest.generatedAt,
    analyzedAt: new Date().toISOString(),
    baseline: manifest.baseline,
    totalPatterns: manifest.totalPatterns,
    distribution: manifest.distribution,
    perPresetSummary: perPresetConfidence,
    duplicateCounts,
    clusters: clusters.map(summarizeCluster),
    successFindings: { top10: successTop10.slice(0, 15).map(summarizeFinding), top5: successTop5.slice(0, 15).map(summarizeFinding), top1: successTop1.slice(0, 15).map(summarizeFinding) },
    failureFindings: { bottom10: failureBottom10.slice(0, 15).map(summarizeFinding), bottom5: failureBottom5.slice(0, 15).map(summarizeFinding), bottom1: failureBottom1.slice(0, 15).map(summarizeFinding) },
    build014Recommendation,
    portfolioConfidence: { tier: overallConfidence.tier, coefficientOfVariation: overallConfidence.coefficientOfVariation, reason: overallConfidence.reason },
    evaluatorConfidenceCounts,
    samples: {
      top10ByOverall: samplePatterns([...patterns].sort((a, b) => (a.rankOverall ?? 0) - (b.rankOverall ?? 0)), 10),
      bottom10ByOverall: samplePatterns([...patterns].sort((a, b) => (b.rankOverall ?? 0) - (a.rankOverall ?? 0)), 10),
    },
  };

  fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
  console.log(`Wrote ${metricsPath}`);

  // The enriched per-tile ranks/clusters/duplicate status/recommendation
  // tags are written back into the raw manifest too, so
  // `portfolioVisuals.ts` (Section 13) can pick genuinely representative
  // samples by percentile/cluster without re-running this whole analysis.
  fs.writeFileSync(rawPath, JSON.stringify(manifest));
  console.log(`Updated ${rawPath} with ranks/clusters/duplicate status (still gitignored).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
