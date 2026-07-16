// Design Workbench Phase 6 — Section 1 ("Panels must be resizable. Support
// hiding and restoring panels.") and Section 10 ("Export Workspace
// Settings"). One plain, serializable object holds every layout
// preference the Workbench shell needs — theme, sidebar widths, which
// panels are currently hidden, and which tab is active in each sidebar —
// so persistence (localStorage) and Section 10's JSON export/import are
// the exact same shape, never two parallel representations that could
// drift. Pure logic only; DesignWorkbench.tsx owns the React state and
// calls these functions on mount/change.

export type LeftPanelId = 'projectExplorer' | 'favorites' | 'importExport' | 'project';
export type RightPanelId = 'inspector' | 'marketplace' | 'prompt' | 'quality' | 'critic' | 'evolution' | 'assetLibrary' | 'validation' | 'preview' | 'history';
export type PanelId = LeftPanelId | RightPanelId;

export const LEFT_PANEL_IDS: LeftPanelId[] = ['projectExplorer', 'favorites', 'importExport', 'project'];
export const RIGHT_PANEL_IDS: RightPanelId[] = ['inspector', 'marketplace', 'prompt', 'quality', 'critic', 'evolution', 'assetLibrary', 'validation', 'preview', 'history'];

export const WORKSPACE_SETTINGS_SCHEMA_VERSION = 1;

export interface WorkspaceSettings {
  schemaVersion: number;
  theme: 'light' | 'dark';
  leftWidth: number;
  rightWidth: number;
  /** Panels the user has explicitly hidden — absence means visible, so a
   * freshly-loaded/imported settings object with an empty list shows every
   * panel, matching pre-Phase-6 behavior. */
  hiddenPanels: PanelId[];
  leftTab: LeftPanelId;
  rightTab: RightPanelId;
}

export const MIN_SIDEBAR_WIDTH = 220;
export const MAX_SIDEBAR_WIDTH = 560;

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  schemaVersion: WORKSPACE_SETTINGS_SCHEMA_VERSION,
  theme: 'dark',
  leftWidth: 300,
  rightWidth: 360,
  hiddenPanels: [],
  leftTab: 'favorites',
  rightTab: 'preview',
};

const STORAGE_KEY = 'vsp-workbench-settings';

export function clampSidebarWidth(px: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(px)));
}

/** Defensive merge — every field falls back to the default individually,
 * so a settings object saved by an older/newer version of this shape (or
 * a hand-edited/partially-corrupt import) never crashes the Workbench; it
 * just silently recovers whichever fields it can. */
function normalizeWorkspaceSettings(raw: unknown): WorkspaceSettings {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<WorkspaceSettings>;
  const hiddenPanels = Array.isArray(obj.hiddenPanels)
    ? obj.hiddenPanels.filter((id): id is PanelId => (LEFT_PANEL_IDS as string[]).includes(id as string) || (RIGHT_PANEL_IDS as string[]).includes(id as string))
    : DEFAULT_WORKSPACE_SETTINGS.hiddenPanels;
  return {
    schemaVersion: WORKSPACE_SETTINGS_SCHEMA_VERSION,
    theme: obj.theme === 'light' ? 'light' : 'dark',
    leftWidth: typeof obj.leftWidth === 'number' ? clampSidebarWidth(obj.leftWidth) : DEFAULT_WORKSPACE_SETTINGS.leftWidth,
    rightWidth: typeof obj.rightWidth === 'number' ? clampSidebarWidth(obj.rightWidth) : DEFAULT_WORKSPACE_SETTINGS.rightWidth,
    hiddenPanels,
    leftTab: obj.leftTab && (LEFT_PANEL_IDS as string[]).includes(obj.leftTab) ? obj.leftTab : DEFAULT_WORKSPACE_SETTINGS.leftTab,
    rightTab: obj.rightTab && (RIGHT_PANEL_IDS as string[]).includes(obj.rightTab) ? obj.rightTab : DEFAULT_WORKSPACE_SETTINGS.rightTab,
  };
}

export function loadWorkspaceSettings(): WorkspaceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WORKSPACE_SETTINGS };
    return normalizeWorkspaceSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_WORKSPACE_SETTINGS };
  }
}

export function saveWorkspaceSettings(settings: WorkspaceSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable — settings just won't persist across reloads
  }
}

export function isPanelVisible(settings: WorkspaceSettings, id: PanelId): boolean {
  return !settings.hiddenPanels.includes(id);
}

/** Hides/restores one panel, and — if the panel being hidden was the
 * active tab in its sidebar — falls back to the first still-visible panel
 * in that sidebar so the UI never lands on a blank/hidden tab. */
export function togglePanelVisibility(settings: WorkspaceSettings, id: PanelId): WorkspaceSettings {
  const hidden = settings.hiddenPanels.includes(id);
  const hiddenPanels = hidden ? settings.hiddenPanels.filter((p) => p !== id) : [...settings.hiddenPanels, id];
  const next = { ...settings, hiddenPanels };

  if ((LEFT_PANEL_IDS as PanelId[]).includes(id) && next.leftTab === id && !hidden) {
    const fallback = LEFT_PANEL_IDS.find((p) => !hiddenPanels.includes(p));
    if (fallback) next.leftTab = fallback;
  }
  if ((RIGHT_PANEL_IDS as PanelId[]).includes(id) && next.rightTab === id && !hidden) {
    const fallback = RIGHT_PANEL_IDS.find((p) => !hiddenPanels.includes(p));
    if (fallback) next.rightTab = fallback;
  }
  return next;
}

export function parseWorkspaceSettingsJson(json: string): WorkspaceSettings {
  const parsed: unknown = JSON.parse(json);
  return normalizeWorkspaceSettings(parsed);
}

export function serializeWorkspaceSettings(settings: WorkspaceSettings): string {
  return JSON.stringify(settings, null, 2);
}
