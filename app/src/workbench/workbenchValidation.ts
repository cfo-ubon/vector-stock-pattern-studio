import type { DesignSpecification } from '../trend/designSpecTypes';
import { validateDesignSpecification } from '../trend/designSpecValidation';
import { validateDesignSpecificationData } from '../validators';
import { validateDesignSpecificationRelationships } from '../validators/relationshipValidator';

// Design Workbench Section 4 ("Validation Panel") — this module does not
// implement any validation logic itself; it only calls the three
// validators that already exist and merges + categorizes their results
// for display:
//   - trend/designSpecValidation.ts's validateDesignSpecification()   — the
//     shipped Design Intelligence Engine's own semantic checks (real
//     category/layout/palette/marketplace ids, 0..1 ranges).
//   - validators/index.ts's validateDesignSpecificationData()         — the
//     Design Intelligence Core's JSON Schema structural validator
//     (Section 4's "JSON validation").
//   - validators/relationshipValidator.ts's
//     validateDesignSpecificationRelationships()                     — the
//     Design Intelligence Core's cross-library + marketplace-
//     compatibility checks (Section 4's "Marketplace compatibility").
// The only genuinely new logic here is "missing values" / "duplicate
// values" / "suggestions" — heuristics no existing validator covers,
// which is exactly what a workbench (not an engine) should own.

export type WorkbenchIssueSeverity = 'error' | 'warning' | 'suggestion';

export type WorkbenchIssueCategory = 'schema' | 'relationship' | 'marketplace' | 'semantic' | 'missing' | 'duplicate' | 'suggestion';

export interface WorkbenchValidationIssue {
  path: string;
  message: string;
  severity: WorkbenchIssueSeverity;
  category: WorkbenchIssueCategory;
}

export interface WorkbenchValidationResult {
  issues: WorkbenchValidationIssue[];
  errors: WorkbenchValidationIssue[];
  warnings: WorkbenchValidationIssue[];
  suggestions: WorkbenchValidationIssue[];
  marketplaceIssues: WorkbenchValidationIssue[];
  isValid: boolean;
}

function dedupe(issues: WorkbenchValidationIssue[]): WorkbenchValidationIssue[] {
  const seen = new Set<string>();
  const result: WorkbenchValidationIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.path}::${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(issue);
  }
  return result;
}

function isMarketplacePath(path: string): boolean {
  return path.startsWith('$.marketplace') || path.startsWith('$.exportHints');
}

function findMissingValueIssues(spec: DesignSpecification): WorkbenchValidationIssue[] {
  const issues: WorkbenchValidationIssue[] = [];
  const checks: Array<[string, string | undefined]> = [
    ['$.project.name', spec.project.name],
    ['$.keywordBundle.primaryKeyword', spec.keywordBundle.primaryKeyword],
    ['$.keywordBundle.audience', spec.keywordBundle.audience],
    ['$.keywordBundle.commercialCategory', spec.keywordBundle.commercialCategory],
    ['$.seoHints.primaryKeyword', spec.seoHints.primaryKeyword],
    ['$.seoHints.audience', spec.seoHints.audience],
  ];
  for (const [path, value] of checks) {
    if (!value || value.trim().length === 0) {
      issues.push({ path, message: 'Value is empty', severity: 'warning', category: 'missing' });
    }
  }
  if (spec.heroMotifs.length === 0) {
    issues.push({ path: '$.heroMotifs', message: 'No hero motif set — the composition has no focal point', severity: 'warning', category: 'missing' });
  }
  return issues;
}

function findDuplicateValueIssues(spec: DesignSpecification): WorkbenchValidationIssue[] {
  const issues: WorkbenchValidationIssue[] = [];

  const seenKeyword = new Map<string, number>();
  const allKeywords = [spec.keywordBundle.primaryKeyword, ...spec.keywordBundle.secondaryKeywords].map((k) => k.trim().toLowerCase()).filter(Boolean);
  for (const keyword of allKeywords) {
    seenKeyword.set(keyword, (seenKeyword.get(keyword) ?? 0) + 1);
  }
  for (const [keyword, count] of seenKeyword) {
    if (count > 1) {
      issues.push({ path: '$.keywordBundle', message: `Keyword "${keyword}" appears ${count} times`, severity: 'warning', category: 'duplicate' });
    }
  }

  const motifLists: Array<['heroMotifs' | 'secondaryMotifs' | 'fillers', typeof spec.heroMotifs]> = [
    ['heroMotifs', spec.heroMotifs],
    ['secondaryMotifs', spec.secondaryMotifs],
    ['fillers', spec.fillers],
  ];
  const seenMotif = new Map<string, string>();
  for (const [listName, refs] of motifLists) {
    for (const ref of refs) {
      const key = `${ref.categoryId}::${ref.role}`;
      const existingList = seenMotif.get(key);
      if (existingList) {
        issues.push({
          path: `$.${listName}`,
          message: `"${ref.categoryId}" is already used with role "${ref.role}" in ${existingList}`,
          severity: 'warning',
          category: 'duplicate',
        });
      } else {
        seenMotif.set(key, listName);
      }
    }
  }

  return issues;
}

function findSuggestions(spec: DesignSpecification): WorkbenchValidationIssue[] {
  const issues: WorkbenchValidationIssue[] = [];
  if (!spec.trend) {
    issues.push({
      path: '$.trend',
      message: 'No Trend Pack attached — attach one for stronger market alignment and SEO copy',
      severity: 'suggestion',
      category: 'suggestion',
    });
  }
  if (spec.secondaryMotifs.length === 0 && spec.fillers.length === 0) {
    issues.push({
      path: '$.secondaryMotifs',
      message: 'Only hero motifs are set — add secondary/filler motifs for a richer composition',
      severity: 'suggestion',
      category: 'suggestion',
    });
  }
  if (spec.exportHints.collectionSize > 20) {
    issues.push({
      path: '$.exportHints.collectionSize',
      message: `Collection size ${spec.exportHints.collectionSize} is large — run the Quality Loop before generating`,
      severity: 'suggestion',
      category: 'suggestion',
    });
  }
  return issues;
}

/** Runs every existing validator against `spec` plus the workbench-only
 * missing/duplicate/suggestion heuristics, merges and dedupes the result,
 * and buckets it for the Validation Panel. */
export function validateDesignSpecForWorkbench(spec: DesignSpecification): WorkbenchValidationResult {
  const semantic = validateDesignSpecification(spec).map(
    (issue): WorkbenchValidationIssue => ({ path: `$.${issue.path}`, message: issue.message, severity: issue.severity, category: 'semantic' }),
  );

  const schema = validateDesignSpecificationData(spec).map(
    (issue): WorkbenchValidationIssue => ({ path: issue.path, message: issue.message, severity: 'error', category: 'schema' }),
  );

  const relationships = validateDesignSpecificationRelationships(spec).map(
    (issue): WorkbenchValidationIssue => ({
      path: issue.path,
      message: issue.message,
      severity: 'error',
      category: isMarketplacePath(issue.path) ? 'marketplace' : 'relationship',
    }),
  );

  const issues = dedupe([...schema, ...relationships, ...semantic, ...findMissingValueIssues(spec), ...findDuplicateValueIssues(spec), ...findSuggestions(spec)]);

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const suggestions = issues.filter((i) => i.severity === 'suggestion');
  const marketplaceIssues = issues.filter((i) => i.category === 'marketplace');

  return { issues, errors, warnings, suggestions, marketplaceIssues, isValid: errors.length === 0 };
}
