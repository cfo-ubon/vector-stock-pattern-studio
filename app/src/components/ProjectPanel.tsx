import { useEffect, useMemo, useState } from 'react';
import type { Project, ProjectCollectionEntry } from '../project/projectTypes';
import type { UploadStatus } from '../project/projectTypes';
import type { AssetSeoOverride, CollectionAsset } from '../collection/collectionGenerator';
import { computeCollectionScore } from '../collection/collectionScore';
import { reviewProject } from '../project/designerAssistant';
import { buildTile } from '../engine/tile';
import type { GenerateParams } from '../engine/types';
import { buildSiteMetadata, STOCK_SITES, type StockSiteId } from '../metadata/shutterstock';
import { analyzeSeo } from '../metadata/submissionCenter';
import { downloadSvgFile, downloadBlobFile, buildExportFilename, buildFilenameParts } from '../export/svgExporter';
import { scoreColor } from './scoreColor';
import { MARKETPLACE_LIST, type MarketplaceId } from '../metadata/marketplaceProfiles';
import { generateMarketplaceSeo } from '../metadata/marketplaceSeo';
import { validateMarketplaceSeo, isMarketplaceReady } from '../metadata/marketplaceValidation';

interface Props {
  project: Project | null;
  /** Whether "Generate Collection" (the ControlPanel button — the single
   * entry point for creating a Collection, not duplicated here) is
   * currently running, so the Collection Browser heading can reflect it. */
  building: boolean;
  onExportCollectionZip: (collectionEntryId: string) => void;
  onSetUploadStatus: (collectionEntryId: string, site: StockSiteId, status: UploadStatus) => void;
  /** Saves/clears one marketplace's SEO override on one asset — the
   * "Project > Collection > Asset > SEO > {marketplace}" storage tree.
   * Lives in App.tsx since it goes through the same updateProject/
   * putProject persistence path as every other project mutation. */
  onSetAssetSeoOverride: (collectionEntryId: string, assetId: string, marketplaceId: MarketplaceId, override: AssetSeoOverride) => void;
  onClearAssetSeoOverride: (collectionEntryId: string, assetId: string, marketplaceId: MarketplaceId) => void;
}

const SCORE_ROWS: Array<{ key: keyof ReturnType<typeof computeCollectionScore>; label: string }> = [
  { key: 'styleConsistency', label: 'Style Consistency' },
  { key: 'paletteConsistency', label: 'Palette Consistency' },
  { key: 'motifConsistency', label: 'Motif Consistency' },
  { key: 'flowConsistency', label: 'Flow Consistency' },
  { key: 'commercialReadiness', label: 'Commercial Readiness' },
];

const UPLOAD_STATUS_OPTIONS: Array<{ value: UploadStatus; label: string }> = [
  { value: 'pending', label: '⏳ Pending' },
  { value: 'ready', label: '✅ Ready' },
  { value: 'uploaded', label: '📤 Uploaded' },
  { value: 'rejected', label: '❌ Rejected' },
];

function assetPreviewHtml(asset: CollectionAsset): string {
  if (!asset.svg) return '';
  return asset.svg.replace(/^<\?xml[^>]*\?>\s*/, '');
}

function downloadAsset(asset: CollectionAsset) {
  if (asset.svg) {
    downloadSvgFile(asset.filename, asset.svg);
  } else if (asset.data) {
    downloadBlobFile(asset.filename, new Blob([JSON.stringify(asset.data, null, 2)], { type: 'application/json' }));
  }
}

/** Maps the 5 pattern-type asset ids to their index in `patternParams`
 * (fixed Hero/Secondary/Blender/Mini/Stripe order — see
 * collectionGenerator.ts's `generateCollection`) so the editor can offer
 * "auto-fill from generated" for those assets specifically; every other
 * asset type (border/corner/sheets/preview/metadata/seoPackage) has no
 * underlying pattern to auto-generate from and is manual-entry-only. */
const PATTERN_ASSET_INDEX: Record<string, number> = { hero: 0, secondary: 1, blender: 2, mini: 3, stripe: 4 };

/** Per-asset, per-marketplace SEO override editor — the "Project >
 * Collection > Asset > SEO > {marketplace}" storage tree the Marketplace
 * Profile System spec asks for. Manual-entry by default (every asset type
 * can carry its own title/description/keywords/filename per marketplace);
 * the 5 pattern-type assets additionally get an "auto-fill" shortcut that
 * pulls from the same generator the Marketplace Profile Selector uses. */
