import type { BotanicalSpeciesRecord } from './speciesSchema';
import { validateSpeciesRecord, type SpeciesValidationIssue } from './speciesSchema';

// Build 008B, Section 1/6 — pure loading/validation for species records,
// mirroring `styleLoader.ts`'s exact shape (Build 008A) so both domains
// share one reviewable pattern.

export interface SpeciesLoadIssue {
  recordId: string;
  issues: SpeciesValidationIssue[];
}

export interface SpeciesLoadResult {
  species: Map<string, BotanicalSpeciesRecord> | null;
  issues: SpeciesLoadIssue[];
}

/** Loads and validates raw species records, computing each record's
 * `companionFamilies` (backward-compat flat list) from its real
 * `companions` matrix. Rejects the whole load — never a partial map — on
 * any record failing schema validation or a duplicate id. */
export function loadSpeciesRecords(rawRecords: unknown[]): SpeciesLoadResult {
  const issues: SpeciesLoadIssue[] = [];
  const species = new Map<string, BotanicalSpeciesRecord>();

  for (const raw of rawRecords) {
    const result = validateSpeciesRecord(raw);
    const recordId = typeof (raw as Record<string, unknown>)?.id === 'string' ? ((raw as Record<string, unknown>).id as string) : '(unknown)';
    if (!result.valid) {
      issues.push({ recordId, issues: result.issues });
      continue;
    }
    const base = raw as Omit<BotanicalSpeciesRecord, 'companionFamilies'>;
    if (species.has(base.id)) {
      issues.push({ recordId: base.id, issues: [{ field: 'id', message: `Duplicate species id "${base.id}" — every species record must have a unique id.` }] });
      continue;
    }
    const record: BotanicalSpeciesRecord = {
      ...base,
      companionFamilies: base.companions.map((c) => c.family),
    };
    species.set(record.id, record);
  }

  if (issues.length > 0) return { species: null, issues };
  return { species, issues: [] };
}

export function formatSpeciesLoadIssues(issues: SpeciesLoadIssue[]): string {
  return issues
    .map(({ recordId, issues: fieldIssues }) => `  [${recordId}] ` + fieldIssues.map((i) => `${i.field}: ${i.message}`).join('; '))
    .join('\n');
}
