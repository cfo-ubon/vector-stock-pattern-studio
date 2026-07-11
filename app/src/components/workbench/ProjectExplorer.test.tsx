import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { defaultParams } from '../../engine/defaults';
import { generateCollection } from '../../collection/collectionGenerator';
import { createProject, addCollectionToProject } from '../../project/projectManager';
import { loadFavorites } from '../../workbench/workbenchFavorites';
import { TREND_PACK_LIST } from '../../trend/trendPacks';
import { ProjectExplorer } from './ProjectExplorer';

describe('ProjectExplorer: projects list', () => {
  it('lists every project by name and shows its collection count', () => {
    const project = createProject('Botanical Wallpaper Co');
    render(
      <ProjectExplorer
        projects={[project]}
        activeProjectId={null}
        onSwitchProject={vi.fn()}
        favorites={loadFavorites()}
        onApplyTrendPack={vi.fn()}
      />,
    );
    expect(screen.getByText('Botanical Wallpaper Co', { exact: false })).toBeInTheDocument();
  });

  it('clicking a project row calls onSwitchProject with its id', () => {
    const project = createProject('Click Target');
    const onSwitchProject = vi.fn();
    render(
      <ProjectExplorer projects={[project]} activeProjectId={null} onSwitchProject={onSwitchProject} favorites={loadFavorites()} onApplyTrendPack={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('Click Target', { exact: false }));
    expect(onSwitchProject).toHaveBeenCalledWith(project.id);
  });
});

describe('ProjectExplorer: collections', () => {
  it('selecting a project reveals its real generated collection and asset list', () => {
    const collection = generateCollection({ ...defaultParams(), seed: 'project-explorer-collection' });
    const project = addCollectionToProject(createProject('With Collections'), collection);
    render(
      <ProjectExplorer projects={[project]} activeProjectId={null} onSwitchProject={vi.fn()} favorites={loadFavorites()} onApplyTrendPack={vi.fn()} />,
    );

    fireEvent.click(screen.getByText('With Collections', { exact: false }));
    expect(screen.getByText(project.collections[0].collection.manifest.collectionName, { exact: false })).toBeInTheDocument();
  });
});

describe('ProjectExplorer: trend packs and drag-and-drop', () => {
  it('lists real Trend Packs from the registry', () => {
    render(<ProjectExplorer projects={[]} activeProjectId={null} onSwitchProject={vi.fn()} favorites={loadFavorites()} onApplyTrendPack={vi.fn()} />);
    fireEvent.click(screen.getByText(/📈 Trend Packs/));
    expect(screen.getByText(TREND_PACK_LIST[0].label, { exact: false })).toBeInTheDocument();
  });

  it('dropping a dragged Trend Pack id onto the drop zone calls onApplyTrendPack with that pack', () => {
    const onApplyTrendPack = vi.fn();
    const { container } = render(
      <ProjectExplorer projects={[]} activeProjectId={null} onSwitchProject={vi.fn()} favorites={loadFavorites()} onApplyTrendPack={onApplyTrendPack} />,
    );
    const dropZone = within(container).getByText(/Drag a Trend Pack here/);
    const pack = TREND_PACK_LIST[0];
    const dataTransfer = { getData: (type: string) => (type === 'application/x-trendpack-id' ? pack.id : '') };
    fireEvent.drop(dropZone, { dataTransfer });
    expect(onApplyTrendPack).toHaveBeenCalledWith(pack);
  });
});

describe('ProjectExplorer: marketplace profiles', () => {
  it('lists real Marketplace Profiles from the registry', () => {
    render(<ProjectExplorer projects={[]} activeProjectId={null} onSwitchProject={vi.fn()} favorites={loadFavorites()} onApplyTrendPack={vi.fn()} />);
    fireEvent.click(screen.getByText(/🏬 Marketplace Profiles/));
    expect(screen.getByText('Shutterstock', { exact: false })).toBeInTheDocument();
  });
});
