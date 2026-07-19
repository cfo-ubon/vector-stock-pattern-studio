import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Portfolio Phase 1B — Human Visual Review Preparation. NOT a new build:
// no generator, scoring, or production-pipeline code is imported or
// touched, and no pattern is regenerated. This script only reads Phase 1's
// already-committed-to-disk output (`portfolio_phase_1/quality_review.csv`,
// `portfolio_phase_1/portfolio_manifest.csv`, and the 100 PNG previews
// Phase 1 already rendered) and repackages it for a human reviewer:
// HTML contact sheets (same `<figure class="cell"><figcaption>` grid
// convention `scripts/portfolioVisuals.ts`'s own contact sheet already
// established, PNG `<img>` instead of inline SVG per this brief's "PNG
// previews only" requirement), a blank human-fillable checklist CSV, a
// short guide, and per-collection/per-classification ZIPs sized to stay
// under this session's file-transfer limit.

function __dirnameFromUrl(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

interface QualityRow {
  filename: string;
  collection: string;
  classification: string;
  overallScore: string;
}

// Minimal parser matching the exact escaping scheme this repo's own CSV
// writers (`metadata/csv.ts`, `scripts/portfolioPhase1.ts`) use: a field is
// quote-wrapped only if it contains a comma/quote/newline, with internal
// quotes doubled — never a full RFC4180 grammar, just its own inverse.
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split('\r\n').filter((l) => l.length > 0);
  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let i = 0;
    while (i <= line.length) {
      if (line[i] === '"') {
        let j = i + 1;
        let value = '';
        while (j < line.length) {
          if (line[j] === '"' && line[j + 1] === '"') {
            value += '"';
            j += 2;
          } else if (line[j] === '"') {
            j++;
            break;
          } else {
            value += line[j];
            j++;
          }
        }
        fields.push(value);
        i = j + 1; // skip comma
      } else {
        const next = line.indexOf(',', i);
        if (next === -1) {
          fields.push(line.slice(i));
          i = line.length + 1;
        } else {
          fields.push(line.slice(i, next));
          i = next + 1;
        }
      }
    }
    return fields;
  };
  const header = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => (row[h] = values[idx] ?? ''));
    return row;
  });
}

