import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import type { GenerateParams } from '../../engine/types';
import type { DesignSpecification, KeywordBundle } from '../../trend/designSpecTypes';
import { buildDesignSpecification } from '../../trend/designIntelligence';
import { parseDesignSpecificationJson } from '../../trend/designSpecValidation';
import { runDesignSpecQualityLoop, type DesignSpecQualityLoopResult } from '../../trend/designSpecQuality';
import { TREND_PACK_LIST } from '../../trend/trendPacks';
import type { TrendPack } from '../../trend/trendPacks';
import type { MarketplaceId } from '../../metadata/marketplaceProfiles';
import type { Project } from '../../project/projectTypes';
import { addDesignSpecToProject, addDesignSpecVersion } from '../../project/projectManager';
import {
  createHistory,
  pushHistory,
  undoHistory,
  redoHistory,
  takeSnapshot,
  restoreSnapshot,
  removeSnapshot,
  type HistoryState,
} from '../../workbench/workbenchHistory';
import {
  loadFavorites,
  saveFavorites,
  toggleFavoriteTrendPack,
  toggleFavoriteStyleDna,
  toggleFavoritePalette,
  toggleFavoriteMarketplace,
  saveMotifCollection,
  removeMotifCollection,
  type WorkbenchMotifCollection,
} from '../../workbench/workbenchFavorites';
import { applyTrendPackToSpec } from '../../workbench/workbenchTrendPack';
import {
  loadWorkspaceSettings,
  saveWorkspaceSettings,
  isPanelVisible,
  togglePanelVisibility,
  clampSidebarWidth,
  LEFT_PANEL_IDS,
  RIGHT_PANEL_IDS,
  type PanelId,
  type WorkspaceSettings,
} from '../../workbench/workspaceSettings';
import { TrendStudioForm } from './TrendStudioForm';
import { DesignSpecPanel } from './DesignSpecPanel';
import { PropertyInspector } from './PropertyInspector';
import { ValidationPanel } from './ValidationPanel';
import { LivePreviewPanel } from './LivePreviewPanel';
import { HistoryPanel } from './HistoryPanel';
import { FavoritesPanel } from './FavoritesPanel';
import { ImportExportBar } from './ImportExportBar';
import { ResizeHandle } from './ResizeHandle';
import { PanelVisibilityBar } from './PanelVisibilityBar';
import { GlobalSearchBar } from './GlobalSearchBar';
import { loadLearningHistory, saveLearningHistory, recordStyleDnaUsage, recordPaletteUsage, recordCollectionGenerated } from '../../knowledge/history';
import './workbench.css';

// Design Workbench (Phase 3, restructured into a dockable multi-panel
// workspace in Phase 6) — the primary workspace: build, review, edit,
// validate, preview, save, and export a Design Specification without
// hand-editing raw JSON. Every section below is its own component reading
// from (or writing back through) `spec`/`history`; this shell only owns
// state and wiring — every computation is delegated to the Design
// Intelligence Engine (trend/*) or the Design Intelligence Core's
// services/validators (services/*, validators/*, workbench/*).
//
// Phase 6, Section 1 ("dockable multi-panel interface... resizable...
// hiding and restoring panels") is honestly scoped to two real,
// independently-verifiable capabilities rather than a full floating/
// rearrangeable docking system (a whole separate library's worth of work):
// both sidebars are real pointer-drag-resizable (`ResizeHandle.tsx`,
// clamped and persisted), and every one of the 11 panels across both
// sidebars can be hidden/restored via `PanelVisibilityBar.tsx` — genuinely
// removed from its tab strip when hidden, one click to bring back. Layout
// state (widths, hidden panels, active tabs, theme) is one serializable
// `WorkspaceSettings` object (workbench/workspaceSettings.ts), persisted
// to localStorage and exportable/importable as real JSON (Section 10).
//
// Section 11 ("Use lazy loading"): the four Phase 6 panels genuinely never
// used before this milestone (Project Explorer, Marketplace, Prompt,
// Quality) are code-split via `React.lazy` — their own modules, and every
// engine/service they import, aren't fetched until a designer actually
// opens that tab, not bundled into the Workbench's initial render.

