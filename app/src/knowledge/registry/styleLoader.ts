import type { StyleDna } from '../../engine/styleDna';
import { validateStyleRecord, type StyleValidationIssue } from './styleSchema';

// Build 008A, Section 5 (Knowledge Loader) — the pure loading/validation
// logic, kept independent of `KnowledgeRegistry`'s caching/diagnostics
// wrapper (Section 2) so it's directly unit-testable with deliberately
// broken input (missing fields, duplicate ids) without needing to corrupt
// the real data files. `KnowledgeRegistry` calls this once and caches the
// result; nothing else should call it directly.

export interface StyleLoadIssue {
  /** The record's own `id`, or `'(unknown)'` if the record didn't even
   * have a valid id to report. */
  recordId: string;
  issues: StyleValidationIssue[];
}

export interface StyleLoadResult {
  /** Only present when every record passed validation and no duplicate
   * ids were found — a partial/invalid load never returns a partial map,
   * matching Section 6's "reject" requirement (bad data doesn't silently
   * become "some styles missing"; the whole load fails loudly). */
  styles: Map<string, StyleDna> | null;
  issues: StyleLoadIssue[];
}

/** Loads and validates a raw array of style records (typically imported
 * JSON module objects). Rejects (returns `styles: null` with a populated
 * `issues` list) on: any record failing schema validation, or a duplicate
 * `id` across records. Never throws — callers decide whether a failed
 * load is fatal (`KnowledgeRegistry` treats it as fatal; a test can just
 * inspect `issues`). */
export function loadStyleRecords(rawRecords: unknown[]): StyleLoadResult {
  const issues: StyleLoadIssue[] = [];
  const styles = new Map<string, StyleDna>();

  for (const raw of rawRecords) {
    const result = validateStyleRecord(raw);
    const recordId = typeof (raw as Record<string, unknown>)?.id === 'string' ? ((raw as Record<string, unknown>).id as string) : '(unknown)';
    if (!result.valid) {
      issues.push({ recordId, issues: result.issues });
      continue;
    }
    const dna = raw as StyleDna;
    if (styles.has(dna.id)) {
      issues.push({ recordId: dna.id, issues: [{ field: 'id', message: `Duplicate style id "${dna.id}" — every style record must have a unique id.` }] });
      continue;
    }
    styles.set(dna.id, dna);
  }

  if (issues.length > 0) return { styles: null, issues };
  return { styles, issues: [] };
}

/** Formats a `StyleLoadResult`'s issues into one readable multi-line
 * string — used by `KnowledgeRegistry` to build its thrown error message
 * (Section 6: "Provide readable errors"). */
export function formatStyleLoadIssues(issues: StyleLoadIssue[]): string {
  return issues
    .map(({ recordId, issues: fieldIssues }) => `  [${recordId}] ` + fieldIssues.map((i) => `${i.field}: ${i.message}`).join('; '))
    .join('\n');
}