function esc(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(fields: string[]): string {
  return fields.map(esc).join(',') + '\r\n';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildContactSheetHtml(title: string, note: string, rows: QualityRow[]): string {
  const cells = rows
    .map((r) => {
      const score = Math.round(Number(r.overallScore));
      return `<figure class="cell">
        <img src="../previews/${escapeHtml(r.filename)}.png" alt="${escapeHtml(r.filename)}" loading="lazy" />
        <figcaption><strong>${escapeHtml(r.filename)}</strong><br>${escapeHtml(r.classification)} &middot; score ${score}</figcaption>
      </figure>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    body { margin: 0; padding: 24px; background: #f4f4f4; font-family: system-ui, sans-serif; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    p.note { font-size: 12px; color: #555; margin: 0 0 20px; max-width: 900px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    .cell { margin: 0; background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 8px; text-align: center; }
    .cell img { width: 100%; height: auto; display: block; border-radius: 4px; }
    figcaption { font-size: 11px; color: #333; margin-top: 6px; line-height: 1.4; word-break: break-word; }
  </style></head><body>
    <h1>${escapeHtml(title)}</h1>
    <p class="note">${escapeHtml(note)} (${rows.length} patterns)</p>
    <div class="grid">${cells}</div>
  </body></html>`;
}

// Hand-rolled STORE-method ZIP writer — deliberately re-implemented here
// rather than importing `app/src/export/zip.ts` (that module is part of
// the app's own source tree and this script is presentation/packaging
// tooling over Phase 1's already-finished output, not a pipeline
// consumer); the algorithm itself (CRC32 + local/central directory
// records, no compression) is standard ZIP mechanics, not new business
// logic.
interface ZipEntry {
  name: string;
  data: Buffer;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function buildZip(files: ZipEntry[]): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const { time, date } = dosDateTime(new Date());

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf-8');
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, f.data);

    const centralEntry = Buffer.alloc(46);
    centralEntry.writeUInt32LE(0x02014b50, 0);
    centralEntry.writeUInt16LE(20, 4);
    centralEntry.writeUInt16LE(20, 6);
    centralEntry.writeUInt16LE(0, 8);
    centralEntry.writeUInt16LE(0, 10);
    centralEntry.writeUInt16LE(time, 12);
    centralEntry.writeUInt16LE(date, 14);
    centralEntry.writeUInt32LE(crc, 16);
    centralEntry.writeUInt32LE(f.data.length, 20);
    centralEntry.writeUInt32LE(f.data.length, 24);
    centralEntry.writeUInt16LE(nameBuf.length, 28);
    centralEntry.writeUInt16LE(0, 30);
    centralEntry.writeUInt16LE(0, 32);
    centralEntry.writeUInt16LE(0, 34);
    centralEntry.writeUInt16LE(0, 36);
    centralEntry.writeUInt32LE(0, 38);
    centralEntry.writeUInt32LE(offset, 42);
    central.push(centralEntry, nameBuf);

    offset += local.length + nameBuf.length + f.data.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBuf, end]);
}

const COLLECTION_DIRS: Array<{ dir: string; label: string }> = [
  { dir: '01_premium_botanical_floral', label: 'Premium Botanical Floral' },
  { dir: '02_tropical_leaves', label: 'Tropical Leaves' },
  { dir: '03_wildflower_meadow', label: 'Wildflower Meadow' },
  { dir: '04_scandinavian_floral', label: 'Scandinavian Floral' },
  { dir: '05_vintage_garden', label: 'Vintage Garden' },
  { dir: '06_minimal_botanical', label: 'Minimal Botanical' },
  { dir: '07_luxury_wedding_floral', label: 'Luxury Wedding Floral' },
  { dir: '08_boho_botanical', label: 'Boho Botanical' },
  { dir: '09_autumn_botanical', label: 'Autumn Botanical' },
  { dir: '10_christmas_botanical', label: 'Christmas Botanical' },
];

function main() {
  const __dirname = __dirnameFromUrl();
  const repoRoot = path.join(__dirname, '..', '..');
  const phase1Dir = path.join(repoRoot, 'portfolio_phase_1');
  const outDir = path.join(repoRoot, 'portfolio_phase_1b_review');
  const previewsDir = path.join(outDir, 'previews');
  const sheetsDir = path.join(outDir, 'contact_sheets');
  fs.mkdirSync(previewsDir, { recursive: true });
  fs.mkdirSync(sheetsDir, { recursive: true });

  const qualityRows = parseCsv(fs.readFileSync(path.join(phase1Dir, 'quality_review.csv'), 'utf-8')) as unknown as QualityRow[];

  // Locate each pattern's source PNG (Phase 1's own per-collection dirs)
  // and copy it into the review package's flat `previews/` folder.
  const missingPreviews: string[] = [];
  let copiedCount = 0;
  const dirByCollection = new Map(COLLECTION_DIRS.map((c) => [c.label, c.dir]));

  for (const row of qualityRows) {
    const dir = dirByCollection.get(row.collection);
    const srcPath = dir ? path.join(phase1Dir, dir, `${row.filename}.png`) : undefined;
    if (!srcPath || !fs.existsSync(srcPath)) {
      missingPreviews.push(row.filename);
      continue;
    }
    fs.copyFileSync(srcPath, path.join(previewsDir, `${row.filename}.png`));
    copiedCount++;
  }

  // Task 1 — one contact sheet per collection.
  for (const c of COLLECTION_DIRS) {
    const rows = qualityRows.filter((r) => r.collection === c.label);
    const html = buildContactSheetHtml(
      `Portfolio Phase 1 — ${c.label}`,
      'Contact sheet for human visual review. Each cell shows the pattern ID, its Phase 1 classification, and its commercial score.',
      rows,
    );
    fs.writeFileSync(path.join(sheetsDir, `${c.dir}_contact_sheet.html`), html);
  }

  // Task 2 — three grouped contact sheets by classification.
  for (const cls of ['READY', 'REVIEW', 'REJECT'] as const) {
    const rows = qualityRows.filter((r) => r.classification === cls);
    const html = buildContactSheetHtml(
      `Portfolio Phase 1 — All ${cls} Patterns`,
      `Every pattern Phase 1 classified as ${cls}, across all 10 collections.`,
      rows,
    );
    fs.writeFileSync(path.join(sheetsDir, `${cls}_contact_sheet.html`), html);
  }

  // Task 3 — human review checklist. Only the four Phase 1-derived
  // columns are pre-filled (pattern_id/collection/current_classification/
  // commercial_score); the eight assessment/decision columns are left
  // blank for the human reviewer to fill in during Phase 1B itself — the
  // full algorithmic sub-score breakdown these overlap with already
  // exists in Phase 1's own `quality_review.csv`, referenced in the guide.
  let checklistCsv = csvRow([
    'pattern_id', 'collection', 'current_classification', 'commercial_score',
    'visual_quality', 'seamless_quality', 'hero_visibility', 'composition', 'color_harmony', 'marketability',
    'human_decision', 'correction_notes',
  ]);
  for (const r of qualityRows) {
    checklistCsv += csvRow([r.filename, r.collection, r.classification, String(Math.round(Number(r.overallScore))), '', '', '', '', '', '', '', '']);
  }
  fs.writeFileSync(path.join(outDir, 'HUMAN_REVIEW_CHECKLIST.csv'), checklistCsv);

  // Task 4 — review guide.
  const guide = `# Phase 1B Review Guide

## What to inspect visually

For each pattern's PNG preview (or its cell in a contact sheet), check:

- **Seamless repeat**: does the tile edge read as continuous, or is there a
  visible seam/hard line where it repeats?
- **Hero visibility**: does the main motif read clearly at a glance, even
  at thumbnail size?
- **Composition**: is the layout balanced, or does it feel lopsided /
  empty in one area / overcrowded in another?
- **Color harmony**: do the palette colors work together, or does
  anything clash?
- **Botanical realism**: do the leaves/flowers read as natural botanical
  forms, not abstract or malformed shapes?
- **Marketability**: would you actually buy or license this for fabric,
  wallpaper, or stationery? This is your own commercial judgment call,
  independent of the system's own score.

Phase 1's own full algorithmic sub-scores (seamless repeat, hero
visibility, composition balance, botanical structure, color harmony, SVG
validity, export completeness, duplicate similarity) are in
\`portfolio_phase_1/quality_review.csv\` if you want to cross-reference them
— this checklist's six assessment columns are intentionally left blank for
your own independent visual judgment, not pre-filled with those numbers.

## How to mark APPROVE / FIX / REMOVE

Fill in \`human_decision\` in \`HUMAN_REVIEW_CHECKLIST.csv\` for every
pattern:

- **APPROVE** — ready to submit as-is, no changes needed.
- **FIX** — has commercial potential but needs a specific correction
  (describe it in \`correction_notes\`, e.g. "hero too small", "seam
  visible top edge", "palette too muted").
- **REMOVE** — not worth fixing; drop from the portfolio.

Fill \`correction_notes\` for every FIX (what to change) and, optionally,
for a REMOVE (why) or an APPROVE (anything worth flagging for next time).

## Which files belong to each pattern

- \`previews/<pattern_id>.png\` — the individual PNG preview for that
  pattern (2000x2000, the same file Phase 1 exported).
- \`contact_sheets/<NN>_<collection>_contact_sheet.html\` — the 10-pattern
  sheet for that pattern's collection.
- \`contact_sheets/READY_contact_sheet.html\` /
  \`REVIEW_contact_sheet.html\` / \`REJECT_contact_sheet.html\` — the same
  pattern grouped by Phase 1's classification instead of collection.
- \`HUMAN_REVIEW_CHECKLIST.csv\`, row where \`pattern_id\` matches the
  filename above — where you record your decision.

Full SVG/EPS source files are intentionally **not** included in this
review package (per the brief) — this package is for visual review only.
The complete production file set for every pattern is in
\`portfolio_phase_1/<collection>/\` if a pattern is approved and needs its
full export bundle.
`;
  fs.writeFileSync(path.join(outDir, 'PHASE_1B_REVIEW_GUIDE.md'), guide);

  // Task 6 — package into collection-sized / classification-sized ZIPs
  // (each contact sheet + its own previews), since the combined package
  // (~60MB) exceeds this session's single-file transfer limit.
  const zipsDir = path.join(outDir, 'zips');
  fs.mkdirSync(zipsDir, { recursive: true });
  const zipSizes: Array<{ name: string; bytes: number; patternCount: number }> = [];

  const buildPackageZip = (zipName: string, sheetFile: string, rows: QualityRow[]) => {
    const entries: ZipEntry[] = [];
    // The sheet's own HTML references images via `../previews/...`
    // (correct for this package's `contact_sheets/` + `previews/` sibling
    // layout, matching the un-zipped outDir structure) — so it must sit
    // one level deep inside the zip too, not at the zip root.
    entries.push({ name: `contact_sheets/contact_sheet.html`, data: fs.readFileSync(path.join(sheetsDir, sheetFile)) });
    for (const r of rows) {
      const p = path.join(previewsDir, `${r.filename}.png`);
      if (fs.existsSync(p)) entries.push({ name: `previews/${r.filename}.png`, data: fs.readFileSync(p) });
    }
    const buf = buildZip(entries);
    fs.writeFileSync(path.join(zipsDir, zipName), buf);
    zipSizes.push({ name: zipName, bytes: buf.length, patternCount: rows.length });
  };

  for (const c of COLLECTION_DIRS) {
    const rows = qualityRows.filter((r) => r.collection === c.label);
    buildPackageZip(`${c.dir}_review.zip`, `${c.dir}_contact_sheet.html`, rows);
  }
  for (const cls of ['READY', 'REVIEW', 'REJECT'] as const) {
    const rows = qualityRows.filter((r) => r.classification === cls);
    buildPackageZip(`${cls}_review.zip`, `${cls}_contact_sheet.html`, rows);
  }

  const summary = {
    totalPatterns: qualityRows.length,
    previewsIncluded: copiedCount,
    missingPreviews,
    contactSheetsCreated: COLLECTION_DIRS.length + 3,
    outputFolder: outDir,
    zips: zipSizes.map((z) => ({ ...z, megabytes: Math.round((z.bytes / 1e6) * 10) / 10 })),
  };
  fs.writeFileSync(path.join(outDir, 'phase1b_summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main();