const ProjectExplorer = lazy(() => import('./ProjectExplorer').then((m) => ({ default: m.ProjectExplorer })));
const MarketplacePanel = lazy(() => import('./MarketplacePanel').then((m) => ({ default: m.MarketplacePanel })));
const PromptPanel = lazy(() => import('./PromptPanel').then((m) => ({ default: m.PromptPanel })));
const QualityPanel = lazy(() => import('./QualityPanel').then((m) => ({ default: m.QualityPanel })));
const DesignCriticPanel = lazy(() => import('./DesignCriticPanel').then((m) => ({ default: m.DesignCriticPanel })));
const EvolutionPanel = lazy(() => import('./EvolutionPanel').then((m) => ({ default: m.EvolutionPanel })));
const AssetLibraryPanel = lazy(() => import('./AssetLibraryPanel').then((m) => ({ default: m.AssetLibraryPanel })));

function LazyFallback() {
  return <p className="metadata-hint">⏳ Loading panel…</p>;
}

interface Props {
  onApplyToEditor: (params: GenerateParams) => void;
  onDownloadPackage: (spec: DesignSpecification, seed: string, marketplaceId: MarketplaceId) => void;
  onGenerateCollection: (spec: DesignSpecification, seed: string) => void;
  collectionStatus: 'idle' | 'building' | 'done';
  onClose: () => void;
  activeProject: Project | null;
  onSaveProject: (project: Project) => void;
  /** Section 2, Project Explorer — the full project list (not just the
   * active one) and a way to switch which one is active. Both already
   * exist in App.tsx's own state; nothing new is derived here. */
  allProjects: Project[];
  onSwitchProject: (id: string) => void;
}

function newSeed(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultBundle(): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical',
    secondaryKeywords: ['Wallpaper', 'Editorial'],
    marketplace: 'adobestock',
    season: 'spring',
    audience: 'editorial / boutique buyers',
    commercialCategory: 'wallpaper',
    patternType: 'botanical',
    paletteDirection: '',
    difficulty: 'moderate',
    collectionSize: 8,
  };
}

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
  assetLibrary: '🗃 Assets',
  validation: '✅ Validation',
  preview: '🖼 Live Preview',
  history: '🕘 History',
};

