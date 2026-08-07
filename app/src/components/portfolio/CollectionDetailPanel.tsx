import { useState } from 'react';
import type { Collection } from '../../catalog/domain/collection';
import { COLLECTION_DESCRIPTION_MAX_LENGTH, COLLECTION_NAME_MAX_LENGTH } from '../../catalog/domain/collection';
import type { PortfolioAsset } from '../../catalog/domain/types';
import type { BulkMembershipResult } from '../../catalog/services/collectionService';
import { PortfolioThumbnail } from './PortfolioThumbnail';
import { useCollectionCoverUrl } from './useCollectionCoverUrl';

/** Portfolio Manager P2 Stage 2, Section 21/22 — same "show more" bounded-
 * rendering convention as `PortfolioGrid.tsx`'s `PAGE_SIZE`, so a
 * collection with hundreds/thousands of members never mounts every
 * `PortfolioThumbnail` (and its Blob-URL-holding `usePreviewUrl` hook) at
 * once. */
const MEMBER_PAGE_SIZE = 40;

interface Props {
  collection: Collection;
  memberAssets: PortfolioAsset[];
  duplicateAssetIds: ReadonlySet<string>;
  onRename: (id: string, name: string) => Promise<void>;
  onUpdateDescription: (id: string, description: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onUnarchive: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSetCover: (id: string, assetId: string | null) => Promise<void>;
  onRemoveAssets: (assetIds: string[], collectionId: string) => Promise<BulkMembershipResult>;
  onOpenAsset: (assetId: string) => void;
  onClose: () => void;
}

/** Portfolio Manager P2 Stage 2, Section 9 — Collection detail view. Name
 * and description follow `PortfolioDetailPanel.tsx`'s "controlled input,
 * commit via callback on blur" convention rather than a separate modal —
 * consistent with the rest of the app's inline-edit style. Delete uses
 * the same two-step radio-free danger confirmation shape as
 * `PortfolioDetailPanel`'s asset delete, but with its own `.collection-delete-confirm`
 * class (still `btn--danger` red) — archive uses a *different*,
 * non-danger-colored inline confirm banner, so the two destructive-looking
 * actions are never visually interchangeable (Section 8's explicit
 * requirement). */
export function CollectionDetailPanel({
  collection,
  memberAssets,
  duplicateAssetIds,
  onRename,
  onUpdateDescription,
  onArchive,
  onUnarchive,
  onDelete,
  onSetCover,
  onRemoveAssets,
  onOpenAsset,
  onClose,
}: Props) {
  const { url: coverUrl, broken: coverBroken } = useCollectionCoverUrl(collection.coverAssetId);
  const [nameDraft, setNameDraft] = useState(collection.name);
  const [descDraft, setDescDraft] = useState(collection.description);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [visibleMembers, setVisibleMembers] = useState(MEMBER_PAGE_SIZE);

  const commitName = async () => {
    if (nameDraft.trim() === collection.name) return;
    setSavingName(true);
    setNameError(null);
    try {
      await onRename(collection.id, nameDraft);
    } catch (e) {
      setNameError(e instanceof Error ? e.message : 'เปลี่ยนชื่อไม่สำเร็จ');
      setNameDraft(collection.name);
    } finally {
      setSavingName(false);
    }
  };

  const commitDescription = async () => {
    if (descDraft === collection.description) return;
    try {
      await onUpdateDescription(collection.id, descDraft);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'บันทึกคำอธิบายไม่สำเร็จ');
    }
  };

  const toggleMember = (assetId: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const handleRemoveSelected = async () => {
    if (removing || selectedMemberIds.size === 0) return;
    setRemoving(true);
    setActionError(null);
    try {
      await onRemoveAssets([...selectedMemberIds], collection.id);
      setSelectedMemberIds(new Set());
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'นำชิ้นงานออกไม่สำเร็จ');
    } finally {
      setRemoving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setActionError(null);
    try {
      await onDelete(collection.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'ลบคอลเลกชันไม่สำเร็จ');
      setDeleting(false);
    }
  };

  return (
    <div className="portfolio-detail collection-detail">
      <div className="portfolio-detail-header">
        <h2>รายละเอียดคอลเลกชัน</h2>
        <button type="button" className="btn" onClick={onClose}>
          ปิด
        </button>
      </div>

      <div className="portfolio-detail-preview">
        {coverUrl && !coverBroken ? <img src={coverUrl} alt="" /> : <div className="portfolio-thumb-placeholder">📁</div>}
      </div>

      <section className="portfolio-detail-section">
        <h3>ชื่อ</h3>
        <input
          type="text"
          value={nameDraft}
          maxLength={COLLECTION_NAME_MAX_LENGTH}
          disabled={savingName}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => void commitName()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setNameDraft(collection.name);
          }}
          aria-label="ชื่อคอลเลกชัน"
        />
        {nameError && (
          <p className="portfolio-error-text" role="alert">
            {nameError}
          </p>
        )}
      </section>

      <section className="portfolio-detail-section">
        <h3>คำอธิบาย</h3>
        <textarea
          value={descDraft}
          maxLength={COLLECTION_DESCRIPTION_MAX_LENGTH}
          onChange={(e) => setDescDraft(e.target.value)}
          onBlur={() => void commitDescription()}
          rows={3}
          aria-label="คำอธิบายคอลเลกชัน"
        />
      </section>

