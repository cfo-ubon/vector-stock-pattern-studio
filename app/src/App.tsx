import { useCallback, useEffect, useState } from 'react';
import type { GenerateParams } from './engine/types';
import { buildTile } from './engine/tile';
import { defaultParams, randomizedParams } from './engine/defaults';
import { randomSeed } from './engine/rng';
import { buildSingleTileSvg, buildTiledSvg, downloadSvgFile, buildExportFilename } from './export/svgExporter';
import { GENERATORS } from './generators';
import { getPalette } from './palettes/palettes';
import { LAYOUTS } from './layouts';
import { ControlPanel } from './components/ControlPanel';
import { PreviewCanvas } from './components/PreviewCanvas';
import { Gallery, type GalleryItem } from './components/Gallery';
import { MetadataPanel } from './components/MetadataPanel';
import { AiAssistPanel } from './components/AiAssistPanel';
import type { TileData } from './engine/types';
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

  // Filename mirrors what the pattern looks like: palette (or "custom
  // colors"), category and layout, so exported files are self-describing
  // in a folder full of downloads.
  const filenameParts = useCallback((data: TileData) => {
    const p = data.params;
    const paletteName = p.customColors?.length ? 'custom colors' : getPalette(p.paletteId).label;
    const categoryName =
      p.mixCategoryIds && p.mixCategoryIds.length >= 2
        ? `mix ${p.mixCategoryIds.map((id) => GENERATORS[id]?.label ?? id).join(' x ')}`
        : (GENERATORS[p.categoryId]?.label ?? p.categoryId);
    const layoutName = LAYOUTS[p.layoutId]?.label ?? p.layoutId;
    return [paletteName, categoryName, layoutName];
  }, []);

  const handleExportSingle = useCallback(() => {
    const svg = buildSingleTileSvg(tileData);
    downloadSvgFile(buildExportFilename(filenameParts(tileData), tileData.params.seed), svg);
  }, [tileData, filenameParts]);

  const handleExportTiled = useCallback(() => {
    const svg = buildTiledSvg(tileData, 3, 3);
    downloadSvgFile(buildExportFilename(filenameParts(tileData), tileData.params.seed, '-3x3'), svg);
  }, [tileData, filenameParts]);

  const handleReset = useCallback(() => {
    const fresh = defaultParams();
    setParams(fresh);
    setTileData(buildTile(fresh));
    setSelectedId(null);
  }, []);

  const handleAiApply = useCallback(
    (patches: Partial<GenerateParams>[], concepts: string[]) => {
      const items: GalleryItem[] = [];
      let latest: TileData | null = null;
      const base = defaultParams();
      patches.forEach((patch, i) => {
        const merged: GenerateParams = { ...base, ...params, customColors: undefined, mixCategoryIds: undefined, ...patch };
        const data = buildTile(merged);
        latest = data;
        items.push({ id: `${Date.now()}-ai${i}-${Math.random().toString(36).slice(2, 6)}`, tileData: data, createdAt: Date.now() });
      });
      void concepts;
      if (!latest) return;
      setGallery((prev) => [...items, ...prev].slice(0, GALLERY_LIMIT));
      setTileData(latest);
      setParams((latest as TileData).params);
      setSelectedId(items[items.length - 1].id);
    },
    [params],
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Vector Stock Pattern Studio</h1>
          <p>Generate seamless, fully-editable SVG patterns for stock — no external AI calls, everything runs in your browser.</p>
        </div>
        <a
          className="guide-link"
          href="https://github.com/cfo-ubon/vector-stock-pattern-studio/blob/main/docs/USER_GUIDE.md"
          target="_blank"
          rel="noreferrer"
        >
          📖 คู่มือการใช้งาน
        </a>
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
          onReset={handleReset}
          aiPanel={<AiAssistPanel onApply={handleAiApply} />}
        />
        <main className="app-main">
          <PreviewCanvas tileData={tileData} />
          <MetadataPanel tileData={tileData} />
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
