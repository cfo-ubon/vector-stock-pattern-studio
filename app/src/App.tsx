import { useCallback, useEffect, useRef, useState } from 'react';
import type { GenerateParams } from './engine/types';
import { buildTile } from './engine/tile';
import { defaultParams, randomizedParams } from './engine/defaults';
import { randomSeed, createRng } from './engine/rng';
import { assignPortfolioDiversity } from './engine/portfolioVariety';
import { HIERARCHY_PRESETS } from './engine/hierarchy';
import { generateCandidatesChunked, pickBestCandidate, type GenerationMode, type CancelToken, type CandidateProgress } from './engine/candidateEngine';
import { buildTileWithHeroRetry, buildTileWithCommercialRetry } from './engine/heroDetector';
import type { QualityPresetId } from './engine/scoring';
import { STYLE_DNA_PRESETS, resolveStyleDna } from './engine/styleDna';
import { loadCustomStyles } from './storage/styleDnaStore';
import { generateCollection, type GeneratedCollection } from './collection/collectionGenerator';
import { buildSingleTileSvg, buildTiledSvg, downloadSvgFile, downloadBlobFile, buildExportFilename, buildFilenameParts } from './export/svgExporter';
import { buildZip, type ZipEntry } from './export/zip';
import { buildEps } from './export/epsExporter';
import { buildSeoTextFile } from './metadata/shutterstock';
import { buildShutterstockCsv, buildAdobeStockCsv } from './metadata/csv';
import { loadSavedItems, putSavedItem, bulkPutSavedItems, deleteSavedItem, clearSavedItems } from './storage/savedStore';
import { loadProjects, putProject, deleteProject } from './storage/projectStore';
import {
  createProject,
  duplicateProject,
  renameProject,
  toggleFavorite,
  toggleArchive,
  addCollectionToProject,
  setCollectionUploadStatus,
  setAssetSeoOverride,
  clearAssetSeoOverride,
  addSavedItemToProject,
  removeSavedItemFromProject,
  migrateLegacyDataIntoProject,
} from './project/projectManager';
import { exportProjectJson, importProjectJson } from './project/projectJson';
import type { Project, UploadStatus } from './project/projectTypes';
import type { AssetSeoOverride } from './collection/collectionGenerator';
import { buildPackageTextFilesFromSeo } from './metadata/exportPackage';
import type { MarketplaceSeo } from './metadata/marketplaceSeo';
import type { MarketplaceId } from './metadata/marketplaceProfiles';
import { PALETTES } from './palettes/palettes';
import { ControlPanel } from './components/ControlPanel';
import { PreviewCanvas } from './components/PreviewCanvas';
import { QualityPanel } from './components/QualityPanel';
import { TrendPanel } from './components/TrendPanel';
import { Gallery, type GalleryItem } from './components/Gallery';
import { StockSubmissionCenter } from './components/StockSubmissionCenter';
import { ProjectBar } from './components/ProjectBar';
import { ProjectDashboard } from './components/ProjectDashboard';
import { ProjectPanel } from './components/ProjectPanel';
import { SavedPanel, type SavedItem } from './components/SavedPanel';
import { AiAssistPanel } from './components/AiAssistPanel';
import { DesignWorkbench } from './components/workbench/DesignWorkbench';
import type { DesignSpecification } from './trend/designSpecTypes';
import { buildTileFromDesignSpec } from './trend/designSpecToParams';
import { buildDesignSpecPackageTextFiles } from './trend/designSpecPackage';
import { buildCollectionFromDesignSpec } from './trend/designSpecCollection';
import type { StockSiteId } from './metadata/shutterstock';
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

// Build 007, Section 7 (Commercial Composition Review): a botanical
// generation gets the broader Pattern Beauty Score-based retry (bouquet
// balance/silhouette/negative space/rhythm/repetition/commercial appeal,
// see engine/heroDetector.ts's `buildTileWithCommercialRetry`); every other
// category keeps the original Hero-Visibility-only retry unchanged, since
// this build's own mandate is the botanical illustration engine, not a
// revisit of every category's retry cadence.
function buildTileForGenerate(params: GenerateParams) {
  const isBotanical = params.categoryId === 'botanical' || (params.mixCategoryIds?.includes('botanical') ?? false);
  return isBotanical ? buildTileWithCommercialRetry(params) : buildTileWithHeroRetry(params);
}

// Collection Studio Engine — which zip folder each asset type's SVG lands
// in (Collection Export spec: Hero/Secondary/Blender/Mini/Stripe under
// patterns/, Border/Corner under their own folders, Spot/Decorative under
// sheets/, Preview under preview/).
const ASSET_FOLDER: Record<string, string> = {
  heroPattern: 'patterns', secondaryPattern: 'patterns', blenderPattern: 'patterns', miniPattern: 'patterns', stripePattern: 'patterns',
  borderPattern: 'border', cornerPattern: 'corner',
  spotMotifSheet: 'spot', decorativeElementsSheet: 'sheets', collectionPreview: 'preview',
};