export function DesignWorkbench({ onApplyToEditor, onDownloadPackage, onGenerateCollection, collectionStatus, onClose, activeProject, onSaveProject, allProjects, onSwitchProject }: Props) {
  const [settings, setSettings] = useState<WorkspaceSettings>(() => loadWorkspaceSettings());
  useEffect(() => saveWorkspaceSettings(settings), [settings]);

  function updateSettings(patch: Partial<WorkspaceSettings>) {
    setSettings((s) => ({ ...s, ...patch }));
  }
  function handleTogglePanel(id: PanelId) {
    setSettings((s) => togglePanelVisibility(s, id));
  }

  const [bundle, setBundle] = useState<KeywordBundle>(defaultBundle());
  const [secondaryKeywordsText, setSecondaryKeywordsText] = useState(defaultBundle().secondaryKeywords.join(', '));
  const [trendPackId, setTrendPackId] = useState<string | undefined>(undefined);

  const [history, setHistory] = useState<HistoryState<DesignSpecification>>(() => createHistory<DesignSpecification>());
  const spec = history.present;

  const [seed, setSeed] = useState(() => newSeed('workbench'));
  const [qualityResult, setQualityResult] = useState<DesignSpecQualityLoopResult | null>(null);
  const [qualityRunning, setQualityRunning] = useState(false);

  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [importError, setImportError] = useState<string | null>(null);
  const [newEntryName, setNewEntryName] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState<string>('');

  // Design Knowledge Engine (Phase 6.5), Section 10 — a real consumer of
  // `knowledge/history`, distinct from the `favorites` state above
  // (explicit starring): every spec that becomes the current one records
  // implicit Style DNA/Palette usage, so Section 11's Recommendation
  // Engine can personalize by what's actually used, not just starred.
  const [learningHistory, setLearningHistory] = useState(() => loadLearningHistory());
  useEffect(() => saveLearningHistory(learningHistory), [learningHistory]);

  function pushSpec(next: DesignSpecification) {
    setHistory((h) => pushHistory(h, next));
    setQualityResult(null);
    setSeed(newSeed('workbench'));
    setLearningHistory((h) => recordPaletteUsage(recordStyleDnaUsage(h, next.styleDnaId), next.palette.id));
  }

  function handleGenerateSpec() {
    const next = buildDesignSpecification({
      keywordBundle: { ...bundle, secondaryKeywords: secondaryKeywordsText.split(',').map((k) => k.trim()).filter(Boolean) },
      trendPackId,
      createdAt: Date.now(),
    });
    pushSpec(next);
  }

  function handleApplyJson(json: string): string | null {
    try {
      pushSpec(parseDesignSpecificationJson(json));
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }

  function handleRunQualityLoop() {
    if (!spec) return;
    setQualityRunning(true);
    setTimeout(() => {
      setQualityResult(runDesignSpecQualityLoop(spec, seed, 'fast'));
      setQualityRunning(false);
    }, 0);
  }

  function updateFavorites(next: typeof favorites) {
    setFavorites(next);
    saveFavorites(next);
  }

  function handleImportTrendPack(pack: TrendPack) {
    if (spec) pushSpec(applyTrendPackToSpec(spec, pack));
  }

  function handleSaveCurrentMotifsAsCollection() {
    if (!spec) return;
    const name = window.prompt('Name this motif collection:', `${spec.styleDnaId} mix`);
    if (!name) return;
    updateFavorites(saveMotifCollection(favorites, name, { heroMotifs: spec.heroMotifs, secondaryMotifs: spec.secondaryMotifs, fillers: spec.fillers }));
  }

  function handleApplyMotifCollection(collection: WorkbenchMotifCollection) {
    if (!spec) return;
    pushSpec({ ...spec, heroMotifs: collection.heroMotifs, secondaryMotifs: collection.secondaryMotifs, fillers: collection.fillers });
  }

  function handleSaveToProject(asNewEntry: boolean) {
    if (!spec || !activeProject) return;
    if (asNewEntry) {
      if (!newEntryName.trim()) return;
      const updated = addDesignSpecToProject(activeProject, newEntryName.trim(), spec);
      onSaveProject(updated);
      setSelectedEntryId(updated.designSpecs[updated.designSpecs.length - 1].id);
      setNewEntryName('');
    } else if (selectedEntryId) {
      onSaveProject(addDesignSpecVersion(activeProject, selectedEntryId, spec));
    }
  }

  const selectedTrendPack: TrendPack | null = TREND_PACK_LIST.find((p) => p.id === trendPackId) ?? null;

  const visibleLeftPanels = LEFT_PANEL_IDS.filter((id) => isPanelVisible(settings, id));
  const visibleRightPanels = RIGHT_PANEL_IDS.filter((id) => isPanelVisible(settings, id));

  return (
    <section className="design-workbench" data-theme={settings.theme}>
      <div className="workbench-header">
        <div>
          <h2>🧭 Design Workbench</h2>
          <p className="metadata-hint">Build, review, edit, validate, preview, save, and export a Design Specification — no hand-edited JSON required.</p>
        </div>
        <GlobalSearchBar projects={allProjects} onSwitchProject={onSwitchProject} onApplyTrendPack={handleImportTrendPack} />
        <div className="workbench-header-actions">
          <button type="button" className="btn" onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })} aria-label="Toggle theme">
            {settings.theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            ← Back to Editor
          </button>
        </div>
      </div>

      <PanelVisibilityBar settings={settings} onToggle={handleTogglePanel} />

      <div className="workbench-layout" style={{ '--wb-left-width': `${settings.leftWidth}px`, '--wb-right-width': `${settings.rightWidth}px` } as CSSProperties}>
        <aside className="workbench-sidebar workbench-sidebar-left">
          <details open className="workbench-collapsible">
            <summary>🧠 Trend Studio</summary>
            <TrendStudioForm
              bundle={bundle}
              onBundleChange={setBundle}
              secondaryKeywordsText={secondaryKeywordsText}
              onSecondaryKeywordsTextChange={setSecondaryKeywordsText}
              trendPackId={trendPackId}
              onTrendPackIdChange={setTrendPackId}
              onGenerate={handleGenerateSpec}
            />
          </details>

          {visibleLeftPanels.length === 0 && <p className="metadata-hint">Every left panel is hidden — restore one from the bar above.</p>}

          {visibleLeftPanels.length > 0 && (
            <div className="workbench-view-switch" role="tablist" aria-label="Sidebar sections">
              {visibleLeftPanels.map((id) => (
                <button key={id} type="button" role="tab" aria-selected={settings.leftTab === id} className={`workbench-tab${settings.leftTab === id ? ' active' : ''}`} onClick={() => updateSettings({ leftTab: id })}>
                  {PANEL_LABELS[id]}
                </button>
              ))}
            </div>
          )}

          {settings.leftTab === 'projectExplorer' && isPanelVisible(settings, 'projectExplorer') && (
            <Suspense fallback={<LazyFallback />}>
              <ProjectExplorer projects={allProjects} activeProjectId={activeProject?.id ?? null} onSwitchProject={onSwitchProject} favorites={favorites} onApplyTrendPack={handleImportTrendPack} />
            </Suspense>
          )}

          {settings.leftTab === 'favorites' && isPanelVisible(settings, 'favorites') && (
            <FavoritesPanel
              favorites={favorites}
              onToggleTrendPack={(id) => updateFavorites(toggleFavoriteTrendPack(favorites, id))}
              onToggleStyleDna={(id) => updateFavorites(toggleFavoriteStyleDna(favorites, id))}
              onTogglePalette={(id) => updateFavorites(toggleFavoritePalette(favorites, id))}
              onToggleMarketplace={(id) => updateFavorites(toggleFavoriteMarketplace(favorites, id))}
              onApplyMotifCollection={handleApplyMotifCollection}
              onRemoveMotifCollection={(id) => updateFavorites(removeMotifCollection(favorites, id))}
              onSaveCurrentMotifsAsCollection={handleSaveCurrentMotifsAsCollection}
              spec={spec}
            />
          )}

          {settings.leftTab === 'importExport' && isPanelVisible(settings, 'importExport') && (
            <div>
              <ImportExportBar spec={spec} onImportSpec={pushSpec} onImportError={setImportError} selectedTrendPack={selectedTrendPack} onImportTrendPack={handleImportTrendPack} workspaceSettings={settings} onImportWorkspaceSettings={setSettings} seed={seed} />
              {importError && <p className="marketplace-issue marketplace-issue--error">❌ {importError}</p>}
            </div>
          )}

          {settings.leftTab === 'project' && isPanelVisible(settings, 'project') && (
            <div className="workbench-project-panel">
              {!activeProject && <p className="metadata-hint">Open a Project to save Design Specifications into it.</p>}
              {activeProject && (
                <>
                  <p className="metadata-hint">
                    Saving into: <strong>{activeProject.name}</strong>
                  </p>
                  <div className="workbench-snapshot-form">
                    <input type="text" placeholder="New Design Spec name…" value={newEntryName} onChange={(e) => setNewEntryName(e.target.value)} />
                    <button type="button" className="btn btn--primary" disabled={!spec || !newEntryName.trim()} onClick={() => handleSaveToProject(true)}>
                      💾 Save as New
                    </button>
                  </div>
                  {activeProject.designSpecs.length > 0 && (
                    <div className="workbench-snapshot-form">
                      <select value={selectedEntryId} onChange={(e) => setSelectedEntryId(e.target.value)}>
                        <option value="">— select entry —</option>
                        {activeProject.designSpecs.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name} ({entry.versions.length} version{entry.versions.length === 1 ? '' : 's'})
                          </option>
                        ))}
                      </select>
                      <button type="button" className="btn" disabled={!spec || !selectedEntryId} onClick={() => handleSaveToProject(false)}>
                        + Add Version
                      </button>
                    </div>
                  )}
                  <ul className="workbench-favorites-list">
                    {activeProject.designSpecs.map((entry) => (
                      <li key={entry.id}>
                        <span>{entry.name}</span>
                        <button type="button" className="btn" onClick={() => pushSpec(entry.versions[entry.versions.length - 1].spec)}>
                          Load latest
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </aside>

        <ResizeHandle side="left" width={settings.leftWidth} onResize={(w) => updateSettings({ leftWidth: clampSidebarWidth(w) })} label="Resize left sidebar" />

        <main className="workbench-main">
          {!spec && (
            <div className="workbench-empty-state">
              <p>👋 Fill in the Trend Studio form on the left and click <strong>Generate Design Specification</strong> to begin — or import one from the Import/Export tab.</p>
            </div>
          )}
          {spec && <DesignSpecPanel spec={spec} onApplyJson={handleApplyJson} />}
        </main>

        <ResizeHandle side="right" width={settings.rightWidth} onResize={(w) => updateSettings({ rightWidth: clampSidebarWidth(w) })} label="Resize right sidebar" />

        <aside className="workbench-sidebar workbench-sidebar-right">
          {visibleRightPanels.length === 0 && <p className="metadata-hint">Every right panel is hidden — restore one from the bar above.</p>}

          {visibleRightPanels.length > 0 && (
            <div className="workbench-view-switch" role="tablist" aria-label="Design Specification tools">
              {visibleRightPanels.map((id) => (
                <button key={id} type="button" role="tab" aria-selected={settings.rightTab === id} className={`workbench-tab${settings.rightTab === id ? ' active' : ''}`} onClick={() => updateSettings({ rightTab: id })}>
                  {PANEL_LABELS[id]}
                </button>
              ))}
            </div>
          )}

          {!spec && visibleRightPanels.length > 0 && <p className="metadata-hint">Generate a Design Specification to use this panel.</p>}

          {spec && settings.rightTab === 'inspector' && isPanelVisible(settings, 'inspector') && <PropertyInspector spec={spec} onUpdateSpec={pushSpec} />}
          {spec && settings.rightTab === 'marketplace' && isPanelVisible(settings, 'marketplace') && (
            <Suspense fallback={<LazyFallback />}>
              <MarketplacePanel spec={spec} seed={seed} qualityResult={qualityResult} />
            </Suspense>
          )}
          {spec && settings.rightTab === 'prompt' && isPanelVisible(settings, 'prompt') && (
            <Suspense fallback={<LazyFallback />}>
              <PromptPanel spec={spec} />
            </Suspense>
          )}
          {spec && settings.rightTab === 'quality' && isPanelVisible(settings, 'quality') && (
            <Suspense fallback={<LazyFallback />}>
              <QualityPanel qualityResult={qualityResult} qualityRunning={qualityRunning} onRunQualityLoop={handleRunQualityLoop} />
            </Suspense>
          )}
          {spec && settings.rightTab === 'critic' && isPanelVisible(settings, 'critic') && (
            <Suspense fallback={<LazyFallback />}>
              <DesignCriticPanel
                spec={spec}
                seed={seed}
                qualityResult={qualityResult}
                qualityRunning={qualityRunning}
                onRunQualityLoop={handleRunQualityLoop}
                onUpdateSpec={pushSpec}
                activeProject={activeProject}
              />
            </Suspense>
          )}
          {spec && settings.rightTab === 'evolution' && isPanelVisible(settings, 'evolution') && (
            <Suspense fallback={<LazyFallback />}>
              <EvolutionPanel spec={spec} seed={seed} onApplySpec={pushSpec} />
            </Suspense>
          )}
          {spec && settings.rightTab === 'assetLibrary' && isPanelVisible(settings, 'assetLibrary') && (
            <Suspense fallback={<LazyFallback />}>
              <AssetLibraryPanel activeProject={activeProject} />
            </Suspense>
          )}
          {spec && settings.rightTab === 'validation' && isPanelVisible(settings, 'validation') && <ValidationPanel spec={spec} />}
          {spec && settings.rightTab === 'preview' && isPanelVisible(settings, 'preview') && (
            <LivePreviewPanel
              spec={spec}
              seed={seed}
              onRerollSeed={() => {
                setSeed(newSeed('workbench'));
                setQualityResult(null);
              }}
              onApplyToEditor={onApplyToEditor}
              onRunQualityLoop={handleRunQualityLoop}
              qualityResult={qualityResult}
              qualityRunning={qualityRunning}
              onGenerateCollection={() => {
                setLearningHistory((h) => recordCollectionGenerated(h, { id: `${spec.project.name}-${seed}`, name: spec.project.name, createdAt: Date.now() }));
                onGenerateCollection(spec, seed);
              }}
              collectionStatus={collectionStatus}
              onDownloadPackage={(marketplaceId) => onDownloadPackage(spec, seed, marketplaceId)}
            />
          )}
          {settings.rightTab === 'history' && isPanelVisible(settings, 'history') && (
            <HistoryPanel
              history={history}
              onUndo={() => setHistory((h) => undoHistory(h))}
              onRedo={() => setHistory((h) => redoHistory(h))}
              onSnapshot={(label) => setHistory((h) => takeSnapshot(h, label))}
              onRestore={(id) => {
                setHistory((h) => restoreSnapshot(h, id));
                setQualityResult(null);
              }}
              onRemoveSnapshot={(id) => setHistory((h) => removeSnapshot(h, id))}
            />
          )}
        </aside>
      </div>
    </section>
  );
}