function AssetSeoEditor({
  asset,
  patternParams,
  onSet,
  onClear,
}: {
  asset: CollectionAsset;
  patternParams: GenerateParams[];
  onSet: (marketplaceId: MarketplaceId, override: AssetSeoOverride) => void;
  onClear: (marketplaceId: MarketplaceId) => void;
}) {
  const [marketplaceId, setMarketplaceId] = useState<MarketplaceId>('shutterstock');
  const profile = MARKETPLACE_LIST.find((p) => p.id === marketplaceId)!;
  const override = asset.seo?.[marketplaceId];
  const patternIndex = PATTERN_ASSET_INDEX[asset.id];

  const generated = useMemo(() => {
    if (patternIndex === undefined) return null;
    return generateMarketplaceSeo(buildTile(patternParams[patternIndex]), marketplaceId);
  }, [patternIndex, patternParams, marketplaceId]);

  const seo = useMemo(
    () => ({
      title: override?.title ?? generated?.title ?? '',
      description: override?.description ?? generated?.description ?? '',
      keywords: override?.keywords ?? generated?.keywords ?? [],
      filename: override?.filename ?? generated?.filename ?? asset.filename,
    }),
    [override, generated, asset.filename],
  );

  const issues = useMemo(
    () => validateMarketplaceSeo({ marketplaceId, ...seo }, profile),
    [marketplaceId, seo, profile],
  );
  const ready = isMarketplaceReady(issues);

  return (
    <div className="asset-seo-editor">
      <h5>🏪 SEO ต่อ Marketplace (บันทึกแยกในตัวชิ้นงานนี้)</h5>
      <div className="marketplace-chips">
        {MARKETPLACE_LIST.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`marketplace-chip${p.id === marketplaceId ? ' active' : ''}`}
            onClick={() => setMarketplaceId(p.id)}
          >
            {p.label}
            {p.future && ' 🔜'}
          </button>
        ))}
      </div>
      <div className="asset-seo-fields">
        <label>
          Title
          <textarea rows={2} value={seo.title} onChange={(e) => onSet(marketplaceId, { ...override, title: e.target.value })} />
        </label>
        {(profile.descriptionRules.required || seo.description) && (
          <label>
            Description
            <textarea rows={3} value={seo.description} onChange={(e) => onSet(marketplaceId, { ...override, description: e.target.value })} />
          </label>
        )}
        <label>
          {profile.keywordRules.termLabel === 'tags' ? 'Tags' : 'Keywords'}
          <textarea
            rows={2}
            value={seo.keywords.join(', ')}
            onChange={(e) => onSet(marketplaceId, { ...override, keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) })}
          />
        </label>
        <label>
          Filename
          <input type="text" value={seo.filename} onChange={(e) => onSet(marketplaceId, { ...override, filename: e.target.value })} />
        </label>
      </div>
      <div className="asset-seo-actions">
        {generated && (
          <button type="button" className="btn" onClick={() => onSet(marketplaceId, { title: generated.title, description: generated.description, keywords: generated.keywords, filename: generated.filename })}>
            ✨ Auto-fill จากที่ระบบสร้าง
          </button>
        )}
        {override && (
          <button type="button" className="btn" onClick={() => onClear(marketplaceId)}>
            ↺ ล้างค่าที่แก้ไข
          </button>
        )}
      </div>
      <div className={`marketplace-ready-indicator marketplace-ready-indicator--${ready ? 'ready' : 'issues'}`}>
        {ready ? '✅ พร้อมส่ง (Ready)' : `⚠️ มี ${issues.filter((i) => i.severity === 'error').length} ปัญหาที่ต้องแก้ก่อนส่ง`}
      </div>
    </div>
  );
}

/** Collection Browser (list every Collection saved to the active Project)
 * + Asset Browser (browse the selected Collection's own assets, reusing
 * v1.33's CollectionWorkspace asset-switcher UI) + Metadata Browser +
 * Upload Tracker for that Collection. */
