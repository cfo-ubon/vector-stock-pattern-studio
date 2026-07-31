import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AutopilotHistoryView } from './AutopilotHistoryView';
import { clearAutonomousDesignRuns, putAutonomousDesignRun } from '../../autopilot/storage/autonomousDesignRunStore';
import { createAutonomousDesignRun, transitionAutonomousDesignRun } from '../../autopilot/domain/autonomousDesignRun';
import { emptyAutopilotConstraints } from '../../autopilot/domain/constraints';
import type { DesignPlan } from '../../autopilot/domain/designPlan';

function makePlan(): DesignPlan {
  return {
    summary: 'Test collection',
    decisions: [],
    marketEvidence: [],
    portfolioReason: '',
    targetMarketplace: 'Etsy',
    targetCustomer: 'Not Provided',
    targetProducts: [],
    collectionStructure: [],
    visualDirection: '',
    paletteDirection: '',
    estimatedProductionEffort: '',
    risks: [],
    confidence: 'high',
    dataFreshness: 'Live within this session',
    offline: false,
  };
}

async function seedRun() {
  let run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 5, constraints: emptyAutopilotConstraints(), now: 1000 });
  run = { ...run, designPlan: makePlan() };
  run = transitionAutonomousDesignRun(run, 'PLAN_READY', 1000);
  run = transitionAutonomousDesignRun(run, 'GENERATING', 1000);
  run = transitionAutonomousDesignRun(run, 'COMPLETED', 2000, '5/5 patterns generated');
  run = { ...run, completedCount: 5, readyCount: 3, reviewCount: 1, rejectCount: 1 };
  await putAutonomousDesignRun(run);
  return run;
}

beforeEach(async () => {
  await clearAutonomousDesignRuns();
});

describe('AutopilotHistoryView', () => {
  it('lists a real persisted run with its real fields, never a fabricated placeholder', async () => {
    await seedRun();
    render(<AutopilotHistoryView onResume={() => {}} onOpenCompleted={() => {}} onDuplicate={() => {}} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Test collection/)).toBeInTheDocument());
    expect(screen.getByText(/READY 3/)).toBeInTheDocument();
    expect(screen.getByText(/REVIEW 1/)).toBeInTheDocument();
    expect(screen.getByText(/REJECT 1/)).toBeInTheDocument();
  });

  it('shows "เปิด" for a COMPLETED run and calls onOpenCompleted with the real run', async () => {
    const run = await seedRun();
    let opened: typeof run | null = null;
    render(<AutopilotHistoryView onResume={() => {}} onOpenCompleted={(r) => (opened = r)} onDuplicate={() => {}} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('เปิด')).toBeInTheDocument());
    fireEvent.click(screen.getByText('เปิด'));
    expect(opened).not.toBeNull();
    expect((opened as unknown as typeof run).id).toBe(run.id);
  });

  it('archiving a run moves it out of the default (active) list into the archived tab', async () => {
    await seedRun();
    render(<AutopilotHistoryView onResume={() => {}} onOpenCompleted={() => {}} onDuplicate={() => {}} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Test collection/)).toBeInTheDocument());

    fireEvent.click(screen.getByText('เก็บถาวร'));
    await waitFor(() => expect(screen.queryByText(/Test collection/)).not.toBeInTheDocument());

    fireEvent.click(screen.getByText('เก็บถาวรแล้ว'));
    await waitFor(() => expect(screen.getByText(/Test collection/)).toBeInTheDocument());
  });

  it('shows an honest empty state when there is no history yet', async () => {
    render(<AutopilotHistoryView onResume={() => {}} onOpenCompleted={() => {}} onDuplicate={() => {}} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('ไม่มีประวัติการรัน')).toBeInTheDocument());
  });
});
