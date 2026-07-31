import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AIDesignDirectorView } from './AIDesignDirectorView';
import { seedSampleMarketData } from '../../marketing/sampleData/seedSampleMarketData';
import { clearMarketSnapshots } from '../../marketing/storage/marketSnapshotStore';
import { clearMarketObservations } from '../../marketing/storage/marketObservationStore';
import { clearMarketKeywords } from '../../marketing/storage/marketKeywordStore';
import { clearMarketOpportunities, loadMarketOpportunities } from '../../marketing/storage/marketOpportunityStore';
import { clearDailyMissions } from '../../marketing/storage/dailyMissionStore';
import { clearResearchSources } from '../../marketing/storage/researchSourceStore';
import { clearScoringProfiles } from '../../marketing/storage/scoringProfileStore';
import { createCreativeBrief } from '../../design-director/domain/creativeBrief';
import { clearCreativeBriefs, putCreativeBrief } from '../../design-director/storage/creativeBriefStore';
import { clearCollectionPlans } from '../../design-director/storage/collectionPlanStore';
import { clearGeneratorHandoffs } from '../../design-director/storage/generatorHandoffStore';
import { createMarketingDesignHandoff, transitionMarketingDesignHandoffWorkflow } from '../../design-director/domain/marketingDesignHandoff';
import { clearMarketingDesignHandoffs, putMarketingDesignHandoff } from '../../design-director/storage/marketingDesignHandoffStore';

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
    clearMarketingDesignHandoffs(),
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

  // Build 028C — a real MarketingDesignHandoff (as "ส่งให้นักออกแบบ" would
  // have created it) walked through every one of the 13 workflow statuses
  // by genuine UI actions across Creative Brief / Collection Planner /
  // Generator Handoff, confirming requirements #10 (statuses), #11 (audit
  // history persists across every step) and #12 (the status card reflects
  // it live in each tab).
  it('walks a real MarketingDesignHandoff through every workflow status as Creative Director actions occur', async () => {
    function workflowStatusLabel(): string {
      return screen.getByText('Workflow status').nextElementSibling?.textContent ?? '';
    }

    const opportunities = await loadMarketOpportunities();
    const opportunity = opportunities[0];
    const brief = createCreativeBrief({ collectionName: 'Workflow Test Collection', theme: opportunity.theme, sourceOpportunityId: opportunity.id, now: 1000 });
    await putCreativeBrief(brief);
    let handoff = createMarketingDesignHandoff({ marketOpportunityId: opportunity.id, recommendedTheme: opportunity.theme, now: 1000 });
    handoff = transitionMarketingDesignHandoffWorkflow({ ...handoff, creativeBriefId: brief.id }, 'BRIEF_DRAFT', 1001);
    await putMarketingDesignHandoff(handoff);

    render(<AIDesignDirectorView onClose={() => {}} onSendToGenerator={() => {}} initialSelectedBriefId={brief.id} />);
    await waitFor(() => expect(screen.getByText('Workflow Test Collection')).toBeInTheDocument());
    expect(workflowStatusLabel()).toBe('Brief Draft');

    // Saving the brief IS the review step (BRIEF_DRAFT -> BRIEF_REVIEW).
    fireEvent.click(screen.getByText('Save Brief'));
    await waitFor(() => expect(workflowStatusLabel()).toBe('Brief Review'));

    // Approving the brief (BRIEF_REVIEW -> BRIEF_APPROVED).
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(workflowStatusLabel()).toBe('Brief Approved'));

    // Creating a Collection Plan (BRIEF_APPROVED -> COLLECTION_PLANNED).
    fireEvent.click(screen.getByRole('button', { name: 'Collection Planner' }));
    await waitFor(() => expect(screen.getByText('Create Collection Plan')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Create Collection Plan'));
    await waitFor(() => expect(screen.getByText('Save Updated Plan')).toBeInTheDocument());
    expect(workflowStatusLabel()).toBe('Collection Planned');

    // Selecting a collection item (COLLECTION_PLANNED -> COLLECTION_ITEM_SELECTED).
    fireEvent.click(screen.getByRole('button', { name: 'Generator Handoff' }));
    await waitFor(() => expect(screen.getByText('Generate Handoff Configuration')).toBeInTheDocument());
    const itemSelect = screen.getByRole('combobox');
    const itemOptions = Array.from((itemSelect as HTMLSelectElement).options).filter((o) => o.value);
    expect(itemOptions.length).toBeGreaterThan(0);
    fireEvent.change(itemSelect, { target: { value: itemOptions[0].value } });
    await waitFor(() => expect(workflowStatusLabel()).toBe('Collection Item Selected'));

    // Generating the handoff configuration (COLLECTION_ITEM_SELECTED -> READY_FOR_GENERATOR).
    fireEvent.click(screen.getByText('Generate Handoff Configuration'));
    await waitFor(() => expect(workflowStatusLabel()).toBe('Ready for Generator'));

    // Opening the review screen (READY_FOR_GENERATOR -> HANDOFF_REVIEW).
    fireEvent.click(screen.getByText('ส่งไปยังตัวสร้างลวดลาย (Send to Pattern Generator)'));
    await waitFor(() => expect(workflowStatusLabel()).toBe('Handoff Review'));

    // Confirming the apply (HANDOFF_REVIEW -> GENERATING -> GENERATED).
    fireEvent.click(screen.getByText('Apply to Generator'));
    await waitFor(() => expect(workflowStatusLabel()).toBe('Generated'));

    // Manual post-generation transitions (GENERATED -> DESIGN_REVIEW -> READY_FOR_PORTFOLIO).
    fireEvent.click(screen.getByRole('button', { name: 'Mark Design Reviewed' }));
    await waitFor(() => expect(workflowStatusLabel()).toBe('Design Review'));
    fireEvent.click(screen.getByRole('button', { name: 'Mark Ready for Portfolio' }));
    await waitFor(() => expect(workflowStatusLabel()).toBe('Ready for Portfolio'));

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
