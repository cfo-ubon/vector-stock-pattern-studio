// Build 026, Phase 9 — Bulk Status Import (CSV). No CSV *parser* exists
// anywhere in this codebase (`metadata/csv.ts` only builds/exports CSV
// text, never reads it back) — this module is new. Scope decision:
// spreadsheet import here means CSV only, not native .xlsx binary
// parsing — adding an XLSX-parsing dependency was weighed against simply
// asking the user to "Save As CSV" from Excel/Sheets (both do this in one
// click) and rejected as unnecessary dependency risk for a
// security-sensitive import path; `docs/IMPORT_EXISTING_PORTFOLIO.md`
// states this explicitly rather than silently under-delivering on
// "Excel" from the brief.

export const IMPORT_HISTORY_SCHEMA_VERSION = 1;

export type ImportableField =
  | 'productionAssetId'
  | 'marketplace'
  | 'marketplaceAssetId'
  | 'submittedDate'
  | 'reviewDate'
  | 'status'
  | 'rejectionReason'
  | 'downloads'
  | 'revenue'
  | 'currency'
  | 'notes';

export const IMPORTABLE_FIELDS: ImportableField[] = [
  'productionAssetId',
  'marketplace',
  'marketplaceAssetId',
  'submittedDate',
  'reviewDate',
  'status',
  'rejectionReason',
  'downloads',
  'revenue',
  'currency',
  'notes',
];

const REQUIRED_FIELDS: ImportableField[] = ['productionAssetId', 'marketplace'];

/** Minimal RFC4180-ish CSV parser: handles quoted fields (with embedded
 * commas, newlines, and escaped `""`), CRLF/LF line endings, and a header
 * row. No dependency — this codebase's own established convention (see
 * `metadata/csv.ts`'s hand-rolled builder, `export/zip.ts`'s hand-rolled
 * ZIP writer). Not a general-purpose CSV library; sufficient for the
 * bulk-import templates this module itself produces and for a plain
 * Excel/Sheets "Save As CSV" export. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  while (i < normalized.length) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Security: neutralizes spreadsheet formula-injection payloads
 * (cells beginning with `=`, `+`, `-`, `@`, or a tab/CR that Excel/Sheets
 * would interpret as a formula trigger when the value is later re-opened
 * in a spreadsheet) by prefixing a single quote — the same mitigation
 * OWASP's CSV injection guidance recommends. Applied to every imported
 * text field before it is ever stored or re-exported, never left to a
 * downstream consumer to remember to do. */
export function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}

export interface ColumnMapping {
  [csvColumnIndex: number]: ImportableField | null;
}

export interface MappedImportRow {
  rowIndex: number;
  productionAssetId: string;
  marketplace: string;
  marketplaceAssetId: string | null;
  submittedDate: number | null;
  reviewDate: number | null;
  status: string | null;
  rejectionReason: string | null;
  downloads: number | null;
  revenue: number | null;
  currency: string | null;
  notes: string | null;
}

export interface ImportRowError {
  rowIndex: number;
  message: string;
}

export interface ImportPreview {
  rows: MappedImportRow[];
  errors: ImportRowError[];
  /** Row indices that duplicate an earlier row in the SAME file (same
   * productionAssetId + marketplace) — flagged, never silently merged;
   * the caller decides whether to keep the first, last, or reject. */
  duplicateRowIndices: number[];
}

function parseDate(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value.replace(/[, ]/g, ''));
  return Number.isNaN(n) ? null : n;
}

/** Maps raw CSV rows (data rows only, no header) through a column mapping
 * into typed, sanitized `MappedImportRow`s — validating required fields
 * and collecting per-row errors rather than throwing on the first bad row
 * (the brief's "error report", "partial-import prevention unless user
 * explicitly confirms"). Every text field is passed through
 * `sanitizeCsvCell` before being placed on the mapped row. */
export function previewImport(dataRows: string[][], mapping: ColumnMapping): ImportPreview {
  const rows: MappedImportRow[] = [];
  const errors: ImportRowError[] = [];
  const seen = new Map<string, number>();
  const duplicateRowIndices: number[] = [];

  dataRows.forEach((raw, rowIndex) => {
    const get = (field: ImportableField): string => {
      const colIndex = Object.entries(mapping).find(([, f]) => f === field)?.[0];
      if (colIndex === undefined) return '';
      return sanitizeCsvCell((raw[Number(colIndex)] ?? '').trim());
    };

    const productionAssetId = get('productionAssetId');
    const marketplace = get('marketplace');

    const missing = REQUIRED_FIELDS.filter((f) => !get(f));
    if (missing.length > 0) {
      errors.push({ rowIndex, message: `Missing required field(s): ${missing.join(', ')}.` });
      return;
    }

    const key = `${productionAssetId}::${marketplace}`;
    if (seen.has(key)) {
      duplicateRowIndices.push(rowIndex);
    } else {
      seen.set(key, rowIndex);
    }

    rows.push({
      rowIndex,
      productionAssetId,
      marketplace,
      marketplaceAssetId: get('marketplaceAssetId') || null,
      submittedDate: parseDate(get('submittedDate')),
      reviewDate: parseDate(get('reviewDate')),
      status: get('status') || null,
      rejectionReason: get('rejectionReason') || null,
      downloads: parseNumber(get('downloads')),
      revenue: parseNumber(get('revenue')),
      currency: get('currency') || null,
      notes: get('notes') || null,
    });
  });

  return { rows, errors, duplicateRowIndices };
}

/** The downloadable import template — a header row naming every
 * importable field, in the brief's own field order. */
export function buildImportTemplateCsv(): string {
  return IMPORTABLE_FIELDS.join(',') + '\n';
}

/** Attempts to auto-map CSV header names to `ImportableField`s by exact
 * (case-insensitive) match — a starting point for a UI's column-mapping
 * step, never assumed correct without user confirmation. Unmatched
 * columns map to `null` (ignored). */
export function autoDetectColumnMapping(headerRow: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  headerRow.forEach((header, index) => {
    const normalized = header.trim().toLowerCase();
    const match = IMPORTABLE_FIELDS.find((f) => f.toLowerCase() === normalized);
    mapping[index] = match ?? null;
  });
  return mapping;
}
