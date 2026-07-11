import { useEffect, useState } from 'react';
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
import { TrendStudioForm } from './TrendStudioForm';
import { DesignSpecPanel } from './DesignSpecPanel';
import { PropertyInspector } from './PropertyInspector';
import { ValidationPanel } from './ValidationPanel';
import { LivePreviewPanel } from './LivePreviewPanel';
import { HistoryPanel } from './HistoryPanel';
import { FavoritesPanel } from './FavoritesPanel';
import { ImportExportBar } from './ImportExportBar';
import './workbench.css';

// Design Workbench (Phase 3) — the primary workspace: build, review, edit,
// validate, preview, save, and export a Design Specification without
// hand-editing raw JSON. Every section below is its own component reading
// from (or writing back through) `spec`/`history`; this shell only owns
// state and wiring — every computation is delegated to the Design
// Intelligence Engine (trend/*) or the Design Intelligence Core's
// services/validators (services/*, validators/*, workbench/*).

interface Props {
  onApplyToEditor: (params: GenerateParams) => void;
  onDownloadPackage: (spec: DesignSpecification, seed: string, marketplaceId: MarketplaceId) => void;
  onGenerateCollection: (spec: DesignSpecification, seed: string) => void;
  collectionStatus: 'idle' | 'building' | 'done';
  onClose: () => void;
  activeProject: Project | null;
  onSaveProject: (project: Project) => void;
}

type RightTab = 'inspector' | 'validation' | 'preview' | 'history';
type LeftTab = 'favorites' | 'importExport' | 'project';

const THEME_KEY = 'vsp-workbench-theme';

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

export function DesignWorkbench({ onApplyToEditor, onDownloadPackage, onGenerateCollection, collectionStatus, onClose, activeProject, onSaveProject }: Props) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null) ?? (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    } catch {
      return 'dark';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // storage unavailable — theme just won't persist across reloads
    }
  }, [theme]);

  const [bundle, setBundle] = useState<KeywordBundle>(defaultBundle());
  const [secondaryKeywordsText, setSecondaryKeywordsText] = useState(defaultBundle().secondaryKeywords.join(', '));
  const [trendPackId, setTrendPackId] = useState<string | undefined>(undefined);

  const [history, setHistory] = useState<HistoryState<DesignSpecification>>(() => createHistory<DesignSpecification>());
  const spec = history.present;

  const [seed, setSeed] = useState(() => newSeed('workbench'));
  const [qualityResult, setQualityResult] = useState<DesignSpecQualityLoopResult | null>(null);
  const [qualityRunning, setQualityRunning] = useState(false);

  const [rightTab, setRightTab] = useState<RightTab>('preview');
  const [leftTab, setLeftTab] = useState<LeftTab>('favorites');
  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [importError, setImportError] = useState<string | null>(null);
  const [newEntryName, setNewEntryName] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState<string>('');

  function pushSpec(next: DesignSpecification) {
    setHistory((h) => pushHistory(h, next));
    setQualityResult(null);
    setSeed(newSeed('workbench'));
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

  return (
    <section className="design-workbench" data-theme={theme}>
      <div className="workbench-header">
        <div>
          <h2>🧭 Design Workbench</h2>
          <p className="metadata-hint">Build, review, edit, validate, preview, save, and export a Design Specification — no hand-edited JSON required.</p>
        </div>
        <div className="workbench-header-actions">
          <button type="button" className="btn" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} aria-label="Toggle theme">
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            ← Back to Editor
          </button>
        </div>
      </div>

      <div className="workbench-layout">
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

          <div className="workbench-view-switch" role="tablist" aria-label="Sidebar sections">
            {(
              [
                ['favorites', '⭐ Favorites'],
                ['importExport', '📂 Import/Export'],
                ['project', '💾 Project'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={leftTab === id} className={`workbench-tab${leftTab === id ? ' active' : ''}`} onClick={() => setLeftTab(id)}>
                {label}
              </button>
            ))}
          </div>

          {leftTab === 'favorites' && (
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

          {leftTab === 'importExport' && (
            <div>
              <ImportExportBar spec={spec} onImportSpec={pushSpec} onImportError={setImportError} selectedTrendPack={selectedTrendPack} onImportTrendPack={handleImportTrendPack} />
              {importError && <p className="marketplace-issue marketplace-issue--error">❌ {importError}</p>}
            </div>
          )}

          {leftTab === 'project' && (
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

        <main className="workbench-main">
          {!spec && (
            <div className="workbench-empty-state">
              <p>👋 Fill in the Trend Studio form on the left and click <strong>Generate Design Specification</strong> to begin — or import one from the Import/Export tab.</p>
            </div>
          )}
          {spec && <DesignSpecPanel spec={spec} onApplyJson={handleApplyJson} />}
        </main>

        <aside className="workbench-sidebar workbench-sidebar-right">
          <div className="workbench-view-switch" role="tablist" aria-label="Design Specification tools">
            {(
              [
                ['inspector', '⚙️ Properties'],
                ['validation', '✅ Validation'],
                ['preview', '🖼 Live Preview'],
                ['history', '🕘 History'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={rightTab === id} className={`workbench-tab${rightTab === id ? ' active' : ''}`} onClick={() => setRightTab(id)}>
                {label}
              </button>
            ))}
          </div>

          {!spec && <p className="metadata-hint">Generate a Design Specification to use this panel.</p>}

          {spec && rightTab === 'inspector' && <PropertyInspector spec={spec} onUpdateSpec={pushSpec} />}
          {spec && rightTab === 'validation' && <ValidationPanel spec={spec} />}
          {spec && rightTab === 'preview' && (
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
              onGenerateCollection={() => onGenerateCollection(spec, seed)}
              collectionStatus={collectionStatus}
              onDownloadPackage={(marketplaceId) => onDownloadPackage(spec, seed, marketplaceId)}
            />
          )}
          {rightTab === 'history' && (
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