function App() {
  const [params, setParams] = useState<GenerateParams>(defaultParams);
  const [tileData, setTileData] = useState(() => buildTile(defaultParams()));
  const [gallery, setGallery] = useState<GalleryItem[]>(loadGallery);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedGalleryIds, setCheckedGalleryIds] = useState<ReadonlySet<string>>(new Set());
  const [qualityMode, setQualityMode] = useState<GenerationMode>('fast');
  const [qualityPresetId, setQualityPresetId] = useState<QualityPresetId>('stockClean');
  const [candidateProgress, setCandidateProgress] = useState<CandidateProgress | null>(null);
  const [candidateSummary, setCandidateSummary] = useState<{ total: number; valid: number; score: number; preset: QualityPresetId } | null>(null);
  const [collectionStatus, setCollectionStatus] = useState<'idle' | 'building' | 'done'>('idle');
  // Tracks *which pattern's seed* the last successfully-generated Collection
  // belongs to (not just a generic building/done flag) — the Stock
  // Submission Center's "Collection Ready" checklist item compares this
  // against the currently-displayed pattern's own seed, so it correctly
  // reads as "not ready" again after switching to a different pattern
  // instead of staying stuck on "done" from an unrelated earlier one.
  const [collectionGeneratedForSeed, setCollectionGeneratedForSeed] = useState<string | null>(null);
  // Project Studio Engine (v1.34): every Collection now lives inside a
  // Project (persisted to IndexedDB), not in ephemeral React state — see
  // project/projectTypes.ts. `projects` is the full list (for the
  // Dashboard/switcher), `activeProjectId` is which one the Active-Project
  // bar currently has selected; every new Collection/saved-item is
  // attributed to it. `view` toggles the app between its default editor
  // screen and the full-screen Project Dashboard (Project Manager) — the
  // "Active-Project bar" navigation model chosen over a Figma/Canva-style
  // dashboard gate, so the editor stays the default screen.
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [view, setView] = useState<'editor' | 'dashboard' | 'trendStudio'>('editor');
  const cancelTokenRef = useRef<CancelToken | null>(null);

  useEffect(() => saveGallery(gallery), [gallery]);
  // Saved library + Projects both live in IndexedDB (effectively
  // unlimited) — load both once on mount; individual mutations write
  // through per-item/per-project in their own handlers. If this is the
  // very first load after the Project System shipped (no projects exist
  // yet), auto-migrate any pre-existing Saved Library items into one
  // default project so "everything belongs to a Project" holds
  // immediately — nothing pre-existing is orphaned or lost.
  useEffect(() => {
    (async () => {
      const [savedItems, loadedProjects] = await Promise.all([
        loadSavedItems().catch(() => [] as SavedItem[]),
        loadProjects().catch(() => [] as Project[]),
      ]);
      setSaved(savedItems);
      if (loadedProjects.length === 0) {
        const migrated = migrateLegacyDataIntoProject(savedItems);
        setProjects([migrated]);
        setActiveProjectId(migrated.id);
        void putProject(migrated);
      } else {
        setProjects(loadedProjects);
        setActiveProjectId((loadedProjects.find((p) => !p.archived) ?? loadedProjects[0]).id);
      }
    })();
  }, []);

  /** Applies `fn` to one project (by id) in state and writes the result
   * through to IndexedDB — the shared update path every Project Manager
   * action and every "attribute this new thing to the active project"
   * call site below goes through, so state and storage never drift apart. */
  const updateProject = useCallback((projectId: string, fn: (p: Project) => Project) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const next = fn(p);
        void putProject(next);
        return next;
      }),
    );
  }, []);

  const handleChange = useCallback((patch: Partial<GenerateParams>) => {
    setParams((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleGenerate = useCallback(() => {
    // Build 003, Part 11 (Hero Detector): analyzes the real Hero
    // Visibility Score right after generation and regenerates from a
    // derived sub-seed if it's poor — see engine/heroDetector.ts.
    // Build 007, Section 7 (Commercial Composition Review): a botanical
    // generation additionally gets the broader Pattern Beauty Score check
    // (bouquet balance/silhouette/negative space/rhythm/repetition/
    // commercial appeal) -- scoped to `botanical` specifically since that's
    // this build's own mandate, rather than changing retry behavior for
    // every other category no one asked to revisit.
    const next = buildTileForGenerate(params).tileData;
    setTileData(next);
    const item: GalleryItem = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tileData: next, createdAt: Date.now() };
    setGallery((prev) => [item, ...prev].slice(0, GALLERY_LIMIT));
    setSelectedId(item.id);
    setCandidateSummary(null);
  }, [params]);

  const handleRandomizeAll = useCallback(() => {
    setParams((prev) => randomizedParams(prev));
  }, []);

  // Collection Generator (the "Generate 9 variations" batch flow): when a
  // Style DNA is active, every variant re-resolves that *same* style from a
  // fresh random seed instead of fully randomizing category/layout/palette/
  // hierarchy/etc. per item — so the 9 patterns explore that style's own
  // family of looks and genuinely read as one collection, rather than 9
  // unrelated random patterns. No style active = unchanged prior behavior.
  //
  // Build 003, Part 13 (Portfolio Variety): each variant's own independent
  // random Composition Zone pick (see engine/compositionZones.ts) has no
  // memory of what earlier items in this same batch already chose — with a
  // Style DNA active, `preferredZones` pools are only 2-3 zones, so 9
  // independent draws very plausibly repeat the same whole-tile composition
  // more than once.
  //
  // Build 004, Section 11 (Portfolio Diversity Engine V2): generalizes that
  // same shuffled-bag guarantee across every other named diversity
  // dimension that has a real, directly overridable `GenerateParams` field
  // — Botanical Family, Cluster/Bouquet Type, and Hero Structure, alongside
  // the original Composition Zone — via `assignPortfolioDiversity`
  // (engine/portfolioVariety.ts). Each is narrowed to the active Style
  // DNA's own preference pool when one is set, the same way `zoneCandidates`
  // already did, so a batch still explores that style's own family of looks
  // rather than the engine's full unrestricted range.
  const handleGenerateBatch = useCallback(() => {
    const activeDna = params.styleDnaId
      ? (STYLE_DNA_PRESETS[params.styleDnaId] ?? loadCustomStyles().find((s) => s.id === params.styleDnaId))
      : undefined;
    const diversityRng = createRng(randomSeed());
    const batch = assignPortfolioDiversity(diversityRng, 9, {
      compositionZones: activeDna?.preferredZones?.length ? activeDna.preferredZones : undefined,
      botanicalFamilies: activeDna?.preferredFamilies?.length ? activeDna.preferredFamilies : undefined,
      clusterTypes: activeDna?.preferredClusterArchetypes?.length ? activeDna.preferredClusterArchetypes : undefined,
    });
    const items: GalleryItem[] = [];
    let latest = tileData;
    for (let i = 0; i < 9; i++) {
      const seed = randomSeed();
      const variantParams = {
        ...(activeDna ? { ...params, ...resolveStyleDna(activeDna, seed), seed } : { ...randomizedParams(params), seed }),
        compositionZone: batch[i].compositionZone,
        botanicalFamily: batch[i].botanicalFamily,
        clusterArchetypes: [batch[i].clusterType],
        hierarchy: HIERARCHY_PRESETS[batch[i].heroStructure].value,
      };
      // Build 003, Part 11 (Hero Detector) / Build 007, Section 7
      // (Commercial Composition Review): see handleGenerate above.
      const data = buildTileForGenerate(variantParams).tileData;
      latest = data;
      items.push({ id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`, tileData: data, createdAt: Date.now() });
    }
    setGallery((prev) => [...items, ...prev].slice(0, GALLERY_LIMIT));
    setTileData(latest);
    setParams(latest.params);
    setSelectedId(items[items.length - 1].id);
    setCandidateSummary(null);
  }, [params, tileData]);

  // Composition Candidate Engine: build a deterministic pool of candidate
  // tiles from the current seed+settings (same seed+settings+mode always
  // gives the same pool and therefore the same winner — see
  // engine/candidateEngine.ts), score each from real geometry, and keep the
  // highest-scoring non-rejected one. Chunked (one candidate per macrotask)
  // so a heavy category/layout/density combo — Botanical + Dense Premium at
  // high density can place 800+ motifs — never freezes the tab for the
  // whole pool at once.
  const handleGenerateBest = useCallback(async (modeOverride?: GenerationMode) => {
    const mode = modeOverride ?? qualityMode;
    const token: CancelToken = { cancelled: false };
    cancelTokenRef.current = token;
    setCandidateProgress({ completed: 0, total: 0 });
    setCandidateSummary(null);
    const candidates = await generateCandidatesChunked(params, mode, qualityPresetId, setCandidateProgress, token);
    if (token.cancelled || candidates.length === 0) {
      setCandidateProgress(null);
      return;
    }
    const winner = pickBestCandidate(candidates);
    setTileData(winner.tileData);
    setParams(winner.tileData.params);
    const item: GalleryItem = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tileData: winner.tileData, createdAt: Date.now() };
    setGallery((prev) => [item, ...prev].slice(0, GALLERY_LIMIT));
    setSelectedId(item.id);
    setCandidateSummary({
      total: candidates.length,
      valid: candidates.filter((c) => !c.rejected).length,
      score: winner.score,
      preset: qualityPresetId,
    });
    setCandidateProgress(null);
  }, [params, qualityMode, qualityPresetId]);

  // Direct "Generate Best of 12" shortcut — always runs the 12-candidate
  // (Premium) pool regardless of whatever the mode dropdown is currently
  // set to, without changing that dropdown's own selection.
  const handleGenerateBestOf12 = useCallback(() => {
    void handleGenerateBest('premium');
  }, [handleGenerateBest]);

  const handleCancelGenerateBest = useCallback(() => {
    if (cancelTokenRef.current) cancelTokenRef.current.cancelled = true;
    setCandidateProgress(null);
  }, []);

  // Post-gen pattern rescale: rebuild the *currently shown* tile with the
  // same seed and params but a new patternScale. Density (as a proportion)
  // is preserved automatically because layout spacing scales with motif
  // size — the composition just repeats finer or bolder. Doesn't touch the
  // gallery; press Generate to save the rescaled version as a new entry.
  const handleRescale = useCallback(
    (patternScale: number) => {
      if (!tileData) return;
      const p: GenerateParams = { ...tileData.params, patternScale };
      setTileData(buildTile(p));
      setParams(p);
    },
    [tileData],
  );

  const handleSelectGalleryItem = useCallback((item: GalleryItem) => {
    setTileData(item.tileData);
    setParams(item.tileData.params);
    setSelectedId(item.id);
    setCandidateSummary(null);
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
  const filenameParts = useCallback((data: TileData) => buildFilenameParts(data.params), []);

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
    setCandidateSummary(null);
  }, []);

  /** Filesystem-safe base name (no extension) for a pattern's files. */
  const exportBase = useCallback(
    (data: TileData) => buildExportFilename(filenameParts(data), data.params.seed).replace(/\.svg$/, ''),
    [filenameParts],
  );

  // In-app JPEG export: rasterize an SVG string to a size x size canvas and
  // download it as JPEG. Shared by the single-tile and 3x3 exports below —
  // no external editor needed for sites that want a JPEG paired with the
  // vector (e.g. Freepik).
  const rasterizeSvgToJpeg = useCallback((svgString: string, size: number, filename: string) => {
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (b) => {
          if (b) downloadBlobFile(filename, b);
        },
        'image/jpeg',
        0.92,
      );
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, []);

  const handleExportJpeg = useCallback(() => {
    rasterizeSvgToJpeg(buildSingleTileSvg(tileData), 5000, `${exportBase(tileData)}.jpg`);
  }, [tileData, exportBase, rasterizeSvgToJpeg]);

  // 3x3 tiled JPEG preview at 3000x3000 — a ready-to-upload seamless-check
  // preview image for sites that want a JPEG paired with the vector.
  const handleExportJpeg3x3 = useCallback(() => {
    rasterizeSvgToJpeg(buildTiledSvg(tileData, 3, 3), 3000, `${exportBase(tileData)}-3x3.jpg`);
  }, [tileData, exportBase, rasterizeSvgToJpeg]);

  // Direct EPS export — the format Shutterstock/Adobe Stock/Freepik accept
  // for vectors, generated in-app (verified pixel-identical to the SVG
  // under Ghostscript, the same interpreter family stock pipelines use).
  const handleExportEps = useCallback(() => {
    const eps = buildEps(tileData);
    downloadBlobFile(`${exportBase(tileData)}.eps`, new Blob([eps], { type: 'application/postscript' }));
  }, [tileData, exportBase]);

  // One-click bundle download: single tile (3000x3000) + 3x3 SVG (the zip
  // stores files byte-for-byte, nothing is downscaled or recompressed) +
  // a plain-text file with every site's SEO fields + the upload-ready EPS.
  const handleDownloadBundle = useCallback(
    (data: TileData) => {
      const base = buildExportFilename(filenameParts(data), data.params.seed).replace(/\.svg$/, '');
      const enc = new TextEncoder();
      const zip = buildZip([
        { name: `${base}.svg`, data: enc.encode(buildSingleTileSvg(data)) },
        { name: `${base}.eps`, data: enc.encode(buildEps(data)) },
        { name: `${base}-3x3.svg`, data: enc.encode(buildTiledSvg(data, 3, 3)) },
        { name: `${base}-SEO.txt`, data: enc.encode(buildSeoTextFile(data)) },
      ]);
      downloadBlobFile(`${base}-bundle.zip`, zip);
    },
    [filenameParts],
  );

  // Rasterizes an SVG string to a PNG Blob via an offscreen <canvas> —
  // same technique as rasterizeSvgToJpeg above, but Promise-based (instead
  // of taking a downloadBlobFile-calling callback) so the Collection
  // Generator can `await` it and bundle the result straight into a zip
  // rather than triggering its own separate download.
  const rasterizeSvgToPngBlob = useCallback((svgString: string, size: number): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        canvas.toBlob((b) => resolve(b), 'image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }, []);

  const buildAndDownloadCollectionZip = useCallback(async (collection: GeneratedCollection) => {
    const { manifest, assets } = collection;
    const enc = new TextEncoder();
    const files: ZipEntry[] = [];

    for (const asset of assets) {
      if (asset.svg) {
        const folder = ASSET_FOLDER[asset.type] ?? 'sheets';
        files.push({ name: `svg/${folder}/${asset.filename}`, data: enc.encode(asset.svg) });
      } else if (asset.data) {
        files.push({ name: `metadata/${asset.filename}`, data: enc.encode(JSON.stringify(asset.data, null, 2)) });
      }
    }

    const heroAsset = assets.find((a) => a.id === 'hero');
    if (heroAsset?.svg) {
      const png = await rasterizeSvgToPngBlob(heroAsset.svg, 2000);
      if (png) files.push({ name: `preview/${manifest.collectionId}-hero-preview.png`, data: new Uint8Array(await png.arrayBuffer()) });
    }

    files.push({ name: 'Collection.json', data: enc.encode(JSON.stringify(manifest, null, 2)) });

    const zip = buildZip(files);
    downloadBlobFile(`${manifest.collectionId}.zip`, zip);
  }, [rasterizeSvgToPngBlob]);

  // Marketplace Profile System — one Export Package per marketplace: the
  // pattern SVG + a rasterized PNG preview (the one DOM-dependent piece,
  // same as every other raster export in this app) + the marketplace's own
  // title/description/keywords/filename/metadata.json text files
  // (metadata/exportPackage.ts, pure/DOM-free). Takes the already-resolved
  // `MarketplaceSeo` from the caller (Marketplace Profile Selector or a
  // Stock Readiness card) instead of regenerating it, so any user edits in
  // the selector are preserved in the downloaded package.
  const handleDownloadMarketplacePackage = useCallback(
    async (marketplaceId: MarketplaceId, seo: MarketplaceSeo) => {
      if (!tileData) return;
      const enc = new TextEncoder();
      const files: ZipEntry[] = [{ name: 'pattern.svg', data: enc.encode(buildSingleTileSvg(tileData)) }];
      const png = await rasterizeSvgToPngBlob(buildSingleTileSvg(tileData), 2000);
      if (png) files.push({ name: 'preview.png', data: new Uint8Array(await png.arrayBuffer()) });
      for (const f of buildPackageTextFilesFromSeo(tileData, marketplaceId, seo)) {
        files.push({ name: f.name, data: enc.encode(f.content) });
      }
      const zip = buildZip(files);
      downloadBlobFile(`${marketplaceId}-export-package.zip`, zip);
    },
    [tileData, rasterizeSvgToPngBlob],
  );

  /** Trend Intelligence Studio: applies a generated Design Specification's
   * resolved GenerateParams straight to the main editor (same
   * setTileData+setParams pairing handleRescale already uses) and returns
   * to the editor view — the "Review & Edit" step feeding back into the
   * app's one real pattern-generation surface instead of a second,
   * parallel renderer. */
  const handleApplyDesignSpecToEditor = useCallback((next: GenerateParams) => {
    setTileData(buildTile(next));
    setParams(next);
    setView('editor');
  }, []);

  /** Trend Intelligence Studio's Marketplace Package download — same zip-
   * assembly shape as `handleDownloadMarketplacePackage` above (SVG + PNG
   * preview rasterized here, DOM-dependent; every text/JSON file comes
   * from the DOM-free trend/designSpecPackage.ts), just driven by a
   * Design Specification + seed instead of the currently-shown tile. */
  const handleDownloadDesignSpecPackage = useCallback(
    async (spec: DesignSpecification, seed: string, marketplaceId: MarketplaceId) => {
      const tile = buildTileFromDesignSpec(spec, seed);
      const enc = new TextEncoder();
      const files: ZipEntry[] = [{ name: 'pattern.svg', data: enc.encode(buildSingleTileSvg(tile)) }];
      const png = await rasterizeSvgToPngBlob(buildSingleTileSvg(tile), 2000);
      if (png) files.push({ name: 'preview.png', data: new Uint8Array(await png.arrayBuffer()) });
      for (const f of buildDesignSpecPackageTextFiles(spec, tile, marketplaceId, seed)) {
        files.push({ name: f.name, data: enc.encode(f.content) });
      }
      const zip = buildZip(files);
      downloadBlobFile(`${marketplaceId}-${spec.seoHints.primaryKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-package.zip`, zip);
    },
    [rasterizeSvgToPngBlob],
  );

  /** Trend Intelligence Studio's Collection Generator (Section 11) — same
   * shape as `handleGenerateCollection` below (build -> download zip ->
   * attribute to the active project, creating a fresh one if somehow none
   * is active), just driven by a Design Specification + seed through
   * `buildCollectionFromDesignSpec` instead of the main editor's own
   * `params`. */
  const handleGenerateCollectionFromDesignSpec = useCallback(
    async (spec: DesignSpecification, seed: string) => {
      setCollectionStatus('building');
      try {
        const activeDna = spec.styleDnaId
          ? (STYLE_DNA_PRESETS[spec.styleDnaId] ?? loadCustomStyles().find((s) => s.id === spec.styleDnaId))
          : undefined;
        const collection: GeneratedCollection = buildCollectionFromDesignSpec(spec, seed, activeDna);
        await buildAndDownloadCollectionZip(collection);
        let projectId = activeProjectId;
        if (!projectId) {
          const fresh = createProject('โปรเจกต์ใหม่');
          setProjects((prev) => [fresh, ...prev]);
          void putProject(fresh);
          setActiveProjectId(fresh.id);
          projectId = fresh.id;
        }
        updateProject(projectId, (p) => addCollectionToProject(p, collection));
        setCollectionStatus('done');
      } catch {
        setCollectionStatus('idle');
      }
    },
    [activeProjectId, updateProject, buildAndDownloadCollectionZip],
  );

  const handleGenerateCollection = useCallback(async () => {
    setCollectionStatus('building');
    try {
      const activeDna = params.styleDnaId
        ? (STYLE_DNA_PRESETS[params.styleDnaId] ?? loadCustomStyles().find((s) => s.id === params.styleDnaId))
        : undefined;
      const collection: GeneratedCollection = generateCollection(params, activeDna);
      await buildAndDownloadCollectionZip(collection);
      // "Everything must belong to a Project": if somehow nothing is
      // active (e.g. every project was deleted), create a fresh one on the
      // spot rather than silently dropping the collection just generated.
      let projectId = activeProjectId;
      if (!projectId) {
        const fresh = createProject('โปรเจกต์ใหม่');
        setProjects((prev) => [fresh, ...prev]);
        void putProject(fresh);
        setActiveProjectId(fresh.id);
        projectId = fresh.id;
      }
      updateProject(projectId, (p) => addCollectionToProject(p, collection));
      setCollectionStatus('done');
      setCollectionGeneratedForSeed(params.seed);
    } catch {
      setCollectionStatus('idle');
    }
  }, [params, buildAndDownloadCollectionZip, activeProjectId, updateProject]);

  const handleExportCollectionZip = useCallback(
    (collectionEntryId: string) => {
      const project = projects.find((p) => p.id === activeProjectId);
      const entry = project?.collections.find((c) => c.id === collectionEntryId);
      if (entry) void buildAndDownloadCollectionZip(entry.collection);
    },
    [projects, activeProjectId, buildAndDownloadCollectionZip],
  );

  const handleSetUploadStatus = useCallback(
    (collectionEntryId: string, site: StockSiteId, status: UploadStatus) => {
      if (!activeProjectId) return;
      updateProject(activeProjectId, (p) => setCollectionUploadStatus(p, collectionEntryId, site, status));
    },
    [activeProjectId, updateProject],
  );

  const handleSetAssetSeoOverride = useCallback(
    (collectionEntryId: string, assetId: string, marketplaceId: MarketplaceId, override: AssetSeoOverride) => {
      if (!activeProjectId) return;
      updateProject(activeProjectId, (p) => setAssetSeoOverride(p, collectionEntryId, assetId, marketplaceId, override));
    },
    [activeProjectId, updateProject],
  );

  const handleClearAssetSeoOverride = useCallback(
    (collectionEntryId: string, assetId: string, marketplaceId: MarketplaceId) => {
      if (!activeProjectId) return;
      updateProject(activeProjectId, (p) => clearAssetSeoOverride(p, collectionEntryId, assetId, marketplaceId));
    },
    [activeProjectId, updateProject],
  );

  // --- Project Manager (Create/Open/Duplicate/Rename/Archive/Delete/
  // Favorite) — every action here is a pure projectManager.ts transform
  // applied via updateProject, which writes through to IndexedDB. ---
  const handleCreateProject = useCallback(() => {
    const name = window.prompt('ตั้งชื่อโปรเจกต์ใหม่', 'โปรเจกต์ใหม่');
    if (!name || !name.trim()) return;
    const project = createProject(name.trim());
    setProjects((prev) => [project, ...prev]);
    void putProject(project);
    setActiveProjectId(project.id);
  }, []);

  const handleSwitchProject = useCallback((id: string) => setActiveProjectId(id), []);

  const handleOpenProjectFromDashboard = useCallback((id: string) => {
    setActiveProjectId(id);
    setView('editor');
  }, []);

  const handleDuplicateProject = useCallback(
    (id: string) => {
      const project = projects.find((p) => p.id === id);
      if (!project) return;
      const dup = duplicateProject(project);
      setProjects((prev) => [dup, ...prev]);
      void putProject(dup);
    },
    [projects],
  );

  const handleRenameProject = useCallback(
    (id: string, name: string) => updateProject(id, (p) => renameProject(p, name)),
    [updateProject],
  );

  const handleToggleArchiveProject = useCallback((id: string) => updateProject(id, (p) => toggleArchive(p)), [updateProject]);
  const handleToggleFavoriteProject = useCallback((id: string) => updateProject(id, (p) => toggleFavorite(p)), [updateProject]);

  const handleDeleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    void deleteProject(id);
    setActiveProjectId((prev) => (prev === id ? null : prev));
  }, []);

  const handleExportProjectJson = useCallback(
    (id: string) => {
      const project = projects.find((p) => p.id === id);
      if (!project) return;
      const slug = project.name.toLowerCase().replace(/[^a-z0-9ก-๙]+/gi, '-').replace(/^-+|-+$/g, '') || 'project';
      downloadBlobFile(`${slug}-project.json`, new Blob([exportProjectJson(project)], { type: 'application/json' }));
    },
    [projects],
  );

  const handleImportProjectJson = useCallback((file: File) => {
    file
      .text()
      .then((text) => {
        const result = importProjectJson(text);
        if (!result.ok || !result.project) {
          window.alert(result.error ?? 'นำเข้าไม่สำเร็จ');
          return;
        }
        const imported = result.project;
        setProjects((prev) => (prev.some((p) => p.id === imported.id) ? prev.map((p) => (p.id === imported.id ? imported : p)) : [imported, ...prev]));
        void putProject(imported);
      })
      .catch(() => window.alert('อ่านไฟล์ไม่สำเร็จ — ตรวจว่าเลือกไฟล์ Project JSON ที่ถูกต้อง'));
  }, []);

  // --- Saved library (คลังลายที่บันทึก): long-term keeps with per-site
  // submission tracking, independent of the rolling Gallery. Saving also
  // auto-downloads the full bundle so the files land on the user's machine
  // the moment they decide a pattern is a keeper. ---
  const handleSaveCurrent = useCallback(() => {
    if (!tileData) return;
    const item: SavedItem = {
      id: `${Date.now()}-sv-${Math.random().toString(36).slice(2, 8)}`,
      tileData,
      name: filenameParts(tileData).join(' · '),
      createdAt: Date.now(),
      note: '',
      submissions: {},
    };
    setSaved((prev) => [item, ...prev]);
    void putSavedItem(item);
    if (activeProjectId) updateProject(activeProjectId, (p) => addSavedItemToProject(p, item.id));
    handleDownloadBundle(tileData);
  }, [tileData, filenameParts, handleDownloadBundle, activeProjectId, updateProject]);

  const handleLoadSaved = useCallback((item: SavedItem) => {
    setTileData(item.tileData);
    setParams(item.tileData.params);
    setCandidateSummary(null);
  }, []);

  const handleRemoveSaved = useCallback((id: string) => {
    setSaved((prev) => prev.filter((s) => s.id !== id));
    void deleteSavedItem(id);
    // Also drop the now-dangling reference from whichever project(s) held
    // it, so a Project's savedItemIds never points at a deleted item.
    setProjects((prev) =>
      prev.map((p) => {
        if (!p.savedItemIds.includes(id)) return p;
        const next = removeSavedItemFromProject(p, id);
        void putProject(next);
        return next;
      }),
    );
  }, []);

  /** Update one saved item in state and write it through to IndexedDB. */
  const updateSavedItem = useCallback((id: string, patch: (s: SavedItem) => SavedItem) => {
    setSaved((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const next = patch(s);
        queueMicrotask(() => void putSavedItem(next));
        return next;
      }),
    );
  }, []);

  const handleToggleSubmission = useCallback(
    (id: string, site: StockSiteId) => {
      updateSavedItem(id, (s) => ({ ...s, submissions: { ...s.submissions, [site]: !s.submissions[site] } }));
    },
    [updateSavedItem],
  );

  const handleSavedNoteChange = useCallback(
    (id: string, note: string) => {
      updateSavedItem(id, (s) => ({ ...s, note }));
    },
    [updateSavedItem],
  );

  // Gallery multi-select → batch save-to-library (silent: no per-item
  // download spam; the move-to-disk zip hands over all files at once).
  const handleToggleGalleryCheck = useCallback((id: string) => {
    setCheckedGalleryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSaveCheckedGallery = useCallback(() => {
    const picked = gallery.filter((g) => checkedGalleryIds.has(g.id));
    if (picked.length === 0) return;
    const stamp = Date.now();
    const items: SavedItem[] = picked.map((g, i) => ({
      id: `${stamp}-gv${i}-${Math.random().toString(36).slice(2, 6)}`,
      tileData: g.tileData,
      name: filenameParts(g.tileData).join(' · '),
      createdAt: stamp - i,
      note: '',
      submissions: {},
    }));
    setSaved((prev) => [...items, ...prev]);
    void bulkPutSavedItems(items);
    if (activeProjectId) updateProject(activeProjectId, (p) => items.reduce((acc, it) => addSavedItemToProject(acc, it.id), p));
    setCheckedGalleryIds(new Set());
  }, [gallery, checkedGalleryIds, filenameParts, activeProjectId, updateProject]);

  // Colorway collection: rebuild the current pattern (same seed, same
  // composition) once per palette and save the whole set into the library
  // in one click. No per-item auto-download here — 18 zips at once would
  // be download spam; "ย้ายทั้งคลังลงเครื่อง" hands over the whole set as
  // one file instead.
  const handleColorwayAll = useCallback(() => {
    if (!tileData) return;
    const ok = window.confirm(
      `จะสร้างลายนี้ (seed เดิม องค์ประกอบเดิม) ครบทุกชุดสี ${PALETTES.length} แบบ แล้วบันทึกเข้าคลังทั้งชุด\n\n` +
        `ไม่มีการดาวน์โหลดทีละไฟล์ — พอพร้อมค่อยกด "ย้ายทั้งคลังลงเครื่อง" เพื่อรับไฟล์ทั้งหมด (พร้อม CSV) ทีเดียว — ดำเนินการเลยหรือไม่?`,
    );
    if (!ok) return;
    const stamp = Date.now();
    const items: SavedItem[] = PALETTES.map((p, i) => {
      const data = buildTile({ ...tileData.params, paletteId: p.id, customColors: undefined });
      return {
        id: `${stamp}-cw${i}-${Math.random().toString(36).slice(2, 6)}`,
        tileData: data,
        name: filenameParts(data).join(' · '),
        createdAt: stamp - i, // keep palette order stable in the newest-first list
        note: '',
        submissions: {},
      };
    });
    setSaved((prev) => [...items, ...prev]);
    void bulkPutSavedItems(items);
    if (activeProjectId) updateProject(activeProjectId, (p) => items.reduce((acc, it) => addSavedItemToProject(acc, it.id), p));
  }, [tileData, filenameParts, activeProjectId, updateProject]);

  // Standalone CSV downloads (the same CSVs also ship inside the
  // move-to-disk zip). Filenames use .eps since that's what actually gets
  // uploaded to these sites after the Affinity conversion.
  const handleExportCsv = useCallback(
    (site: 'shutterstock' | 'adobestock') => {
      if (saved.length === 0) return;
      const filenameFor = (item: SavedItem) => `${exportBase(item.tileData)}.eps`;
      const csv = site === 'shutterstock' ? buildShutterstockCsv(saved, filenameFor) : buildAdobeStockCsv(saved, filenameFor);
      const date = new Date().toISOString().slice(0, 10);
      // UTF-8 BOM so Excel opens the CSV correctly.
      downloadBlobFile(`${site}-metadata-${date}.csv`, new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    },
    [saved, exportBase],
  );

  // "ย้ายทั้งคลังลงเครื่อง": one zip with a folder per pattern (single tile
  // + 3x3 + SEO, all full-size) plus library-backup.json carrying every
  // item's params/notes/submission states. After the download is handed to
  // the browser the online-side library is cleared automatically — the
  // backup json inside the zip can restore everything via นำเข้า backup.
  const handleMoveLibraryToDisk = useCallback(() => {
    if (saved.length === 0) return;
    const ok = window.confirm(
      `จะดาวน์โหลดทั้งคลัง (${saved.length} ลาย) เป็นไฟล์ zip เดียว แล้วล้างคลังในแอปอัตโนมัติ\n\n` +
        `ใน zip มีไฟล์ครบทุกลาย (ภาพเดี่ยว + 3×3 + SEO) และไฟล์ library-backup.json ` +
        `ที่ใช้กู้คลังกลับมาได้ทั้งหมดผ่านปุ่ม "นำเข้า backup" — ดำเนินการเลยหรือไม่?`,
    );
    if (!ok) return;
    const enc = new TextEncoder();
    const entries: ZipEntry[] = [];
    saved.forEach((item, i) => {
      const base = exportBase(item.tileData);
      const folder = `${String(i + 1).padStart(3, '0')}-${base}`;
      entries.push(
        { name: `${folder}/${base}.svg`, data: enc.encode(buildSingleTileSvg(item.tileData)) },
        { name: `${folder}/${base}.eps`, data: enc.encode(buildEps(item.tileData)) },
        { name: `${folder}/${base}-3x3.svg`, data: enc.encode(buildTiledSvg(item.tileData, 3, 3)) },
        { name: `${folder}/${base}-SEO.txt`, data: enc.encode(buildSeoTextFile(item.tileData)) },
      );
    });
    // Batch-upload metadata CSVs for the two sites that support them, with
    // filenames matching the .eps each SVG becomes after conversion.
    const filenameFor = (item: SavedItem) => `${exportBase(item.tileData)}.eps`;
    entries.push(
      { name: 'shutterstock-metadata.csv', data: enc.encode(buildShutterstockCsv(saved, filenameFor)) },
      { name: 'adobestock-metadata.csv', data: enc.encode(buildAdobeStockCsv(saved, filenameFor)) },
      { name: 'library-backup.json', data: enc.encode(JSON.stringify(saved)) },
    );
    const date = new Date().toISOString().slice(0, 10);
    downloadBlobFile(`pattern-library-${date}.zip`, buildZip(entries));
    setSaved([]);
    void clearSavedItems();
  }, [saved, exportBase]);

  // Restore a library (or merge one from another machine) from the
  // library-backup.json inside a moved-to-disk zip.
  const handleImportLibrary = useCallback((file: File) => {
    file
      .text()
      .then((text) => {
        const data = JSON.parse(text) as SavedItem[];
        const valid = Array.isArray(data) ? data.filter((s) => s && typeof s.id === 'string' && s.tileData?.params) : [];
        if (valid.length === 0) {
          window.alert('ไฟล์นี้ไม่ใช่ library-backup.json ที่ถูกต้อง');
          return;
        }
        setSaved((prev) => {
          const existing = new Set(prev.map((s) => s.id));
          const merged = [...valid.filter((s) => !existing.has(s.id)), ...prev].sort((a, b) => b.createdAt - a.createdAt);
          return merged;
        });
        void bulkPutSavedItems(valid);
      })
      .catch(() => window.alert('อ่านไฟล์ไม่สำเร็จ — ตรวจว่าเลือกไฟล์ library-backup.json'));
  }, []);

  const handleAiApply = useCallback(
    (patches: Partial<GenerateParams>[], concepts: string[]) => {
      const items: GalleryItem[] = [];
      let latest: TileData | null = null;
      const base = defaultParams();
      patches.forEach((patch, i) => {
        const merged: GenerateParams = { ...base, ...params, customColors: undefined, mixCategoryIds: undefined, patternScale: 1, ...patch };
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
      <ProjectBar
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitch={handleSwitchProject}
        onCreate={handleCreateProject}
        onOpenDashboard={() => setView('dashboard')}
        onOpenTrendStudio={() => setView('trendStudio')}
      />
      {view === 'trendStudio' ? (
        <DesignWorkbench
          onApplyToEditor={handleApplyDesignSpecToEditor}
          onDownloadPackage={handleDownloadDesignSpecPackage}
          onGenerateCollection={handleGenerateCollectionFromDesignSpec}
          collectionStatus={collectionStatus}
          activeProject={projects.find((p) => p.id === activeProjectId) ?? null}
          onSaveProject={(updated) => updateProject(updated.id, () => updated)}
          onClose={() => setView('editor')}
          allProjects={projects}
          onSwitchProject={handleSwitchProject}
        />
      ) : view === 'dashboard' ? (
        <ProjectDashboard
          projects={projects}
          activeProjectId={activeProjectId}
          onOpen={handleOpenProjectFromDashboard}
          onDuplicate={handleDuplicateProject}
          onRename={handleRenameProject}
          onToggleArchive={handleToggleArchiveProject}
          onToggleFavorite={handleToggleFavoriteProject}
          onDelete={handleDeleteProject}
          onCreate={handleCreateProject}
          onClose={() => setView('editor')}
          onExportJson={handleExportProjectJson}
          onImportJson={handleImportProjectJson}
        />
      ) : (
      <div className="app-body">
        <ControlPanel
          params={params}
          onChange={handleChange}
          onGenerate={handleGenerate}
          onRandomizeAll={handleRandomizeAll}
          onGenerateBatch={handleGenerateBatch}
          qualityMode={qualityMode}
          onQualityModeChange={setQualityMode}
          qualityPresetId={qualityPresetId}
          onQualityPresetChange={setQualityPresetId}
          onGenerateBest={handleGenerateBest}
          onGenerateBestOf12={handleGenerateBestOf12}
          onCancelGenerateBest={handleCancelGenerateBest}
          candidateProgress={candidateProgress}
          onExportSingle={handleExportSingle}
          onExportTiled={handleExportTiled}
          onExportEps={handleExportEps}
          onExportJpeg={handleExportJpeg}
          onExportJpeg3x3={handleExportJpeg3x3}
          onColorwayAll={handleColorwayAll}
          onReset={handleReset}
          onGenerateCollection={handleGenerateCollection}
          collectionStatus={collectionStatus}
          aiPanel={<AiAssistPanel onApply={handleAiApply} />}
        />
        <main className="app-main">
          <PreviewCanvas tileData={tileData} onRescale={handleRescale} />
          <QualityPanel tileData={tileData} candidateSummary={candidateSummary} />
          <TrendPanel tileData={tileData} />
          <Gallery
            items={gallery}
            selectedId={selectedId}
            onSelect={handleSelectGalleryItem}
            onRemove={handleRemoveGalleryItem}
            onClear={handleClearGallery}
            checkedIds={checkedGalleryIds}
            onToggleCheck={handleToggleGalleryCheck}
            onSaveChecked={handleSaveCheckedGallery}
          />
          <ProjectPanel
            project={projects.find((p) => p.id === activeProjectId) ?? null}
            building={collectionStatus === 'building'}
            onExportCollectionZip={handleExportCollectionZip}
            onSetUploadStatus={handleSetUploadStatus}
            onSetAssetSeoOverride={handleSetAssetSeoOverride}
            onClearAssetSeoOverride={handleClearAssetSeoOverride}
          />
          <StockSubmissionCenter
            tileData={tileData}
            saved={saved}
            collectionGeneratedForSeed={collectionGeneratedForSeed}
            onDownloadPackage={handleDownloadMarketplacePackage}
          />
          <SavedPanel
            items={saved}
            hasCurrent={!!tileData}
            onSaveCurrent={handleSaveCurrent}
            onLoad={handleLoadSaved}
            onRemove={handleRemoveSaved}
            onToggleSubmission={handleToggleSubmission}
            onNoteChange={handleSavedNoteChange}
            onDownload={(item) => handleDownloadBundle(item.tileData)}
            onMoveAllToDisk={handleMoveLibraryToDisk}
            onImportBackup={handleImportLibrary}
            onExportCsv={handleExportCsv}
          />
        </main>
      </div>
      )}
    </div>
  );
}

export default App;
