// Build 025, Phase 13: Human Review Package. Builds 2 HTML contact sheets
// (by style, by decision) plus a CSV checklist and a Thai review guide over
// the 100-pattern production portfolio Phase 12 already generated
// (`reports/build_025/portfolio_100/`). Read-only over that manifest -- no
// new generation, no new scoring.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface PatternRecord {
  patternId: string;
  styleId: string;
  decision: 'READY' | 'REVIEW' | 'REJECT';
  productTarget: string | null;
  commercial: { absoluteCommercialQualityV2: number };
  beauty: { beautyScore: number; beautyFailureReasons: string[] };
  fragmentation: { fragmentedSilhouette: boolean; deadSpace: boolean };
  files: { png: string };
}

function cellHtml(p: PatternRecord, pngRelPath: string): string {
  const reasons = p.beauty.beautyFailureReasons.length ? p.beauty.beautyFailureReasons.map((r) => `<li>${r}</li>`).join('') : '<li>none</li>';
  return `<figure class="cell">
    <img src="${pngRelPath}" loading="lazy" width="180" height="180" />
    <figcaption>
      <strong>${p.patternId}</strong> — <span class="decision decision-${p.decision}">${p.decision}</span><br/>
      commercial ${p.commercial.absoluteCommercialQualityV2.toFixed(0)} · beauty ${p.beauty.beautyScore}<br/>
      frag=${p.fragmentation.fragmentedSilhouette} deadSpace=${p.fragmentation.deadSpace}
      <details><summary>issues</summary><ul>${reasons}</ul></details>
    </figcaption>
  </figure>`;
}

function pageHtml(title: string, groups: Array<{ heading: string; patterns: PatternRecord[] }>): string {
  const body = groups
    .map(
      (g) =>
        `<section><h2>${g.heading} (${g.patterns.length})</h2><div class="grid">${g.patterns
          .map((p) => cellHtml(p, `../portfolio_100/png/${p.patternId}.png`))
          .join('')}</div></section>`,
    )
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
    body { margin: 0; padding: 24px; background: #f4f4f4; font-family: system-ui, sans-serif; }
    h1 { font-size: 18px; } h2 { font-size: 15px; margin-top: 32px; }
    .grid { display: flex; flex-wrap: wrap; gap: 12px; }
    .cell { width: 200px; background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 8px; margin: 0; font-size: 11px; }
    .cell img { width: 180px; height: 180px; object-fit: cover; border-radius: 4px; }
    .decision-READY { color: #0a7a2f; font-weight: 600; }
    .decision-REVIEW { color: #b8860b; font-weight: 600; }
    .decision-REJECT { color: #b00020; font-weight: 600; }
    details summary { cursor: pointer; }
  </style></head><body><h1>${title}</h1>${body}</body></html>`;
}

function main() {
  const portfolioRoot = path.resolve(__dirname, '../../reports/build_025/portfolio_100');
  const outDir = path.resolve(__dirname, '../../reports/build_025/human_review');
  fs.mkdirSync(outDir, { recursive: true });

  const manifest = JSON.parse(fs.readFileSync(path.join(portfolioRoot, 'MANIFEST.json'), 'utf-8'));
  const patterns: PatternRecord[] = manifest.patterns;

  // By style
  const byStyle = new Map<string, PatternRecord[]>();
  for (const p of patterns) {
    if (!byStyle.has(p.styleId)) byStyle.set(p.styleId, []);
    byStyle.get(p.styleId)!.push(p);
  }
  fs.writeFileSync(
    path.join(outDir, 'contact_sheet_by_style.html'),
    pageHtml('Build 025 — Human Review: by Style', [...byStyle.entries()].map(([heading, ps]) => ({ heading, patterns: ps }))),
  );

  // By decision
  const byDecision = new Map<string, PatternRecord[]>();
  for (const p of patterns) {
    if (!byDecision.has(p.decision)) byDecision.set(p.decision, []);
    byDecision.get(p.decision)!.push(p);
  }
  const decisionOrder = ['REJECT', 'REVIEW', 'READY'];
  fs.writeFileSync(
    path.join(outDir, 'contact_sheet_by_decision.html'),
    pageHtml(
      'Build 025 — Human Review: by Decision',
      decisionOrder.filter((d) => byDecision.has(d)).map((heading) => ({ heading, patterns: byDecision.get(heading)! })),
    ),
  );

  // Checklist CSV
  const csvHeader = 'pattern_id,style_id,product_target,decision,commercial_v2,beauty_score,fragmented_silhouette,dead_space,reviewer_verdict,reviewer_notes';
  const csvRows = patterns.map((p) =>
    [p.patternId, p.styleId, p.productTarget ?? '', p.decision, p.commercial.absoluteCommercialQualityV2.toFixed(1), p.beauty.beautyScore, p.fragmentation.fragmentedSilhouette, p.fragmentation.deadSpace, '', ''].join(','),
  );
  fs.writeFileSync(path.join(outDir, 'HUMAN_REVIEW_CHECKLIST.csv'), [csvHeader, ...csvRows].join('\n') + '\n');

  console.log(`Wrote ${byStyle.size} style groups, ${byDecision.size} decision groups, ${patterns.length}-row checklist to ${outDir}`);
}

main();
