import type { MarketingDesignHandoff } from '../../design-director/domain/marketingDesignHandoff';
import { getMarketingDesignHandoffWorkflowStatus } from '../../design-director/domain/marketingDesignHandoff';
import { WORKFLOW_STATUS_LABELS, WORKFLOW_STATUS_OWNER_MODULE } from '../../design-director/domain/workflowStatus';
import type { MarketOpportunity } from '../../marketing/domain/marketOpportunity';

interface Props {
  handoff: MarketingDesignHandoff | null;
  opportunity: MarketOpportunity | null;
  onViewSourceOpportunity?: (opportunityId: string) => void;
  backupProtected?: boolean;
  generatorReady?: boolean;
}

/** Build 028C, requirement #12 — shared workflow status indicators, shown
 * across every AI Creative Director tab that participates in the
 * Marketing -> Creative Director workflow (Creative Brief, Generator
 * Handoff). Reads `MarketingDesignHandoff.workflowHistory` (the one audit
 * trail spanning the whole workflow, see `domain/workflowStatus.ts`)
 * rather than recomputing status from scratch, so every tab shows exactly
 * the same real, persisted state. */
export function WorkflowStatusCard({ handoff, opportunity, onViewSourceOpportunity, backupProtected = false, generatorReady = false }: Props) {
  if (!handoff) return null;
  const status = getMarketingDesignHandoffWorkflowStatus(handoff);

  return (
    <dl className="marketing-handoff-status">
      <div>
        <dt>Source opportunity</dt>
        <dd>
          {opportunity ? (
            <button type="button" className="link-btn" onClick={() => onViewSourceOpportunity?.(opportunity.id)}>
              {opportunity.title} →
            </button>
          ) : (
            '—'
          )}
        </dd>
      </div>
      <div>
        <dt>Workflow status</dt>
        <dd>{status ? WORKFLOW_STATUS_LABELS[status] : '—'}</dd>
      </div>
      <div>
        <dt>Last updated</dt>
        <dd>{new Date(handoff.updatedAt).toLocaleString()}</dd>
      </div>
      <div>
        <dt>Current owner / module</dt>
        <dd>{status ? WORKFLOW_STATUS_OWNER_MODULE[status] : '—'}</dd>
      </div>
      <div>
        <dt>Unresolved fields</dt>
        <dd>{handoff.unresolvedFieldKeys.length > 0 ? handoff.unresolvedFieldKeys.join(', ') : 'None'}</dd>
      </div>
      <div>
        <dt>Backup status</dt>
        <dd>{backupProtected ? 'Backup Protected' : 'Not Yet Backed Up'}</dd>
      </div>
      <div>
        <dt>Generator readiness</dt>
        <dd>{generatorReady ? 'Ready for Generator' : 'Missing Configuration'}</dd>
      </div>
    </dl>
  );
}
