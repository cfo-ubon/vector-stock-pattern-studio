import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AIDesignDirectorView } from './AIDesignDirectorView';
import { seedSampleMarketData } from '../../marketing/sampleData/seedSampleMarketData';
import { clearMarketSnapshots } from '../../marketing/storage/marketSnapshotStore';
import { clearMarketObservations } from '../../marketing/storage/marketObservationStore';
import { clearMarketKeywords } from '../../marketing/storage/marketKeywordStore';
import { clearMarketOpportunities } from '../../marketing/storage/marketOpportunityStore';
import { clearDailyMissions } from '../../marketing/storage/dailyMissionStore';
import { clearResearchSources } from '../../marketing/storage/researchSourceStore';
import { clearScoringProfiles } from '../../marketing/storage/scoringProfileStore';
import { clearCreativeBriefs } from '../../design-director/storage/creativeBriefStore';
import { clearCollectionPlans } from '../../design-director/storage/collectionPlanStore';
import { clearGeneratorHandoffs } from '../../design-director/storage/generatorHandoffStore';

async function clearAllStores() {
  await Promise.all([
    clearMarketSnapshots(),
    clearMarketObservations(),
    clearMarketKeywords(),
    clearMarketOpportunities(),
    clearDailyMissions(),
    clearResearchSources(),
    clearScoringProfiles(),
    clearCreativeBriefs(),
    clearCollectionPlans(),
    clearGeneratorHandoffs(),
  ]);
}

describe('AIDesignDirectorView', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await clearAllStores();
    await seedSampleMarketData();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('loads real Market Opportunities into the Creative Brief generator dropdown', async () => {
    render(<AIDesignDirectorView onClose={() => {}} onSendToGenerator={() => {}} />);
    await waitFor(() => expect(screen.getByText('Generate from an approved Market Opportunity')).toBeInTheDocument());
    const select = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    const realOptions = Array.from(select.options).filter((o) => o.value);
    expect(realOptions.length).toBeGreaterThan(0);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('generates a real, persisted Creative Brief from a selected opportunity and carries it through Planner/Roadmap/Completeness', async () => {
    render(<AIDesignDirectorView onClose={() => {}} onSendToGenerator={() => {}} />);
    await waitFor(() => expect(screen.getByText('Generate from an approved Market Opportunity')).toBeInTheDocument());

    const select = screen.getAllByRole('combobox')[0];
    const options = Array.from((select as HTMLSelectElement).options).filter((o) => o.value);
    expect(options.length).toBeGreaterThan(0);
    fireEvent.change(select, { target: { value: options[0].value } });
    fireEvent.click(screen.getByText('Generate Creative Brief'));

    await waitFor(() => expect(screen.getByText('Save Brief')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Collection Planner' }));
    await waitFor(() => expect(screen.getByText('Create Collection Plan')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Create Collection Plan'));
    await waitFor(() => expect(screen.getByText('Save Updated Plan')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Completeness' }));
    await waitFor(() => expect(screen.getByText(/%/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Roadmap' }));
    await waitFor(() => expect(screen.getByText(/Total estimated time/)).toBeInTheDocument());

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('marks the selected tab with aria-pressed', async () => {
    render(<AIDesignDirectorView onClose={() => {}} onSendToGenerator={() => {}} />);
    await waitFor(() => expect(screen.getByText('Generate from an approved Market Opportunity')).toBeInTheDocument());
    const briefTab = screen.getByRole('button', { name: 'Creative Brief' });
    expect(briefTab).toHaveAttribute('aria-pressed', 'true');
    const plannerTab = screen.getByRole('button', { name: 'Collection Planner' });
    fireEvent.click(plannerTab);
    expect(plannerTab).toHaveAttribute('aria-pressed', 'true');
    expect(briefTab).toHaveAttribute('aria-pressed', 'false');
  });

  it('the close button calls onClose', async () => {
    const onClose = vi.fn();
    render(<AIDesignDirectorView onClose={onClose} onSendToGenerator={() => {}} />);
    await waitFor(() => expect(screen.getByText('Generate from an approved Market Opportunity')).toBeInTheDocument());
    fireEvent.click(screen.getByText('← กลับ'));
    expect(onClose).toHaveBeenCalled();
  });

  it('Send to Pattern Generator: review screen shows provenance, excluding an unchecked ("locked") field keeps it out of the applied set', async () => {
    const onSendToGenerator = vi.fn();
    render(<AIDesignDirectorView onClose={() => {}} onSendToGenerator={onSendToGenerator} />);
    await waitFor(() => expect(screen.getByText('Generate from an approved Market Opportunity')).toBeInTheDocument());

    const select = screen.getAllByRole('combobox')[0];
    const options = Array.from((select as HTMLSelectElement).options).filter((o) => o.value);
    fireEvent.change(select, { target: { value: options[0].value } });
    fireEvent.click(screen.getByText('Generate Creative Brief'));
    await waitFor(() => expect(screen.getByText('Save Brief')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Collection Planner' }));
    await waitFor(() => expect(screen.getByText('Create Collection Plan')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Create Collection Plan'));
    await waitFor(() => expect(screen.getByText('Save Updated Plan')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Generator Handoff' }));
    await waitFor(() => expect(screen.getByText('Generate Handoff Configuration')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Generate Handoff Configuration'));
    await waitFor(() => expect(screen.getByText('ส่งไปยังตัวสร้างลวดลาย (Send to Pattern Generator)')).toBeInTheDocument());

    // Status indicators are visible before anything is sent.
    expect(screen.getByText('Ready for Generator')).toBeInTheDocument();
    expect(screen.getByText('Not Generated')).toBeInTheDocument();
    expect(screen.getByText('Not Yet Backed Up')).toBeInTheDocument();

    fireEvent.click(screen.getByText('ส่งไปยังตัวสร้างลวดลาย (Send to Pattern Generator)'));
    await waitFor(() => expect(screen.getByText('Review — Send to Pattern Generator')).toBeInTheDocument());

    // Every review row shows a real provenance label (never a raw internal key).
    expect(screen.getAllByText(/From Creative Brief|From Collection Plan|Generator Default/).length).toBeGreaterThan(0);

    // Lock the "Category" field by unchecking its Apply checkbox.
    const categoryCheckbox = screen.getByRole('checkbox', { name: 'Apply Category' });
    expect(categoryCheckbox).toBeChecked();
    fireEvent.click(categoryCheckbox);
    expect(categoryCheckbox).not.toBeChecked();

    fireEvent.click(screen.getByText('Apply to Generator'));

    expect(onSendToGenerator).toHaveBeenCalledTimes(1);
    const [, selectedFields] = onSendToGenerator.mock.calls[0];
    expect(selectedFields.some((f: { key: string }) => f.key === 'categoryId')).toBe(false);
    expect(selectedFields.some((f: { key: string }) => f.key === 'density')).toBe(true);

    // The review screen closes after confirming.
    await waitFor(() => expect(screen.queryByText('Review — Send to Pattern Generator')).not.toBeInTheDocument());
    // Generation status now reflects the real, just-happened event.
    await waitFor(() => expect(screen.getByText(/Generated — last sent/)).toBeInTheDocument());

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