      <section className="portfolio-detail-section">
        <h3>ปกคอลเลกชัน</h3>
        <select
          value={collection.coverAssetId ?? ''}
          onChange={(e) => void onSetCover(collection.id, e.target.value || null)}
          aria-label="เลือกปกคอลเลกชันจากชิ้นงานสมาชิก"
        >
          <option value="">ไม่มีปก (ใช้ค่าเริ่มต้น)</option>
          {memberAssets.map((a) => (
            <option key={a.assetId} value={a.assetId}>
              {a.displayName}
            </option>
          ))}
        </select>
        <p className="metadata-hint">เลือกปกได้จากชิ้นงานที่เป็นสมาชิกของคอลเลกชันนี้เท่านั้น</p>
      </section>

      <section className="portfolio-detail-section">
        <h3>สถานะ</h3>
        <dl className="portfolio-metadata-grid">
          <dt>จำนวนสมาชิก</dt>
          <dd>{memberAssets.length} ชิ้นงาน</dd>
          <dt>สถานะ</dt>
          <dd>{collection.isArchived ? 'เก็บถาวร' : 'ใช้งานอยู่'}</dd>
          <dt>สร้างเมื่อ</dt>
          <dd>{new Date(collection.createdAt).toLocaleString('th-TH')}</dd>
          <dt>อัปเดตล่าสุด</dt>
          <dd>{new Date(collection.updatedAt).toLocaleString('th-TH')}</dd>
        </dl>
      </section>

      <section className="portfolio-detail-section portfolio-detail-actions">
        <h3>การดำเนินการ</h3>

        {!collection.isArchived ? (
          !confirmArchive ? (
            <button type="button" className="btn" onClick={() => setConfirmArchive(true)}>
              เก็บเข้าที่เก็บถาวร
            </button>
          ) : (
            <div className="collection-archive-confirm">
              <p>เก็บคอลเลกชันนี้เข้าที่เก็บถาวร? ชิ้นงานสมาชิกจะไม่ถูกลบ และยังดูได้ตามปกติ — เพียงแต่จะรับสมาชิกใหม่ไม่ได้จนกว่าจะกู้คืน</p>
              <div className="portfolio-form-actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    void onArchive(collection.id);
                    setConfirmArchive(false);
                  }}
                >
                  ยืนยันเก็บถาวร
                </button>
                <button type="button" className="btn" onClick={() => setConfirmArchive(false)}>
                  ยกเลิก
                </button>
              </div>
            </div>
          )
        ) : (
          <button type="button" className="btn" onClick={() => void onUnarchive(collection.id)}>
            กู้คืนจากที่เก็บถาวร
          </button>
        )}

        {!confirmDelete ? (
          <button type="button" className="btn btn--danger" onClick={() => setConfirmDelete(true)}>
            ลบคอลเลกชันนี้
          </button>
        ) : (
          <div className="portfolio-delete-confirm collection-delete-confirm">
            <p>
              ลบคอลเลกชัน "{collection.name}" ({memberAssets.length} ชิ้นงาน)? การลบนี้จะ<strong>ไม่ลบชิ้นงานใดๆ</strong> — เฉพาะการอ้างอิงถึงคอลเลกชันนี้ในแต่ละชิ้นงานจะถูกนำออกเท่านั้น
              และย้อนกลับไม่ได้
            </p>
            <div className="portfolio-delete-confirm-actions">
              <button type="button" className="btn btn--danger" onClick={() => void handleDelete()} disabled={deleting}>
                {deleting ? 'กำลังลบ…' : 'ยืนยันลบ'}
              </button>
              <button type="button" className="btn" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {actionError && (
          <p className="portfolio-error-text" role="alert">
            {actionError}
          </p>
        )}
      </section>

      <section className="portfolio-detail-section">
        <div className="portfolio-grid-summary">
          <h3>ชิ้นงานในคอลเลกชันนี้ ({memberAssets.length})</h3>
        </div>
        {selectedMemberIds.size > 0 && (
          <div className="portfolio-bulk-action-bar">
            <span>เลือกแล้ว {selectedMemberIds.size} รายการ</span>
            <button type="button" className="btn btn--small" onClick={() => void handleRemoveSelected()} disabled={removing}>
              {removing ? 'กำลังนำออก…' : 'นำออกจากคอลเลกชันนี้'}
            </button>
            <button type="button" className="btn btn--small" onClick={() => setSelectedMemberIds(new Set())}>
              ล้างการเลือก
            </button>
          </div>
        )}
        {memberAssets.length === 0 ? (
          <p className="gallery-empty">คอลเลกชันนี้ยังไม่มีชิ้นงาน — ไปที่แท็บ "📁 Library & Search" เลือกชิ้นงาน แล้วกด "เพิ่มเข้าคอลเลกชัน" เพื่อเพิ่มสมาชิก</p>
        ) : (
          <>
            <div className="portfolio-grid collection-member-grid">
              {memberAssets.slice(0, visibleMembers).map((asset) => (
                <div key={asset.assetId} className="collection-member-card">
                  <label className="portfolio-select-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.has(asset.assetId)}
                      onChange={() => toggleMember(asset.assetId)}
                      aria-label={`เลือก ${asset.displayName}`}
                    />
                  </label>
                  <PortfolioThumbnail
                    asset={asset}
                    selected={false}
                    isDuplicate={duplicateAssetIds.has(asset.assetId)}
                    onSelect={onOpenAsset}
                  />
                </div>
              ))}
            </div>
            {visibleMembers < memberAssets.length && (
              <button type="button" className="btn" onClick={() => setVisibleMembers((v) => v + MEMBER_PAGE_SIZE)}>
                แสดงเพิ่ม ({memberAssets.length - visibleMembers} รายการที่เหลือ)
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
