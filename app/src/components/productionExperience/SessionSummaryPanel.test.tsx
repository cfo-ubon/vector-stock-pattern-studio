import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionSummaryPanel } from './SessionSummaryPanel';
import type { ProductionCompletionReview } from '../../productionAutopilot/domain/types';

const REVIEW: ProductionCompletionReview = {
  batchId: 'B1',
  packagesProduced: 5,
  commercialReady: 4,
  review: 1,
  repair: 0,
  rejected: 0,
  businessOutcomeScore: 77.6,
  factoryEfficiency: 88.3,
  ownerTimeSavedMinutes: 30,
  improvementTasksCreated: 2,
  nextRecommendation: { action: 'PACKAGE', reason: 'Package the remaining ready items.', evidence: [], sourceTaskIds: [], decisionTrace: null },
  createdAt: 1000,
};

describe('SessionSummaryPanel', () => {
  it('renders every real field from the completion review', () => {
    render(<SessionSummaryPanel review={REVIEW} onDone={() => {}} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('30 min')).toBeInTheDocument();
    expect(screen.getByText('78')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/Package the remaining ready items\./)).toBeInTheDocument();
  });

  it('calls the real onDone handler when Done is clicked', () => {
    const onDone = vi.fn();
    render(<SessionSummaryPanel review={REVIEW} onDone={onDone} />);
    fireEvent.click(screen.getByText('Done'));
    expect(onDone).toHaveBeenCalled();
  });
});
