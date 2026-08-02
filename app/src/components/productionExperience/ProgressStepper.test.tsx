import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressStepper } from './ProgressStepper';
import { deriveProductionProgress } from '../../productionExperience/progressStages';
import { createOrchestrationRun, transitionOrchestrationRun } from '../../factoryOrchestrator/orchestrationRun';

const NOW = 1_700_000_000_000;

describe('ProgressStepper', () => {
  it('renders every real stage label with the current one marked aria-current', () => {
    const run = createOrchestrationRun(NOW);
    const progress = deriveProductionProgress(run, []);
    render(<ProgressStepper progress={progress} />);
    expect(screen.getByText('Preparing')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the real halted reason banner, never a fabricated one', () => {
    let run = createOrchestrationRun(NOW);
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 1);
    run = transitionOrchestrationRun(run, 'PREFLIGHT', NOW + 2);
    run = transitionOrchestrationRun(run, 'BLOCKED', NOW + 3, 'Export queue stuck.');
    const progress = deriveProductionProgress(run, []);
    render(<ProgressStepper progress={progress} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Export queue stuck.');
  });
});
