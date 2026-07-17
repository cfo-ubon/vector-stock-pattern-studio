import { useState } from 'react';
import type { PortfolioAsset, WorkflowStatus } from '../../catalog/domain/types';
import { WORKFLOW_STATUSES } from '../../catalog/domain/types';
import type { Collection } from '../../catalog/domain/collection';
import type { BulkMembershipResult } from '../../catalog/services/collectionService';
import { usePreviewUrl } from './usePreviewUrl';
import { exportAssetById } from '../../catalog/services/exportAsset';
import { downloadBlobFile } from '../../export/svgExporter';
import { CollectionAssignmentDialog } from './CollectionAssignmentDialog';

const WORKFLOW_LABEL_TH: Record<WorkflowStatus, string> = {
  DRAFT: 'ฉบับร่าง',
  READY_FOR_REVIEW: 'รอตรวจ',
  READY_TO_UPLOAD: 'พร้อมอัปโหลด',
  SUBMITTED: 'ส่งแล้ว',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ถูกปฏิเสธ',
  NEEDS_REVISION: 'ต้องแก้ไข',
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  asset: PortfolioAsset;
  isDuplicate: boolean;
  onUpdate: (updated: PortfolioAsset) => void;
  onDeleteRecordOnly: (assetId: string) => void;
  onDeleteRecordAndFiles: (assetId: string) => void;
  onClose: () => void;
  /** Portfolio Manager P2 Stage 2, Section 12 — single-asset collection
   * assignment. `collections` is the full list (the assignment dialog
   * itself excludes archived collections from new-assignment, per Rule 7);
   * `onAssign`/`onRemove` call through to `collectionService.ts` via
   * `PortfolioManagerView.tsx`, never IndexedDB directly. */
  collections: Collection[];
  onAssignToCollections: (assetId: string, collectionIds: string[]) => Promise<BulkMembershipResult>;
  onRemoveFromCollection: (assetId: string, collectionId: string) => Promise<void>;
}

/** Sprint P1, Section 7 (Asset Library UI) — the detail/inspector view.
 * Every edit calls `onUpdate` with a full replacement `PortfolioAsset`
 * (the caller owns persistence, `putPortfolioAsset` + local state update —
 * see `PortfolioManagerView.tsx`), so this component stays a pure
 * controlled view over one asset plus its own small bits of local UI
 * state (notes draft, delete-confirm dialog). */
