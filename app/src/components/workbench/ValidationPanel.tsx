import type { DesignSpecification } from '../../trend/designSpecTypes';
import { validateDesignSpecForWorkbench, type WorkbenchValidationIssue } from '../../workbench/workbenchValidation';

// Design Workbench Section 4 ("Validation Panel"). Every issue comes from
// `workbench/workbenchValidation.ts`, which itself only calls existing
// validators (trend/designSpecValidation.ts + validators/index.ts +
// validators/relationshipValidator.ts) — this component is purely
// presentational grouping/display.

interface Props {
  spec: DesignSpecification;
}

const CATEGORY_LABELS: Record<WorkbenchValidationIssue['category'], string> = {
  schema: 'JSON Validation',
  relationship: 'Relationships',
  marketplace: 'Marketplace Compatibility',
  semantic: 'Semantic Checks',
  missing: 'Missing Values',
  duplicate: 'Duplicate Values',
  suggestion: 'Suggestions',
};

const SEVERITY_ICON: Record<WorkbenchValidationIssue['severity'], string> = {
  error: '❌',
  warning: '⚠️',
  suggestion: '💡',
};

function IssueGroup({ title, issues }: { title: string; issues: WorkbenchValidationIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="workbench-validation-group">
      <h4>{title} ({issues.length})</h4>
      <ul className="marketplace-issues">
        {issues.map((issue, i) => (
          <li key={i} className={`marketplace-issue marketplace-issue--${issue.severity === 'suggestion' ? 'warning' : issue.severity}`}>
            {SEVERITY_ICON[issue.severity]} <code>{issue.path}</code>: {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ValidationPanel({ spec }: Props) {
  const result = validateDesignSpecForWorkbench(spec);

  const byCategory = (Object.keys(CATEGORY_LABELS) as Array<WorkbenchValidationIssue['category']>).map((category) => ({
    category,
    issues: result.issues.filter((i) => i.category === category),
  }));

  return (
    <div className="workbench-validation-panel">
      <div className={`marketplace-ready-indicator marketplace-ready-indicator--${result.isValid ? 'ready' : 'issues'}`}>
        {result.isValid
          ? '✅ Design Specification is valid'
          : `⚠️ ${result.errors.length} error${result.errors.length === 1 ? '' : 's'}, ${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`}
      </div>
      {result.issues.length === 0 && <p className="metadata-hint">No errors, warnings, or suggestions.</p>}
      {byCategory.map(({ category, issues }) => (
        <IssueGroup key={category} title={CATEGORY_LABELS[category]} issues={issues} />
      ))}
    </div>
  );
}
