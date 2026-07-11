import { useEffect, useMemo, useState } from 'react';
import type { GeneratedCollection, CollectionAsset } from '../collection/collectionGenerator';
import { computeCollectionScore } from '../collection/collectionScore';
import { downloadSvgFile, downloadBlobFile } from '../export/svgExporter';
import { scoreColor } from './scoreColor';

interface Props {
  collection: GeneratedCollection | null;
  building: boolean;
  onGenerate: () => void;
  onExportZip: () => void;
}

const SCORE_ROWS: Array<{ key: keyof ReturnType<typeof computeCollectionScore>; label: string }> = [
  { key: 'styleConsistency', label: 'Style Consistency' },
  { key: 'paletteConsistency', label: 'Palette Consistency' },
  { key: 'motifConsistency', label: 'Motif Consistency' },
  { key: 'flowConsistency', label: 'Flow Consistency' },
  { key: 'commercialReadiness', label: 'Commercial Readiness' },
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

/** Collection Studio Engine Workspace (v1.33) — the in-app "Collection
 * tab": every asset generateCollection() built is browsable and switchable
 * here, alongside a real Collection Score (collection/collectionScore.ts)
 * and export controls. Previously (v1.31) a click on "Generate Collection"
 * only auto-downloaded a zip with nothing browsable in-app — this adds the
 * browsing/scoring layer on top without changing that one-click download
 * behavior. */
export function CollectionWorkspace({ collection, building, onGenerate, onExportZip }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (collection && (!selectedId || !collection.assets.some((a) => a.id === selectedId))) {
      setSelectedId(collection.assets[0]?.id ?? null);
    }
  }, [collection, selectedId]);

  const score = useMemo(() => (collection ? computeCollectionScore(collection) : null), [collection]);
  const selectedAsset = collection?.assets.find((a) => a.id === selectedId) ?? null;

  return (
    <section className="collection-workspace">
      <div className="metadata-header">
        <h3>🗂️ Collection Studio</h3>
        <span className="metadata-hint">
          หนึ่งคลิก สร้างคอลเลกชันเชิงพาณิชย์ครบชุด: Hero/Secondary/Blender/Mini/Stripe Pattern, Border, Corner, Spot &
          Decorative Sheet, Collection Preview — ทุกชิ้นแชร์ Style DNA / Palette / Motif Family เดียวกัน
        </span>
      </div>

      <div className="collection-actions">
        <button type="button" className="btn btn--primary" onClick={onGenerate} disabled={building}>
          {building ? '🏭 กำลังสร้างคอลเลกชัน…' : collection ? '✅ สร้างคอลเลกชันใหม่จากลายปัจจุบัน' : '🏭 สร้างคอลเลกชัน'}
        </button>
        {collection && (
          <button type="button" className="btn" onClick={onExportZip}>
            📦 Export ZIP ทั้งคอลเลกชัน
          </button>
        )}
      </div>

      {!collection && !building && (
        <p className="collection-empty-hint">ยังไม่มีคอลเลกชันสำหรับลายปัจจุบัน — กด "สร้างคอลเลกชัน" เพื่อเริ่ม</p>
      )}

      {collection && score && (
        <>
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

          <div className="collection-asset-switcher">
            {collection.assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                className={`collection-asset-btn${asset.id === selectedId ? ' active' : ''}`}
                onClick={() => setSelectedId(asset.id)}
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
            </div>
          )}
        </>
      )}
    </section>
  );
}
