import { useState } from 'react';
import type { PortfolioAsset } from '../../catalog/domain/types';
import type { CommercialReadinessReport } from '../../commercial/domain/types';
import { listDesignVersions, duplicateDesignVersion } from '../../design/designVersioning';
import { usePreviewUrl } from '../portfolio/usePreviewUrl';
import { useModalDismiss } from '../portfolio/useModalDismiss';
import './designEdit.css';

interface RowProps {
  asset: PortfolioAsset;
  isRoot: boolean;
  readiness: CommercialReadinessReport | null;
  hasChildren: boolean;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onContinueEditing: () => void;
  onDuplicate: () => void;
  duplicating: boolean;
  renaming: boolean;
  onStartRename: () => void;
  onCancelRename: () => void;
  onSaveRename: (name: string) => void;
  onDeleteRecordOnly: () => void;
  onDeleteRecordAndFiles: () => void;
}

function VersionRow({
  asset,
  isRoot,
  readiness,
  hasChildren,
  selectable,
  selected,
  onToggleSelect,
  onContinueEditing,
  onDuplicate,
  duplicating,
  renaming,
  onStartRename,
  onCancelRename,
  onSaveRename,
  onDeleteRecordOnly,
  onDeleteRecordAndFiles,
}: RowProps) {
  const { url, broken } = usePreviewUrl(asset.previewReference);
  const [nameDraft, setNameDraft] = useState(asset.displayName);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <li className="version-history-row">
      {selectable && (
        <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label={`เลือก ${asset.displayName} เพื่อเปรียบเทียบ`} />
      )}
      <div className="version-history-thumb">{url && !broken ? <img src={url} alt={asset.displayName} /> : <div className="portfolio-thumb-placeholder">SVG</div>}</div>
      <div className="version-history-meta">
        {renaming ? (
          <div className="version-history-rename-row">
            <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} aria-label="ชื่อใหม่" />
            <button type="button" className="btn btn--small" onClick={() => onSaveRename(nameDraft)}>
              บันทึก
            </button>
            <button type="button" className="btn btn--small" onClick={onCancelRename}>
              ยกเลิก
            </button>
          </div>
        ) : (
          <strong>
            {asset.displayName} {isRoot && <span className="version-history-badge">ต้นฉบับ</span>}
          </strong>
        )}
        <div className="metadata-hint">
          {new Date(asset.createdAt).toLocaleString('th-TH')} · {asset.assetId}
          {hasChildren && ' · มีเวอร์ชันที่แตกต่อจากตัวนี้'}
        </div>
        <div className="metadata-hint">
          {readiness ? `Commercial: ${readiness.score}% — ${readiness.band}` : 'ยังไม่มีข้อมูล Commercial Readiness'}
        </div>
      </div>
      <div className="version-history-actions">
        <button type="button" className="btn btn--small" onClick={onContinueEditing}>
          🎨 แก้ไขต่อจากเวอร์ชันนี้
        </button>
        <button type="button" className="btn btn--small" disabled={duplicating} onClick={onDuplicate}>
          {duplicating ? 'กำลังทำสำเนา…' : '📄 ทำสำเนา'}
        </button>
        {!renaming && (
          <button type="button" className="btn btn--small" onClick={onStartRename}>
            ✏️ เปลี่ยนชื่อ
          </button>
        )}
        {!confirmingDelete ? (
          <button type="button" className="btn btn--small" onClick={() => setConfirmingDelete(true)}>
            🗑 ลบเวอร์ชันนี้
          </button>
        ) : (
          <div className="version-history-delete-confirm">
            {hasChildren && <p className="portfolio-error-text">เวอร์ชันนี้มีเวอร์ชันอื่นที่แตกต่อจากมัน — การลบจะไม่กระทบเวอร์ชันลูก แต่จะทำให้สายที่มาของเวอร์ชันลูกอ้างอิงถึงเวอร์ชันที่ไม่มีอยู่แล้ว</p>}
            <button type="button" className="btn btn--small" onClick={onDeleteRecordOnly}>
              ลบเฉพาะรายการ
            </button>
            <button type="button" className="btn btn--small" onClick={onDeleteRecordAndFiles}>
              ลบรายการ+ไฟล์
            </button>
            <button type="button" className="btn btn--small" onClick={() => setConfirmingDelete(false)}>
              ยกเลิก
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

interface Props {
  rootAssetId: string;
  allAssets: PortfolioAsset[];
  readinessByAsset: Map<string, CommercialReadinessReport>;
  onClose: () => void;
  onContinueEditing: (assetId: string) => void;
  onCompare: (assetIdA: string, assetIdB: string) => void;
  onUpdateAsset: (updated: PortfolioAsset) => void;
  onDeleteRecordOnly: (assetId: string) => void;
  onDeleteRecordAndFiles: (assetId: string) => void;
  onDuplicated: () => void;
}

/** Design Refinement Studio Pro, Mission 3 — Version Control. Every row is
 * a real, already-persisted `PortfolioAsset` from `listDesignVersions`
 * (`design/designVersioning.ts`, Mission 1) — this view adds no new
 * storage of its own, only a UI over the existing lineage fields
 * (`parentAssetId`/`variationGroupId`) and the app's existing
 * update/delete primitives (`putPortfolioAsset`,
 * `deletePortfolioAssetRecordOnly`/`AndFiles`, passed in by the caller). */
export function VersionHistoryView({
  rootAssetId,
  allAssets,
  readinessByAsset,
  onClose,
  onContinueEditing,
  onCompare,
  onUpdateAsset,
  onDeleteRecordOnly,
  onDeleteRecordAndFiles,
  onDuplicated,
}: Props) {
  const { backdropRef, onKeyDown } = useModalDismiss(onClose);
  const versions = listDesignVersions(rootAssetId, allAssets);
  const [selected, setSelected] = useState<string[]>([]);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const toggleSelect = (assetId: string) => {
    setSelected((prev) => {
      if (prev.includes(assetId)) return prev.filter((id) => id !== assetId);
      if (prev.length >= 2) return [prev[1], assetId];
      return [...prev, assetId];
    });
  };

  const handleDuplicate = async (asset: PortfolioAsset) => {
    setDuplicatingId(asset.assetId);
    setDuplicateError(null);
    try {
      const outcome = await duplicateDesignVersion(asset, allAssets);
      if (!outcome) {
        setDuplicateError('ทำสำเนาไม่ได้ — ชิ้นงานนี้ไม่มีพารามิเตอร์การออกแบบต้นฉบับ (อาจนำเข้าด้วยมือ)');
      } else if (outcome.status !== 'imported') {
        setDuplicateError(`ทำสำเนาไม่สำเร็จ (${outcome.status})`);
      } else {
        onDuplicated();
      }
    } catch (e) {
      setDuplicateError(e instanceof Error ? e.message : 'ทำสำเนาไม่สำเร็จ');
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <div className="portfolio-modal-backdrop" ref={backdropRef} tabIndex={-1} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-label="ประวัติเวอร์ชันการออกแบบ">
      <div className="portfolio-modal version-history-modal">
        <div className="portfolio-detail-header">
          <h2>🕓 ประวัติเวอร์ชันการออกแบบ ({versions.length})</h2>
          <button type="button" className="btn" onClick={onClose}>
            ปิด
          </button>
        </div>

        <p className="metadata-hint">เลือก 2 เวอร์ชันด้วยกล่องกาเครื่องหมายเพื่อเปรียบเทียบ — ทุกเวอร์ชันเป็นชิ้นงานจริงที่แยกจากกัน ไม่มีเวอร์ชันไหนถูกเขียนทับ</p>

        {selected.length === 2 && (
          <div className="version-history-compare-bar">
            <button type="button" className="btn btn--primary" onClick={() => onCompare(selected[0], selected[1])}>
              🔍 เปรียบเทียบ 2 เวอร์ชันที่เลือก
            </button>
          </div>
        )}

        {duplicateError && (
          <p className="portfolio-error-text" role="alert">
            {duplicateError}
          </p>
        )}

        <ul className="version-history-list">
          {versions.map((asset) => (
            <VersionRow
              key={asset.assetId}
              asset={asset}
              isRoot={asset.assetId === rootAssetId && asset.parentAssetId === null}
              readiness={readinessByAsset.get(asset.assetId) ?? null}
              hasChildren={allAssets.some((a) => a.parentAssetId === asset.assetId)}
              selectable
              selected={selected.includes(asset.assetId)}
              onToggleSelect={() => toggleSelect(asset.assetId)}
              onContinueEditing={() => onContinueEditing(asset.assetId)}
              onDuplicate={() => void handleDuplicate(asset)}
              duplicating={duplicatingId === asset.assetId}
              renaming={renamingId === asset.assetId}
              onStartRename={() => setRenamingId(asset.assetId)}
              onCancelRename={() => setRenamingId(null)}
              onSaveRename={(name) => {
                const trimmed = name.trim();
                if (trimmed.length > 0) onUpdateAsset({ ...asset, displayName: trimmed, updatedAt: Date.now() });
                setRenamingId(null);
              }}
              onDeleteRecordOnly={() => onDeleteRecordOnly(asset.assetId)}
              onDeleteRecordAndFiles={() => onDeleteRecordAndFiles(asset.assetId)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
