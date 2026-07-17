import { useRef, useState } from 'react';
import type { Collection } from '../../catalog/domain/collection';
import { COLLECTION_DESCRIPTION_MAX_LENGTH, COLLECTION_NAME_MAX_LENGTH } from '../../catalog/domain/collection';

interface Props {
  onCreate: (name: string, description: string) => Promise<Collection>;
  onCreated: (collection: Collection) => void;
  onClose: () => void;
}

/** Portfolio Manager P2 Stage 2, Section 5 — Create Collection dialog.
 * Same modal shell as `PortfolioImportPanel.tsx`/`PortfolioHealthCheckPanel.tsx`
 * (`.portfolio-modal-backdrop`/`.portfolio-modal`, `role="dialog"`). Name
 * validation itself (empty/whitespace, max length, duplicate) is enforced
 * by `collectionService.createCollectionService` — this dialog only
 * surfaces the resulting typed error as readable Thai text, never a raw
 * exception, and keeps the entered text in place so a recoverable failure
 * (e.g. duplicate name) doesn't lose the user's input. */
export function CreateCollectionDialog({ onCreate, onCreated, onClose }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (name.trim().length === 0) {
      setError('กรุณาระบุชื่อคอลเลกชัน');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const collection = await onCreate(name, description);
      onCreated(collection);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้างคอลเลกชันไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="portfolio-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="สร้างคอลเลกชันใหม่"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="portfolio-modal">
        <div className="portfolio-modal-header">
          <h2>สร้างคอลเลกชันใหม่</h2>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            ปิด
          </button>
        </div>

        <form onSubmit={handleSubmit} className="portfolio-form">
          <label htmlFor="collection-name-input">ชื่อคอลเลกชัน</label>
          <input
            id="collection-name-input"
            ref={nameInputRef}
            type="text"
            value={name}
            maxLength={COLLECTION_NAME_MAX_LENGTH}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="เช่น Spring 2026 Florals"
            aria-required="true"
            aria-invalid={!!error}
          />

          <label htmlFor="collection-description-input">คำอธิบาย (ไม่บังคับ)</label>
          <textarea
            id="collection-description-input"
            value={description}
            maxLength={COLLECTION_DESCRIPTION_MAX_LENGTH}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />

          {error && (
            <p className="portfolio-error-text" role="alert">
              {error}
            </p>
          )}

          <div className="portfolio-form-actions">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'กำลังสร้าง…' : 'สร้างคอลเลกชัน'}
            </button>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
