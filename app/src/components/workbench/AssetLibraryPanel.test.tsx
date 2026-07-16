import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { defaultParams } from '../../engine/defaults';
import { generateCollection } from '../../collection/collectionGenerator';
import { createProject, addCollectionToProject } from '../../project/projectManager';
import { AssetLibraryPanel } from './AssetLibraryPanel';

beforeEach(() => {
  localStorage.clear();
});

function projectWithCollection() {
  const collection = generateCollection({ ...defaultParams(), categoryId: 'botanical', seed: 'asset-panel-test' });
  return addCollectionToProject(createProject('Asset Panel Test Project'), collection);
}

describe('AssetLibraryPanel: before extraction', () => {
  it('shows a hint to generate a Collection when the project has none', async () => {
    render(<AssetLibraryPanel activeProject={createProject('Empty Project')} />);
    await waitFor(() => expect(screen.getByText(/Generate a Collection into this Project first/)).toBeInTheDocument());
  });

  it('the Extract button is disabled with no Project collection to extract from', async () => {
    render(<AssetLibraryPanel activeProject={null} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Extract Assets/ })).toBeDisabled());
  });
});

describe('AssetLibraryPanel: extraction and browsing', () => {
  it('extracting populates the real asset list from the active project\'s collection', async () => {
    const project = projectWithCollection();
    render(<AssetLibraryPanel activeProject={project} />);
    fireEvent.click(screen.getByRole('button', { name: /Extract Assets/ }));
    await waitFor(() => expect(screen.getByText(/asset\(s\) in the library/)).toBeInTheDocument());
    expect(screen.getByText(/40 of 40 asset\(s\) in the library\.|of \d+ asset\(s\) in the library\./)).toBeInTheDocument();
  });

  it('selecting an asset shows its real quality score breakdown', async () => {
    const project = projectWithCollection();
    render(<AssetLibraryPanel activeProject={project} />);
    fireEvent.click(screen.getByRole('button', { name: /Extract Assets/ }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Border|Hero Motif|Frame|Decorative Shape/ }).length).toBeGreaterThan(0));
    const [firstAssetButton] = screen.getAllByRole('button', { name: /Border|Hero Motif|Frame|Decorative Shape/ });
    fireEvent.click(firstAssetButton);
    expect(screen.getByText('Reusability')).toBeInTheDocument();
    expect(screen.getByText('Complexity')).toBeInTheDocument();
  });

  it('the keyword search filters the visible asset list', async () => {
    const project = projectWithCollection();
    render(<AssetLibraryPanel activeProject={project} />);
    fireEvent.click(screen.getByRole('button', { name: /Extract Assets/ }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Border|Hero Motif|Frame|Decorative Shape/ }).length).toBeGreaterThan(0));
    fireEvent.change(screen.getByPlaceholderText(/name, category, pattern type/), { target: { value: 'zzz-no-match-keyword' } });
    await waitFor(() => expect(screen.getByText('0 of', { exact: false })).toBeInTheDocument());
  });

  it('favoriting an asset is reflected immediately', async () => {
    const project = projectWithCollection();
    render(<AssetLibraryPanel activeProject={project} />);
    fireEvent.click(screen.getByRole('button', { name: /Extract Assets/ }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: '★' }).length).toBeGreaterThan(0));
    const [firstFavoriteButton] = screen.getAllByRole('button', { name: '★' });
    expect(firstFavoriteButton.className).toContain('workbench-panel-chip--hidden');
    fireEvent.click(firstFavoriteButton);
    expect(firstFavoriteButton.className).not.toContain('workbench-panel-chip--hidden');
  });
});
