import { LEFT_PANEL_IDS, RIGHT_PANEL_IDS, type PanelId, type WorkspaceSettings } from '../../workbench/workspaceSettings';

// Design Workbench Section 1 ("Support hiding and restoring panels") — one
// row of toggle chips covering every dockable panel in both sidebars.
// Hidden panels stay in this list (dimmed, not removed) so "restoring" a
// panel is always one click away, never a hunt through a settings menu.

const PANEL_LABELS: Record<PanelId, string> = {
  projectExplorer: '🗂 Explorer',
  favorites: '⭐ Favorites',
  importExport: '📂 Import/Export',
  project: '💾 Project',
  inspector: '⚙️ Inspector',
  marketplace: '🏬 Marketplace',
  prompt: '🤖 Prompt',
  quality: '🎯 Quality',
  critic: '🖌 Critic',
  evolution: '🧬 Evolution',
  validation: '✅ Validation',
  preview: '🖼 Live Preview',
  history: '🕘 History',
};

interface Props {
  settings: WorkspaceSettings;
  onToggle: (id: PanelId) => void;
}

export function PanelVisibilityBar({ settings, onToggle }: Props) {
  const allPanels = [...LEFT_PANEL_IDS, ...RIGHT_PANEL_IDS];
  return (
    <div className="workbench-panel-visibility-bar" role="group" aria-label="Show or hide panels">
      {allPanels.map((id) => {
        const hidden = settings.hiddenPanels.includes(id);
        return (
          <button
            key={id}
            type="button"
            className={`workbench-panel-chip${hidden ? ' workbench-panel-chip--hidden' : ''}`}
            aria-pressed={!hidden}
            title={hidden ? `Restore ${PANEL_LABELS[id]}` : `Hide ${PANEL_LABELS[id]}`}
            onClick={() => onToggle(id)}
          >
            {PANEL_LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}
