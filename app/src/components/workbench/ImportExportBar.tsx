import { useRef } from 'react';
import type { DesignSpecification } from '../../trend/designSpecTypes';
import type { TrendPack } from '../../trend/trendPacks';
import {
  exportDesignSpecificationFile,
  readDesignSpecificationFile,
  exportTrendPackFile,
  readTrendPackFile,
} from '../../workbench/workbenchImportExport';

// Design Workbench Section 9 ("Import / Export"). Thin file-picker glue
// over workbench/workbenchImportExport.ts — no parsing/serialization logic
// lives here.

interface Props {
  spec: DesignSpecification | null;
  onImportSpec: (spec: DesignSpecification) => void;
  onImportError: (message: string) => void;
  selectedTrendPack: TrendPack | null;
  onImportTrendPack: (pack: TrendPack) => void;
}

export function ImportExportBar({ spec, onImportSpec, onImportError, selectedTrendPack, onImportTrendPack }: Props) {
  const specFileInput = useRef<HTMLInputElement>(null);
  const trendPackFileInput = useRef<HTMLInputElement>(null);

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
    </div>
  );
}
