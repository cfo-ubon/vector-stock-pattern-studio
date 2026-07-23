import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  sanitizeCsvCell,
  previewImport,
  buildImportTemplateCsv,
  autoDetectColumnMapping,
  IMPORTABLE_FIELDS,
} from './marketplaceResultImport';
import type { ColumnMapping } from './marketplaceResultImport';

describe('parseCsv', () => {
  it('parses a simple comma-separated file', () => {
    const result = parseCsv('a,b,c\n1,2,3\n');
    expect(result).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields with embedded commas', () => {
    const result = parseCsv('name,note\n"Smith, John",hello\n');
    expect(result[1]).toEqual(['Smith, John', 'hello']);
  });

  it('handles escaped quotes inside quoted fields', () => {
    const result = parseCsv('a\n"He said ""hi"""\n');
    expect(result[1]).toEqual(['He said "hi"']);
  });

  it('handles embedded newlines inside quoted fields', () => {
    const result = parseCsv('a,b\n"line1\nline2",x\n');
    expect(result[1]).toEqual(['line1\nline2', 'x']);
  });

  it('handles CRLF line endings', () => {
    const result = parseCsv('a,b\r\n1,2\r\n');
    expect(result).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('ignores a trailing blank line', () => {
    const result = parseCsv('a,b\n1,2\n\n');
    expect(result).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('sanitizeCsvCell (formula injection protection)', () => {
  it('neutralizes a cell starting with =', () => {
    expect(sanitizeCsvCell('=HYPERLINK("http://evil.example","click")')).toBe("'=HYPERLINK(\"http://evil.example\",\"click\")");
  });

  it('neutralizes a cell starting with +', () => {
    expect(sanitizeCsvCell('+1+1')).toBe("'+1+1");
  });

  it('neutralizes a cell starting with -', () => {
    expect(sanitizeCsvCell('-2+3')).toBe("'-2+3");
  });

  it('neutralizes a cell starting with @', () => {
    expect(sanitizeCsvCell('@SUM(1,2)')).toBe("'@SUM(1,2)");
  });

  it('leaves an ordinary cell untouched', () => {
    expect(sanitizeCsvCell('Approved')).toBe('Approved');
  });

  it('leaves a negative-looking but benign numeric string alone from the CALLER perspective (still prefixed, since it starts with -, by design)', () => {
    // Documented, deliberate over-inclusion: a legitimate "-5" note also
    // gets the safety prefix. Correctness over convenience for a security
    // mitigation — see module doc comment.
    expect(sanitizeCsvCell('-5')).toBe("'-5");
  });
});

describe('previewImport', () => {
  const mapping: ColumnMapping = { 0: 'productionAssetId', 1: 'marketplace', 2: 'status', 3: 'downloads', 4: 'revenue' };

  it('maps valid rows correctly', () => {
    const rows = [['PAID-1', 'etsy', 'APPROVED', '5', '12.50']];
    const result = previewImport(rows, mapping);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ productionAssetId: 'PAID-1', marketplace: 'etsy', status: 'APPROVED', downloads: 5, revenue: 12.5 });
  });

  it('reports a per-row error for missing required fields, without throwing', () => {
    const rows = [['', 'etsy', 'APPROVED', '5', '12.50']];
    const result = previewImport(rows, mapping);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/productionAssetId/);
  });

  it('continues past a bad row to process the rest (no partial-import prevention needed for a preview)', () => {
    const rows = [
      ['', 'etsy', 'APPROVED', '5', '12.50'],
      ['PAID-2', 'shutterstock', 'REJECTED', '0', '0'],
    ];
    const result = previewImport(rows, mapping);
    expect(result.errors).toHaveLength(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].productionAssetId).toBe('PAID-2');
  });

  it('detects duplicate rows (same productionAssetId + marketplace) within the same file', () => {
    const rows = [
      ['PAID-1', 'etsy', 'APPROVED', '5', '12.50'],
      ['PAID-1', 'etsy', 'REJECTED', '0', '0'],
    ];
    const result = previewImport(rows, mapping);
    expect(result.duplicateRowIndices).toEqual([1]);
  });

  it('sanitizes formula-injection payloads in every mapped text field', () => {
    const rows = [['PAID-1', 'etsy', '=cmd|"/c calc"!A1', '5', '12.50']];
    const result = previewImport(rows, mapping);
    expect(result.rows[0].status?.startsWith("'")).toBe(true);
  });

  it('parses malformed numeric fields as null rather than throwing', () => {
    const rows = [['PAID-1', 'etsy', 'APPROVED', 'not-a-number', 'also-not']];
    const result = previewImport(rows, mapping);
    expect(result.rows[0].downloads).toBeNull();
    expect(result.rows[0].revenue).toBeNull();
  });
});

describe('buildImportTemplateCsv', () => {
  it('includes every importable field in the header', () => {
    const template = buildImportTemplateCsv();
    for (const field of IMPORTABLE_FIELDS) {
      expect(template).toContain(field);
    }
  });
});

describe('autoDetectColumnMapping', () => {
  it('matches header names case-insensitively', () => {
    const mapping = autoDetectColumnMapping(['ProductionAssetId', 'MARKETPLACE', 'unknown column']);
    expect(mapping[0]).toBe('productionAssetId');
    expect(mapping[1]).toBe('marketplace');
    expect(mapping[2]).toBeNull();
  });
});