function CollectionAndAssetBrowser({
  entry,
  onExportZip,
  onSetUploadStatus,
  onSetAssetSeoOverride,
  onClearAssetSeoOverride,
}: {
  entry: ProjectCollectionEntry;
  onExportZip: () => void;
  onSetUploadStatus: (site: StockSiteId, status: UploadStatus) => void;
  onSetAssetSeoOverride: (assetId: string, marketplaceId: MarketplaceId, override: AssetSeoOverride) => void;
  onClearAssetSeoOverride: (assetId: string, marketplaceId: MarketplaceId) => void;
}) {
  const { collection } = entry;
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(collection.assets[0]?.id ?? null);
  useEffect(() => {
    if (!collection.assets.some((a) => a.id === selectedAssetId)) setSelectedAssetId(collection.assets[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection]);

  const score = useMemo(() => computeCollectionScore(collection), [collection]);
  const selectedAsset = collection.assets.find((a) => a.id === selectedAssetId) ?? null;

  const heroTileData = useMemo(() => buildTile(collection.patternParams[0]), [collection]);
  const siteMetadata = useMemo(() => buildSiteMetadata(heroTileData), [heroTileData]);
  const seo = useMemo(() => analyzeSeo(heroTileData), [heroTileData]);
  const filename = useMemo(() => buildExportFilename(buildFilenameParts(heroTileData.params), heroTileData.params.seed), [heroTileData]);

  return (
    <div className="project-collection-detail">
      <div className="collection-actions">
        <button type="button" className="btn" onClick={onExportZip}>
          📦 Export ZIP คอลเลกชันนี้
        </button>
      </div>

      <div className="collection-score">
        <div className="quality-overall">
          <span className="quality-overall-num" style={{ color: scoreColor(score.overall) }}>
            {score.overall}
          </span>
          <span className="quality-overall-label">/ 100 Collection Score</span>
        </div>
        <div className="quality-rows">
          {SCORE_ROWS.map((r) => (
            <div className="quality-row" key={r.key}>
              <span className="quality-row-label">{r.label}</span>
              <div className="quality-bar">
                <div className="quality-bar-fill" style={{ width: `${score[r.key]}%`, background: scoreColor(score[r.key] as number) }} />
              </div>
              <span className="quality-row-num">{score[r.key]}</span>
            </div>
          ))}
        </div>
        {score.issues.length > 0 && (
          <ul className="collection-issues">
            {score.issues.map((issue, i) => (
              <li key={i}>🧭 {issue}</li>
            ))}
          </ul>
        )}
      </div>

      <h4>🧩 Asset Browser</h4>
      <div className="collection-asset-switcher">
        {collection.assets.map((asset) => (
          <button
            key={asset.id}
            type="button"
            className={`collection-asset-btn${asset.id === selectedAssetId ? ' active' : ''}`}
            onClick={() => setSelectedAssetId(asset.id)}
          >
            {asset.label}
          </button>
        ))}
      </div>
      {selectedAsset && (
        <div className="collection-asset-preview">
          <div className="collection-asset-preview-header">
            <strong>{selectedAsset.label}</strong>
            <button type="button" className="btn" onClick={() => downloadAsset(selectedAsset)}>
              ⬇️ ดาวน์โหลดชิ้นนี้
            </button>
          </div>
          {selectedAsset.svg ? (
            <div className="collection-asset-svg" dangerouslySetInnerHTML={{ __html: assetPreviewHtml(selectedAsset) }} />
          ) : (
            <pre className="collection-asset-json">{JSON.stringify(selectedAsset.data, null, 2)}</pre>
          )}
          <AssetSeoEditor
            key={selectedAsset.id}
            asset={selectedAsset}
            patternParams={collection.patternParams}
            onSet={(marketplaceId, override) => onSetAssetSeoOverride(selectedAsset.id, marketplaceId, override)}
            onClear={(marketplaceId) => onClearAssetSeoOverride(selectedAsset.id, marketplaceId)}
          />
        </div>
      )}

      <h4>📝 Metadata Browser — SEO Score {seo.score}/100</h4>
      <div className="metadata-browser-table">
        {siteMetadata.map((site) => {
          const title = site.fields.find((f) => f.label === 'Title' || f.label === 'Product Name');
          const description = site.fields.find((f) => f.label === 'Description');
          const keywords = site.fields.find((f) => f.label === 'Keywords' || f.label === 'Keywords / Tags' || f.label === 'Tags');
          return (
            <div key={site.id} className="metadata-browser-row">
              <strong>{site.label}</strong>
              <span className="metadata-browser-field">Title: {title?.value ?? '—'}</span>
              {description && <span className="metadata-browser-field">Description: {description.value.slice(0, 80)}…</span>}
              <span className="metadata-browser-field">Keywords: {(keywords?.value ?? '').split(',').filter(Boolean).length} คำ</span>
              <span className="metadata-browser-field">Filename: {filename}</span>
            </div>
          );
        })}
      </div>

      <h4>🏬 Upload Tracker</h4>
      <div className="upload-tracker">
        {STOCK_SITES.map((site) => (
          <div key={site.id} className="upload-tracker-row">
            <span>{site.label}</span>
            <select
              value={entry.uploadStatus[site.id] ?? 'pending'}
              onChange={(e) => onSetUploadStatus(site.id, e.target.value as UploadStatus)}
            >
              {UPLOAD_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Project Panel — rendered in the editor view whenever a Project is
 * active: Collection Browser (every Collection saved to this project) +,
 * per selected Collection, the Asset Browser / Metadata Browser / Upload
 * Tracker, plus project-wide Export History and a Designer Assistant
 * review. Evolves v1.33's CollectionWorkspace (which only ever showed one
 * ephemeral, non-persisted collection) into a project-scoped, persistent
 * multi-collection workspace. */
export function ProjectPanel({ project, building, onExportCollectionZip, onSetUploadStatus, onSetAssetSeoOverride, onClearAssetSeoOverride }: Props) {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  useEffect(() => {
    if (!project) {
      setSelectedEntryId(null);
      return;
    }
    if (!project.collections.some((c) => c.id === selectedEntryId)) {
      setSelectedEntryId(project.collections[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const review = useMemo(() => (project ? reviewProject(project) : null), [project]);
  const selectedEntry = project?.collections.find((c) => c.id === selectedEntryId) ?? null;

  if (!project) {
    return (
      <section className="project-panel">
        <p className="collection-empty-hint">เลือกหรือสร้างโปรเจกต์ก่อน เพื่อเริ่มสร้าง Collection ในโปรเจกต์นั้น</p>
      </section>
    );
  }

  return (
    <section className="project-panel">
      <div className="metadata-header">
        <h3>🗂️ {project.name}</h3>
        <span className="metadata-hint">ทุก Collection/Asset/Metadata/Export ที่สร้างจะถูกบันทึกไว้ในโปรเจกต์นี้อัตโนมัติ</span>
      </div>

      <h4>
        📦 Collection Browser ({project.collections.length}){building && ' — 🏭 กำลังสร้างคอลเลกชัน…'}
      </h4>
      {project.collections.length === 0 ? (
        <p className="collection-empty-hint">
          ยังไม่มี Collection ในโปรเจกต์นี้ — กด "🏭 Generate Collection (ZIP)" ในแผงด้านซ้ายเพื่อเริ่ม
          (จะบันทึกเข้าโปรเจกต์นี้ให้อัตโนมัติ)
        </p>
      ) : (
        <div className="collection-asset-switcher">
          {project.collections.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`collection-asset-btn${entry.id === selectedEntryId ? ' active' : ''}`}
              onClick={() => setSelectedEntryId(entry.id)}
            >
              {entry.collection.manifest.collectionName} · {new Date(entry.createdAt).toLocaleDateString('th-TH')}
            </button>
          ))}
        </div>
      )}

      {selectedEntry && (
        <CollectionAndAssetBrowser
          entry={selectedEntry}
          onExportZip={() => onExportCollectionZip(selectedEntry.id)}
          onSetUploadStatus={(site, status) => onSetUploadStatus(selectedEntry.id, site, status)}
          onSetAssetSeoOverride={(assetId, marketplaceId, override) => onSetAssetSeoOverride(selectedEntry.id, assetId, marketplaceId, override)}
          onClearAssetSeoOverride={(assetId, marketplaceId) => onClearAssetSeoOverride(selectedEntry.id, assetId, marketplaceId)}
        />
      )}

      <h4>🕓 Export History ({project.exportHistory.length})</h4>
      {project.exportHistory.length === 0 ? (
        <p className="collection-empty-hint">ยังไม่มีประวัติ export</p>
      ) : (
        <ul className="export-history-list">
          {project.exportHistory.map((h) => (
            <li key={h.id}>
              {new Date(h.date).toLocaleString('th-TH')} — {h.collectionName} (schema v{h.version})
            </li>
          ))}
        </ul>
      )}

      {review && (
        <>
          <h4>
            🧭 Designer Assistant{' '}
            {review.averageCollectionScore !== null && `— คะแนนเฉลี่ยทุก Collection ${review.averageCollectionScore}/100`}
          </h4>
          {review.issues.length === 0 && review.recommendations.length === 0 ? (
            <p className="collection-empty-hint">ไม่พบปัญหาในโปรเจกต์นี้ ✅</p>
          ) : (
            <>
              {review.issues.length > 0 && (
                <ul className="collection-issues">
                  {review.issues.map((issue, i) => (
                    <li key={i}>⚠️ {issue}</li>
                  ))}
                </ul>
              )}
              {review.recommendations.length > 0 && (
                <ul className="submission-recommendations-list">
                  {review.recommendations.map((rec, i) => (
                    <li key={i}>💡 {rec}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
