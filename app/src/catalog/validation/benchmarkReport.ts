import type { BenchmarkReport } from './benchmarkRunner';
import type { DatasetManifest } from './types';

// Portfolio Manager P2.5 Sprint 1 — report formatting (Section 6).
// Pure string-building only; no filesystem access here (the CLI script
// decides where reports get written).

export interface FullValidationReport {
  generatedAt: number;
  gitCommit: string | null;
  branch: string | null;
  manifest: DatasetManifest | null;
  benchmarks: BenchmarkReport;
  warnings: string[];
  failures: string[];
}

export function toJsonReport(report: FullValidationReport): string {
  return JSON.stringify(report, null, 2);
}

function fmtMs(value: number | null): string {
  return value === null ? 'n/a' : `${value.toFixed(2)}ms`;
}

export function toConsoleSummary(report: FullValidationReport): string {
  const lines: string[] = [];
  lines.push('=== Portfolio Manager Collection Validation — Summary ===');
  lines.push(`Generated: ${new Date(report.generatedAt).toISOString()}`);
  if (report.gitCommit) lines.push(`Commit: ${report.gitCommit}${report.branch ? ` (${report.branch})` : ''}`);
  lines.push(`Environment: ${report.benchmarks.environment.nodeVersion} | ${report.benchmarks.environment.platform}/${report.benchmarks.environment.arch} | ${report.benchmarks.environment.cpuModel ?? 'unknown-cpu'}`);
  if (report.manifest) {
    lines.push('');
    lines.push(`Dataset: ${report.manifest.preset} (seed "${report.manifest.seed}")`);
    lines.push(`  assets=${report.manifest.assetCount} collections=${report.manifest.collectionCount} memberships=${report.manifest.membershipCount}`);
  }
  lines.push('');
  lines.push('Benchmarks:');
  for (const result of report.benchmarks.results) {
    const statusTag = result.status === 'success' ? 'OK' : result.status.toUpperCase();
    const statsStr = result.stats ? `median=${fmtMs(result.stats.medianMs)} mean=${fmtMs(result.stats.meanMs)} p95=${fmtMs(result.stats.p95Ms)}` : '(no samples)';
    lines.push(`  [${statusTag}] ${result.category}/${result.name} — ${statsStr}${result.error ? ` — ${result.error}` : ''}`);
  }
  if (report.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const w of report.warnings) lines.push(`  - ${w}`);
  }
  if (report.failures.length > 0) {
    lines.push('');
    lines.push('Failures:');
    for (const f of report.failures) lines.push(`  - ${f}`);
  }
  return lines.join('\n');
}

export function toMarkdownReport(report: FullValidationReport): string {
  const lines: string[] = [];
  lines.push('# Collection Validation Report');
  lines.push('');
  lines.push(`- Generated: ${new Date(report.generatedAt).toISOString()}`);
  if (report.gitCommit) lines.push(`- Commit: \`${report.gitCommit}\`${report.branch ? ` (branch \`${report.branch}\`)` : ''}`);
  lines.push(
    `- Environment: ${report.benchmarks.environment.nodeVersion} | ${report.benchmarks.environment.platform}/${report.benchmarks.environment.arch} | ${report.benchmarks.environment.cpuModel ?? 'unknown-cpu'} | ${report.benchmarks.environment.cpuCount ?? '?'} CPUs | ${report.benchmarks.environment.totalMemoryBytes ? `${(report.benchmarks.environment.totalMemoryBytes / 1e9).toFixed(1)}GB RAM` : 'RAM unknown'}`,
  );
  lines.push('');
  if (report.manifest) {
    const m = report.manifest;
    lines.push('## Dataset Manifest');
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('|---|---|');
    lines.push(`| preset | ${m.preset} |`);
    lines.push(`| seed | ${m.seed} |`);
    lines.push(`| assetCount | ${m.assetCount} |`);
    lines.push(`| collectionCount | ${m.collectionCount} |`);
    lines.push(`| activeCollectionCount | ${m.activeCollectionCount} |`);
    lines.push(`| archivedCollectionCount | ${m.archivedCollectionCount} |`);
    lines.push(`| emptyCollectionCount | ${m.emptyCollectionCount} |`);
    lines.push(`| membershipCount | ${m.membershipCount} |`);
    lines.push(`| averageMembershipsPerAsset | ${m.averageMembershipsPerAsset.toFixed(2)} |`);
    lines.push(`| maxMembershipsOnOneAsset | ${m.maxMembershipsOnOneAsset} |`);
    lines.push(`| coverCount | ${m.coverCount} |`);
    lines.push(`| staleCoverCount | ${m.staleCoverCount} |`);
    lines.push(`| orphanedMembershipCount | ${m.orphanedMembershipCount} |`);
    lines.push(`| duplicateCollectionIdAssetCount | ${m.duplicateCollectionIdAssetCount} |`);
    lines.push(`| generationDurationMs | ${m.generationDurationMs.toFixed(1)} |`);
    lines.push(`| databaseName | ${m.databaseName ?? '(in-memory only)'} |`);
    lines.push(`| estimatedLogicalSizeBytes | ${m.estimatedLogicalSizeBytes} |`);
    lines.push('');
  }
  lines.push('## Benchmarks');
  lines.push('');
  lines.push('| Category | Name | Status | Median | Mean | p95 | p99 | StdDev | Ops/sec |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const r of report.benchmarks.results) {
    const s = r.stats;
    lines.push(
      `| ${r.category} | ${r.name} | ${r.status} | ${fmtMs(s?.medianMs ?? null)} | ${fmtMs(s?.meanMs ?? null)} | ${fmtMs(s?.p95Ms ?? null)} | ${fmtMs(s?.p99Ms ?? null)} | ${fmtMs(s?.stdDevMs ?? null)} | ${s?.opsPerSec ? s.opsPerSec.toFixed(1) : 'n/a'} |`,
    );
  }
  lines.push('');
  if (report.warnings.length > 0) {
    lines.push('## Warnings');
    lines.push('');
    for (const w of report.warnings) lines.push(`- ${w}`);
    lines.push('');
  }
  if (report.failures.length > 0) {
    lines.push('## Failures');
    lines.push('');
    for (const f of report.failures) lines.push(`- ${f}`);
    lines.push('');
  }
  return lines.join('\n');
}
