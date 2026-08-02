import type { ProductionProgress } from '../../productionExperience/progressStages';
import { PRODUCTION_PROGRESS_STAGE_LABELS } from '../../productionExperience/progressStages';

interface Props {
  progress: ProductionProgress;
}

const HALTED_LABEL: Record<NonNullable<ProductionProgress['haltedStatus']>, string> = {
  PAUSED: '⏸ Paused here',
  BLOCKED: '⚠ Blocked here',
  CANCELLED: '⛔ Cancelled',
  FAILED: '⚠ Failed',
};

export function ProgressStepper({ progress }: Props) {
  return (
    <div>
      <div className="pe-stepper" role="list" aria-label="Production progress">
        {progress.steps.map((step) => (
          <span
            key={step.stage}
            role="listitem"
            className={`pe-step${step.state === 'DONE' ? ' pe-step--done' : ''}${step.state === 'CURRENT' ? ' pe-step--current' : ''}`}
            aria-current={step.state === 'CURRENT' ? 'step' : undefined}
          >
            {PRODUCTION_PROGRESS_STAGE_LABELS[step.stage]}
          </span>
        ))}
      </div>
      {progress.haltedStatus && (
        <p className="pe-halted-banner" role="alert">
          {HALTED_LABEL[progress.haltedStatus]}
          {progress.haltedReason ? `: ${progress.haltedReason}` : ''}
        </p>
      )}
    </div>
  );
}
