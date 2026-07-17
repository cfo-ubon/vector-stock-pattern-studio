import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { evaluate, buildPortfolioParams, buildScenarioParams, STYLE_IDS, SCENARIO_SUITE, SCENARIO_SEEDS, XL_PORTFOLIO_SEEDS, stats } from './qualityReport';

// Build 014, Phase E (Commercial Validation). Re-scores 4 tiers (30-scenario
// suite, 100-pattern portfolio, 500-pattern XL portfolio, and the full
// 5,000-pattern portfolio using Build 013's own real seeds) with the
// *current* checked-out code. Run once with the Build 014 fix reverted
// (git stash) and once with it applied -- this script only ever computes
// "current code's numbers"; the caller runs it twice and diffs the two
// output files, exactly the way Build 013's own visual-validation pass
// used `git stash` to get a true pre/post comparison.
//
// Reuses `evaluate()`/`buildPortfolioParams()`/`buildScenarioParams()`
// unchanged.

const PORTFOLIO_SEEDS = ['p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-7'];
const OVERLAP_FAILURE_FLOOR = 25;

function __dirnameFromUrl(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

interface TileRow { label: string; styleDnaId?: string; layoutId: string; absoluteCommercialQuality: number; overlapQuality: number }

function runScenarioTier(): TileRow[] {
  const rows: TileRow[] = [];
  for (const { layoutId, categoryId } of SCENARIO_SUITE) {
    for (const seed of SCENARIO_SEEDS) {
      const params = buildScenarioParams(layoutId, categoryId, seed);
      const result = evaluate(`${layoutId}/${categoryId}@${seed}`, params);
      rows.push({ label: result.label, layoutId, absoluteCommercialQuality: result.absoluteCommercialQuality, overlapQuality: result.metrics.overlapQuality });
    }
  }
  return rows;
}

function runPortfolioTier(seeds: string[], cap: number): TileRow[] {
  const pairs: Array<{ styleId: string; seed: string }> = [];
  for (const styleId of STYLE_IDS) for (const seed of seeds) pairs.push({ styleId, seed });
  const kept = pairs.slice(0, cap);
  return kept.map(({ styleId, seed }) => {
    const params = buildPortfolioParams(styleId, seed);
    const result = evaluate(`${styleId}@${seed}`, params, styleId);
    return { label: result.label, styleDnaId: styleId, layoutId: result.layoutId, absoluteCommercialQuality: result.absoluteCommercialQuality, overlapQuality: result.metrics.overlapQuality };
  });
}

function run5000Tier(baselineRecords: Array<{ styleDnaId: string; seed: string }>): TileRow[] {
  return baselineRecords.map((p) => {
    const params = buildPortfolioParams(p.styleDnaId, p.seed);
    const result = evaluate(`${p.styleDnaId}@${p.seed}`, params, p.styleDnaId);
    return { label: `${p.styleDnaId}@${p.seed}`, styleDnaId: p.styleDnaId, layoutId: result.layoutId, absoluteCommercialQuality: result.absoluteCommercialQuality, overlapQuality: result.metrics.overlapQuality };
  });
}

function main() {
  const label = process.argv[2] ?? 'run';
  const __dirname = __dirnameFromUrl();
  const baselinesDir = path.resolve(__dirname, '../../docs/build_reports/baselines');
  const build013Raw = JSON.parse(fs.readFileSync(path.join(baselinesDir, 'BUILD_013_portfolio_raw.json'), 'utf-8'));

  const startedAt = Date.now();
  console.log(`[${label}] Tier 1: 30-scenario suite...`);
  const scenario = runScenarioTier();
  console.log(`[${label}] Tier 2: 100-pattern portfolio...`);
  const portfolio100 = runPortfolioTier(PORTFOLIO_SEEDS, 100);
  console.log(`[${label}] Tier 3: 500-pattern XL portfolio...`);
  const xl500 = runPortfolioTier(XL_PORTFOLIO_SEEDS, 500);
  console.log(`[${label}] Tier 4: 5,000-pattern portfolio (Build 013's real seeds)...`);
  const fiveK = run5000Tier(build013Raw.patterns.map((p: { styleDnaId: string; seed: string }) => ({ styleDnaId: p.styleDnaId, seed: p.seed })));
  const elapsedMs = Date.now() - startedAt;

  const overlapFailures = (rows: TileRow[]) => rows.filter((r) => r.overlapQuality <= OVERLAP_FAILURE_FLOOR).length;

  const report = {
    generatedAt: new Date().toISOString(),
    label,
    generationTimeMs: elapsedMs,
    scenario: { n: scenario.length, acq: stats(scenario.map((r) => r.absoluteCommercialQuality)), overlapFailures: overlapFailures(scenario) },
    portfolio100: { n: portfolio100.length, acq: stats(portfolio100.map((r) => r.absoluteCommercialQuality)), overlapFailures: overlapFailures(portfolio100) },
    xl500: { n: xl500.length, acq: stats(xl500.map((r) => r.absoluteCommercialQuality)), overlapFailures: overlapFailures(xl500) },
    fiveK: { n: fiveK.length, acq: stats(fiveK.map((r) => r.absoluteCommercialQuality)), overlapFailures: overlapFailures(fiveK) },
    rows: { scenario, portfolio100, xl500, fiveK },
  };

  const outPath = path.join(baselinesDir, `BUILD_014_regression_${label}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report));
  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
