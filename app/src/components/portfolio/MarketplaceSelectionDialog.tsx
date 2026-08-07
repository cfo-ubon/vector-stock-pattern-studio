import { useState } from 'react';
import { EXPORT_MARKETPLACE_OPTIONS, type ExportMarketplaceId } from '../../commercial/exportWorkflow';
import { useModalDismiss } from './useModalDismiss';

interface Props {
  assetCount: number;
  onConfirm: (marketplaceIds: ExportMarketplaceId[]) => void;
  onClose: () => void;
  busy?: boolean;
}

/** Hotfix v1.0.1, Parts 2-3 — Marketplace Selection. Multiple marketplaces
 * may be selected (Part 2's "Multiple marketplaces may be selected");
 * each option shows its real Export Profile (the files a package for it
 * actually contains — Part 3), reusing `exportWorkflow.ts`'s
 * `EXPORT_MARKETPLACE_OPTIONS`, itself built from the real
 * `MarketplaceProfile`s this app already has. No new marketplace logic. */
export function MarketplaceSelectionDialog({ assetCount, onConfirm, onClose, busy }: Props) {
  const [selected, setSelected] = useState<Set<ExportMarketplaceId>>(new Set());

  const toggle = (id: ExportMarketplaceId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { backdropRef, onKeyDown } = useModalDismiss(onClose);

  return (
    <div className="portfolio-modal-backdrop" ref={backdropRef} tabIndex={-1} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-label="เลือกมาร์เก็ตเพลส">
      <div className="portfolio-modal marketplace-selection-dialog">
        <div className="portfolio-detail-header">
          <h2>เลือกมาร์เก็ตเพลส</h2>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            ปิด
          </button>
        </div>
        <p>{assetCount} ชิ้นงานที่เลือก — เลือกได้มากกว่าหนึ่งมาร์เก็ตเพลส ระบบจะสร้าง 1 ไฟล์ ZIP ต่อมาร์เก็ตเพลส</p>

        <div className="marketplace-option-list">
          {EXPORT_MARKETPLACE_OPTIONS.map((option) => (
            <label key={option.id} className="marketplace-option-card">
              <div className="marketplace-option-header">
                <input type="checkbox" checked={selected.has(option.id)} onChange={() => toggle(option.id)} disabled={busy} />
                <strong>{option.label}</strong>
                {!option.wired && <span className="portfolio-badge portfolio-badge--warning">ไฟล์ทั่วไป (ยังไม่มีโปรไฟล์เฉพาะ)</span>}
              </div>
              <p className="marketplace-option-files">ไฟล์ในแพ็กเกจ: {option.exportFiles.join(', ')}</p>
            </label>
          ))}
        </div>

        <div className="portfolio-detail-actions">
          <button type="button" className="btn btn--primary" disabled={busy || selected.size === 0} onClick={() => onConfirm([...selected])}>
            {busy ? 'กำลัง Export…' : `Export ไปยัง ${selected.size} มาร์เก็ตเพลส`}
          </button>
        </div>
      </div>
    </div>
  );
}
