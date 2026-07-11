import { useRef, useState } from 'react';
import type { DesignSpecification } from '../../trend/designSpecTypes';
import type { TrendPack } from '../../trend/trendPacks';
import type { WorkspaceSettings } from '../../workbench/workspaceSettings';
import {
  exportDesignSpecificationFile,
  readDesignSpecificationFile,
  exportTrendPackFile,
  readTrendPackFile,
  exportWorkspaceSettingsFile,
  readWorkspaceSettingsFile,
  exportCollectionSpecificationFile,
  exportMarketplaceProfileFile,
  readMarketplaceProfileFile,
} from '../../workbench/workbenchImportExport';

// Design Workbench Section 10 ("Import / Export"). Thin file-picker glue
// over workbench/workbenchImportExport.ts — no parsing/serialization logic
// lives here. Phase 6 adds: Export Workspace Settings / Import Workspace
// Settings (round-trips through workbench/workspaceSettings.ts, the same
// object DesignWorkbench.tsx already persists to localStorage), Export
// Collection Specification JSON (self-contained — builds the Collection
// this spec/seed would generate, then its spec), and Import/Export
// Marketplace Profile (Export downloads one of the 6 real committed
// profiles; Import validates an uploaded profile against the real schema
// and reports issues — see workbenchImportExport.ts's header comment for
// why an imported profile can't be registered into the live app this
// session).

interface Props {
  spec: DesignSpecification | null;
  onImportSpec: (spec: DesignSpecification) => void;
  onImportError: (message: string) => void;
  selectedTrendPack: TrendPack | null;
  onImportTrendPack: (pack: TrendPack) => void;
  workspaceSettings: WorkspaceSettings;
  onImportWorkspaceSettings: (settings: WorkspaceSettings) => void;
  seed: string;
}

export function ImportExportBar({
  spec,
  onImportSpec,
  onImportError,
  selectedTrendPack,
  onImportTrendPack,
  workspaceSettings,
  onImportWorkspaceSettings,
  seed,
}: Props) {
  const specFileInput = useRef<HTMLInputElement>(null);
  const trendPackFileInput = useRef<HTMLInputElement>(null);
  const settingsFileInput = useRef<HTMLInputElement>(null);
  const marketplaceFileInput = useRef<HTMLInputElement>(null);
  const [marketplaceImportNote, setMarketplaceImportNote] = useState<string | null>(null);

  async function handleSpecFile(file: File | undefined) {
    if (!file) return;
    try {
      onImportSpec(await readDesignSpecificationFile(file));
    } catch (e) {
      onImportError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleTrendPackFile(file: File | undefined) {
    if (!file) return;
    try {
      onImportTrendPack(await readTrendPackFile(file));
    } catch (e) {
      onImportError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSettingsFile(file: File | undefined) {
    if (!file) return;
    try {
      onImportWorkspaceSettings(await readWorkspaceSettingsFile(file));
    } catch (e) {
      onImportError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleMarketplaceFile(file: File | undefined) {
    if (!file) return;
    try {
      const { data, issues } = await readMarketplaceProfileFile(file);
      setMarketplaceImportNote(
        issues.length === 0
          ? `✅ "${data.label ?? data.id}" is a valid Marketplace Profile (validated only — not registered into this session).`
          : `⚠️ ${issues.length} schema issue(s): ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`,
      );
    } catch (e) {
      onImportError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="workbench-import-export-bar">
      <button type="button" className="btn" onClick={() => specFileInput.current?.click()}>
        📂 Import Design Spec
      </button>
      <input
        ref={specFileInput}
        type="file"
        accept="application/json"
        className="workbench-hidden-file-input"
        onChange={(e) => {
          void handleSpecFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button type="button" className="btn" disabled={!spec} onClick={() => spec && exportDesignSpecificationFile(spec)}>
        💾 Export Design Spec
      </button>
      <button type="button" className="btn" disabled={!spec} onClick={() => spec && exportCollectionSpecificationFile(spec, seed)}>
        💾 Export Collection Spec
      </button>

      <button type="button" className="btn" onClick={() => trendPackFileInput.current?.click()}>
        📂 Import Trend Pack
      </button>
      <input
        ref={trendPackFileInput}
        type="file"
        accept="application/json"
        className="workbench-hidden-file-input"
        onChange={(e) => {
          void handleTrendPackFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button type="button" className="btn" disabled={!selectedTrendPack} onClick={() => selectedTrendPack && exportTrendPackFile(selectedTrendPack)}>
        💾 Export Trend Pack
      </button>

      <button type="button" className="btn" onClick={() => marketplaceFileInput.current?.click()}>
        📂 Import Marketplace Profile
      </button>
      <input
        ref={marketplaceFileInput}
        type="file"
        accept="application/json"
        className="workbench-hidden-file-input"
        onChange={(e) => {
          void handleMarketplaceFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button type="button" className="btn" disabled={!spec} onClick={() => spec && exportMarketplaceProfileFile(spec.marketplace.id)}>
        💾 Export Marketplace Profile
      </button>

      <button type="button" className="btn" onClick={() => settingsFileInput.current?.click()}>
        📂 Import Workspace Settings
      </button>
      <input
        ref={settingsFileInput}
        type="file"
        accept="application/json"
        className="workbench-hidden-file-input"
        onChange={(e) => {
          void handleSettingsFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button type="button" className="btn" onClick={() => exportWorkspaceSettingsFile(workspaceSettings)}>
        💾 Export Workspace Settings
      </button>

      {marketplaceImportNote && <p className="metadata-hint">{marketplaceImportNote}</p>}
    </div>
  );
}
