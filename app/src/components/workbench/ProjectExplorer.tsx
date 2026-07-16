import { useState } from 'react';
import type { Project } from '../../project/projectTypes';
import { TREND_PACK_LIST, type TrendPack } from '../../trend/trendPacks';
import { listMarketplaces } from '../../services/marketplaceService';
import type { WorkbenchFavorites } from '../../workbench/workbenchFavorites';

// Design Workbench Section 2 ("Project Explorer") — the one place that
// browses Projects, each Project's Collections and Assets, Trend Packs,
// and Marketplace Profiles together, instead of the pre-Phase-6 spread
// across ProjectDashboard.tsx/ProjectPanel.tsx/TrendStudioForm.tsx. Every
// list here reads real data this component already had access to
// (`Project[]` from App.tsx, `TREND_PACK_LIST`/`listMarketplaces()` from
// the existing engine registries) — nothing is re-fetched or duplicated.
//
// Favorites (the 6th named item type) intentionally isn't a 6th
// sub-section here: `FavoritesPanel.tsx` already owns the real star-
// toggle/apply UI for favorites, and duplicating that interaction in a
// second component would be two sources of truth for the same state. This
// panel instead shows a real, read-only ★ marker inline on Trend Pack/
// Marketplace rows (from the same `favorites` state FavoritesPanel writes
// to) so "is this one favorited" is visible while browsing, without
// re-implementing the toggle.
//
// Drag-and-drop (Section 2's "Support drag-and-drop organization"):
// scoped honestly to the one real, useful interaction this data model
// supports — dragging a Trend Pack onto the drop zone applies it to the
// active Design Specification (`onApplyTrendPack`, the same function the
// Import/Export bar's "Import Trend Pack" button already calls), using
// native HTML5 drag-and-drop (no new dependency).

const PAGE_SIZE = 20;

function usePagination<T>(items: T[]) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  return { shown: items.slice(0, visible), hasMore: items.length > visible, showMore: () => setVisible((v) => v + PAGE_SIZE) };
}

interface Props {
  projects: Project[];
  activeProjectId: string | null;
  onSwitchProject: (id: string) => void;
  favorites: WorkbenchFavorites;
  onApplyTrendPack: (pack: TrendPack) => void;
}

export function ProjectExplorer({ projects, activeProjectId, onSwitchProject, favorites, onApplyTrendPack }: Props) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(activeProjectId);
  const [dragOver, setDragOver] = useState(false);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;
  const marketplaces = listMarketplaces();

  const projectPage = usePagination(projects);
  const trendPackPage = usePagination(TREND_PACK_LIST);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const packId = e.dataTransfer.getData('application/x-trendpack-id');
    const pack = TREND_PACK_LIST.find((p) => p.id === packId);
    if (pack) onApplyTrendPack(pack);
  }

  return (
    <div className="workbench-project-explorer">
      <div
        className={`workbench-explorer-drop-zone${dragOver ? ' workbench-explorer-drop-zone--active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        🎯 Drag a Trend Pack here to apply it to the current spec
      </div>

      <details open className="workbench-collapsible">
        <summary>📁 Projects ({projects.length})</summary>
        <ul className="workbench-favorites-list workbench-explorer-tree">
          {projectPage.shown.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={`workbench-explorer-row${p.id === selectedProjectId ? ' workbench-explorer-row--selected' : ''}${p.id === activeProjectId ? ' workbench-explorer-row--active' : ''}`}
                onClick={() => {
                  setSelectedProjectId(p.id);
                  onSwitchProject(p.id);
                }}
              >
                {p.favorite ? '★' : '☆'} {p.name}
                <span className="metadata-hint"> ({p.collections.length} collection{p.collections.length === 1 ? '' : 's'})</span>
              </button>
            </li>
          ))}
          {projects.length === 0 && <li className="metadata-hint">No projects yet.</li>}
        </ul>
        {projectPage.hasMore && (
          <button type="button" className="btn" onClick={projectPage.showMore}>
            Load more projects…
          </button>
        )}
      </details>

      {selectedProject && (
        <details open className="workbench-collapsible">
          <summary>
            🏭 Collections — {selectedProject.name} ({selectedProject.collections.length})
          </summary>
          <ul className="workbench-favorites-list workbench-explorer-tree">
            {selectedProject.collections.map((entry) => (
              <li key={entry.id} className="workbench-explorer-nested">
                <details>
                  <summary>
                    {entry.collection.manifest.collectionName} <span className="metadata-hint">({entry.collection.assets.length} assets)</span>
                  </summary>
                  <ul className="workbench-favorites-list">
                    {entry.collection.assets.map((asset) => (
                      <li key={asset.id}>
                        <span className="metadata-hint">{asset.type}</span> {asset.label}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
            {selectedProject.collections.length === 0 && <li className="metadata-hint">No collections generated in this project yet.</li>}
          </ul>
        </details>
      )}

      <details className="workbench-collapsible">
        <summary>📈 Trend Packs ({TREND_PACK_LIST.length})</summary>
        <ul className="workbench-favorites-list workbench-explorer-tree">
          {trendPackPage.shown.map((pack) => (
            <li key={pack.id}>
              <div
                className="workbench-explorer-row workbench-explorer-row--draggable"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('application/x-trendpack-id', pack.id)}
                title="Drag onto the drop zone above to apply"
              >
                {favorites.trendPackIds.includes(pack.id) ? '★' : '☆'} {pack.label}
              </div>
            </li>
          ))}
        </ul>
        {trendPackPage.hasMore && (
          <button type="button" className="btn" onClick={trendPackPage.showMore}>
            Load more Trend Packs…
          </button>
        )}
      </details>

      <details className="workbench-collapsible">
        <summary>🏬 Marketplace Profiles ({marketplaces.length})</summary>
        <ul className="workbench-favorites-list workbench-explorer-tree">
          {marketplaces.map((m) => (
            <li key={m.id}>
              {favorites.marketplaceIds.includes(m.id) ? '★' : '☆'} {m.label}
              {m.future ? ' 🔜' : ''}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
