import { useCallback, useEffect, useState } from 'react';
import type { GenerateParams } from './engine/types';
import { buildTile } from './engine/tile';
import { defaultParams, randomizedParams } from './engine/defaults';
import { randomSeed } from './engine/rng';
import { buildSingleTileSvg, buildTiledSvg, downloadSvgFile } from './export/svgExporter';
import { ControlPanel } from './components/ControlPanel';
import { PreviewCanvas } from './components/PreviewCanvas';
import { Gallery, type GalleryItem } from './components/Gallery';
import './App.css';

const GALLERY_STORAGE_KEY = 'vsp-gallery-v1';
const GALLERY_LIMIT = 24;

function loadGallery(): GalleryItem[] {
  try {
    const raw = localStorage.getItem(GALLERY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GalleryItem[]) : [];
  } catch {
    return [];
  }
}

function saveGallery(items: GalleryItem[]) {
  try {
    localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(items.slice(0, GALLERY_LIMIT)));
  } catch {
    // localStorage full or unavailable — gallery just stays session-only.
  }
}

function App() {
  const [params, setParams] = useState<GenerateParams>(defaultParams);
  const [tileData, setTileData] = useState(() => buildTile(defaultParams()));
  const [gallery, setGallery] = useState<GalleryItem[]>(loadGallery);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => saveGallery(gallery), [gallery]);

  const handleChange = useCallback((patch: Partial<GenerateParams>) => {
    setParams((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleGenerate = useCallback(() => {
    const next = buildTile(params);
    setTileData(next);
    const item: GalleryItem = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tileData: next, createdAt: Date.now() };
    setGallery((prev) => [item, ...prev].slice(0, GALLERY_LIMIT));
    setSelectedId(item.id);
  }, [params]);

  const handleRandomizeAll = useCallback(() => {
    setParams((prev) => randomizedParams(prev));
  }, []);

  const handleGenerateBatch = useCallback(() => {
    const items: GalleryItem[] = [];
    let latest = tileData;
    for (let i = 0; i < 9; i++) {
      const variantParams = { ...randomizedParams(params), seed: randomSeed() };
      const data = buildTile(variantParams);
      latest = data;
      items.push({ id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`, tileData: data, createdAt: Date.now() });
    }
    setGallery((prev) => [...items, ...prev].slice(0, GALLERY_LIMIT));
    setTileData(latest);
    setParams(latest.params);
    setSelectedId(items[items.length - 1].id);
  }, [params, tileData]);

  const handleSelectGalleryItem = useCallback((item: GalleryItem) => {
    setTileData(item.tileData);
    setParams(item.tileData.params);
    setSelectedId(item.id);
  }, []);

  const handleRemoveGalleryItem = useCallback((id: string) => {
    setGallery((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const handleClearGallery = useCallback(() => {
    setGallery([]);
    setSelectedId(null);
  }, []);

  const handleExportSingle = useCallback(() => {
    const svg = buildSingleTileSvg(tileData);
    downloadSvgFile(`pattern-${tileData.params.categoryId}-${tileData.params.seed}.svg`, svg);
  }, [tileData]);

  const handleExportTiled = useCallback(() => {
    const svg = buildTiledSvg(tileData, 3, 3);
    downloadSvgFile(`pattern-${tileData.params.categoryId}-${tileData.params.seed}-3x3.svg`, svg);
  }, [tileData]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Vector Stock Pattern Studio</h1>
        <p>Generate seamless, fully-editable SVG patterns for stock — no external AI calls, everything runs in your browser.</p>
      </header>
      <div className="app-body">
        <ControlPanel
          params={params}
          onChange={handleChange}
          onGenerate={handleGenerate}
          onRandomizeAll={handleRandomizeAll}
          onGenerateBatch={handleGenerateBatch}
          onExportSingle={handleExportSingle}
          onExportTiled={handleExportTiled}
        />
        <main className="app-main">
          <PreviewCanvas tileData={tileData} />
          <Gallery
            items={gallery}
            selectedId={selectedId}
            onSelect={handleSelectGalleryItem}
            onRemove={handleRemoveGalleryItem}
            onClear={handleClearGallery}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