export function PortfolioDetailPanel({
  asset,
  isDuplicate,
  onUpdate,
  onDeleteRecordOnly,
  onDeleteRecordAndFiles,
  onClose,
  collections,
  onAssignToCollections,
  onRemoveFromCollection,
}: Props) {
  const { url, broken } = usePreviewUrl(asset.previewReference);
  const [notesDraft, setNotesDraft] = useState(asset.notes);
  const [tagDraft, setTagDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'recordOnly' | 'recordAndFiles'>('recordOnly');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [removingCollectionId, setRemovingCollectionId] = useState<string | null>(null);

  const assignedCollections = collections.filter((c) => asset.collectionIds.includes(c.id));

  const handleRemoveFromCollection = async (collectionId: string) => {
    setRemovingCollectionId(collectionId);
    setMembershipError(null);
    try {
      await onRemoveFromCollection(asset.assetId, collectionId);
    } catch (e) {
      setMembershipError(e instanceof Error ? e.message : 'นำออกจากคอลเลกชันไม่สำเร็จ');
    } finally {
      setRemovingCollectionId(null);
    }
  };

  const touch = (patch: Partial<PortfolioAsset>) => onUpdate({ ...asset, ...patch, updatedAt: Date.now() });

  const handleCopyId = () => {
    navigator.clipboard?.writeText(asset.assetId).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    });
  };

  const handleExport = async () => {
    setExportError(null);
    try {
      const { blob, filename } = await exportAssetById(asset.assetId);
      downloadBlobFile(filename, blob);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'ส่งออกไม่สำเร็จ');
    }
  };

  const addTag = () => {
    const tag = tagDraft.trim();
    if (!tag || asset.tags.includes(tag)) return;
    touch({ tags: [...asset.tags, tag] });
    setTagDraft('');
  };

  return (
    <div className="portfolio-detail">
      <div className="portfolio-detail-header">
        <h2>{asset.displayName}</h2>
        <button type="button" className="btn" onClick={onClose}>
          ปิด
        </button>
      </div>

      <div className="portfolio-detail-preview">
        {url && !broken ? <img src={url} alt={asset.displayName} /> : <div className="portfolio-thumb-placeholder">{asset.assetType.toUpperCase()}</div>}
      </div>

      <div className="portfolio-detail-id-row">
        <code>{asset.assetId}</code>
        <button type="button" className="btn btn--small" onClick={handleCopyId}>
          {copyFeedback ? 'คัดลอกแล้ว' : 'คัดลอก Asset ID'}
        </button>
        {isDuplicate && <span className="portfolio-badge portfolio-badge--warning">⚠ พบไฟล์ซ้ำในคลัง</span>}
      </div>

      <section className="portfolio-detail-section">
        <h3>สถานะงาน</h3>
        <select value={asset.workflowStatus} onChange={(e) => touch({ workflowStatus: e.target.value as WorkflowStatus })}>
          {WORKFLOW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {WORKFLOW_LABEL_TH[s]}
            </option>
          ))}
        </select>
        <div className="portfolio-detail-archive">
          {asset.isArchived ? (
            <button type="button" className="btn" onClick={() => touch({ isArchived: false, archivedAt: null, archiveReason: null })}>
              กู้คืนจากที่เก็บถาวร
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => touch({ isArchived: true, archivedAt: Date.now(), archiveReason: 'archived by user' })}>
              เก็บเข้าที่เก็บถาวร
            </button>
          )}
        </div>
      </section>

      <section className="portfolio-detail-section">
        <h3>คะแนน</h3>
        <div className="portfolio-rating-editor">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className="portfolio-rating-star"
              aria-label={`ให้คะแนน ${n} ดาว`}
              onClick={() => touch({ rating: asset.rating === n ? 0 : n })}
            >
              {n <= asset.rating ? '★' : '☆'}
            </button>
          ))}
        </div>
      </section>

      <section className="portfolio-detail-section">
        <h3>แท็ก</h3>
        <div className="portfolio-tag-list">
          {asset.tags.map((tag) => (
            <span key={tag} className="portfolio-filetype-chip">
              {tag}
              <button type="button" aria-label={`ลบแท็ก ${tag}`} onClick={() => touch({ tags: asset.tags.filter((t) => t !== tag) })}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="portfolio-tag-input-row">
          <input
            type="text"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTag();
            }}
            placeholder="เพิ่มแท็ก…"
          />
          <button type="button" className="btn btn--small" onClick={addTag}>
            เพิ่ม
          </button>
        </div>
      </section>

      <section className="portfolio-detail-section">
        <h3>โน้ต</h3>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={() => {
            if (notesDraft !== asset.notes) touch({ notes: notesDraft });
          }}
          rows={3}
        />
      </section>

      <section className="portfolio-detail-section">
        <h3>ไฟล์ต้นฉบับ</h3>
        <ul className="portfolio-file-list">
          {asset.sourceFileReferences.map((ref) => (
            <li key={ref.fileId}>
              <span className="portfolio-filetype-chip">{ref.role}</span> {ref.filename} — {formatBytes(ref.fileSize)}
              <div className="portfolio-file-hash">{ref.sha256}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="portfolio-detail-section">
        <h3>ข้อมูลเมทาดาทา</h3>
        <dl className="portfolio-metadata-grid">
          <dt>Style DNA</dt>
          <dd>{asset.styleDna ?? '—'}</dd>
          <dt>Preset</dt>
          <dd>{asset.presetId ?? '—'}</dd>
          <dt>ประเภทลาย (pattern type)</dt>
          <dd>{asset.patternType ?? '—'}</dd>
          <dt>Composition</dt>
          <dd>{asset.compositionType ?? '—'}</dd>
          <dt>Generator version</dt>
          <dd>{asset.generatorVersion ?? '—'}</dd>
          <dt>Generator seed</dt>
          <dd>{asset.generatorSeed ?? '—'}</dd>
          <dt>ขนาด</dt>
          <dd>{asset.dimensions ? `${asset.dimensions.width} × ${asset.dimensions.height}` : '—'}</dd>
          <dt>นำเข้าเมื่อ</dt>
          <dd>{new Date(asset.importedAt).toLocaleString('th-TH')}</dd>
          <dt>สร้างเมื่อ</dt>
          <dd>{new Date(asset.createdAt).toLocaleString('th-TH')}</dd>
        </dl>
      </section>

      <section className="portfolio-detail-section">
        <h3>คอลเลกชัน</h3>
        <div className="portfolio-tag-list">
          {assignedCollections.map((c) => (
            <span key={c.id} className="portfolio-filetype-chip">
              {c.name}
              <button
                type="button"
                aria-label={`นำออกจากคอลเลกชัน ${c.name}`}
                onClick={() => void handleRemoveFromCollection(c.id)}
                disabled={removingCollectionId === c.id}
              >
                ×
              </button>
            </span>
          ))}
          {assignedCollections.length === 0 && <span className="metadata-hint">ยังไม่อยู่ในคอลเลกชันใด</span>}
        </div>
        <button type="button" className="btn btn--small" onClick={() => setShowAssignDialog(true)}>
          + เพิ่มเข้าคอลเลกชัน
        </button>
        {membershipError && (
          <p className="portfolio-error-text" role="alert">
            {membershipError}
          </p>
        )}
      </section>

      {showAssignDialog && (
        <CollectionAssignmentDialog
          mode="assign"
          assetIds={[asset.assetId]}
          collections={collections}
          currentMembership={new Set(asset.collectionIds)}
          onConfirm={(collectionIds) => onAssignToCollections(asset.assetId, collectionIds)}
          onClose={() => setShowAssignDialog(false)}
        />
      )}

      <section className="portfolio-detail-section portfolio-detail-actions">
        <h3>การดำเนินการ</h3>
        <button type="button" className="btn btn--primary" onClick={handleExport}>
          ส่งออกเป็น ZIP
        </button>
        {exportError && <p className="portfolio-error-text">{exportError}</p>}
        {!confirmDelete ? (
          <button type="button" className="btn btn--danger" onClick={() => setConfirmDelete(true)}>
            ลบออกจากคลัง
          </button>
        ) : (
          <div className="portfolio-delete-confirm">
            <p>ลบชิ้นงานนี้อย่างไร?</p>
            <label>
              <input type="radio" checked={deleteMode === 'recordOnly'} onChange={() => setDeleteMode('recordOnly')} />
              ลบเฉพาะรายการในคลัง (เก็บไฟล์ต้นฉบับไว้) — ปลอดภัยกว่า
            </label>
            <label>
              <input type="radio" checked={deleteMode === 'recordAndFiles'} onChange={() => setDeleteMode('recordAndFiles')} />
              ลบรายการและไฟล์ที่เก็บไว้ทั้งหมด — ย้อนกลับไม่ได้
            </label>
            <div className="portfolio-delete-confirm-actions">
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => (deleteMode === 'recordOnly' ? onDeleteRecordOnly(asset.assetId) : onDeleteRecordAndFiles(asset.assetId))}
              >
                ยืนยันลบ
              </button>
              <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
