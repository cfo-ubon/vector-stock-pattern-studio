import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FactoryDashboardPanel } from './FactoryDashboardPanel';

describe('FactoryDashboardPanel', () => {
  it('renders every real passed-in value honestly, never recomputing its own numbers', () => {
    render(
      <FactoryDashboardPanel
        factoryStatus="Running smoothly."
        businessOutcomeScore={82.4}
        factoryEfficiency={91.2}
        ownerDecisionsToday={2}
        withinDailyDecisionTarget={true}
        ownerTimeSavedMinutes={45}
        commercialReadyCount={3}
        topRecommendationReason="Package the ready batch."
      />,
    );
    expect(screen.getByText('Running smoothly.')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/Package the ready batch\./)).toBeInTheDocument();
  });

  it('shows an honest em dash, never a fabricated 0, when a real score is null', () => {
    render(
      <FactoryDashboardPanel
        factoryStatus="No factory activity yet."
        businessOutcomeScore={null}
        factoryEfficiency={null}
        ownerDecisionsToday={0}
        withinDailyDecisionTarget={true}
        ownerTimeSavedMinutes={0}
        commercialReadyCount={0}
        topRecommendationReason={null}
      />,
    );
    expect(screen.getAllByText('—')).toHaveLength(2);
  });
});
