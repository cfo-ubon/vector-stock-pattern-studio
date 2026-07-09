import { useMemo, useState } from 'react';
import type { TileData } from '../engine/types';
import { buildStockMetadata } from '../metadata/shutterstock';

interface Props {
  tileData: TileData | null;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API unavailable (e.g. non-HTTPS) — fall back to a
      // temporary textarea + execCommand copy.
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" className="copy-btn" onClick={copy}>
      {copied ? '✓ คัดลอกแล้ว' : `คัดลอก${label}`}
    </button>
  );
}

/** Shutterstock-ready SEO metadata for the current pattern: title,
 * description (<200 chars) and exactly 50 keywords, each with its own
 * copy button so they can be pasted straight into the upload form. */
export function MetadataPanel({ tileData }: Props) {
  const meta = useMemo(() => (tileData ? buildStockMetadata(tileData) : null), [tileData]);
  if (!meta) return null;
  const keywordString = meta.keywords.join(', ');

  return (
    <div className="metadata-panel">
      <div className="metadata-header">
        <h3>SEO สำหรับ Stock (Shutterstock / Adobe Stock)</h3>
        <span className="metadata-hint">อัปเดตอัตโนมัติตามลายที่แสดงอยู่</span>
      </div>

      <div className="metadata-field">
        <div className="metadata-field-top">
          <label>Title <small>({meta.title.length} ตัวอักษร)</small></label>
          <CopyButton text={meta.title} label=" Title" />
        </div>
        <textarea readOnly rows={2} value={meta.title} />
      </div>

      <div className="metadata-field">
        <div className="metadata-field-top">
          <label>Description <small>({meta.description.length}/200 ตัวอักษร)</small></label>
          <CopyButton text={meta.description} label=" Description" />
        </div>
        <textarea readOnly rows={3} value={meta.description} />
      </div>

      <div className="metadata-field">
        <div className="metadata-field-top">
          <label>Keywords <small>({meta.keywords.length}/50 คำ, คั่นด้วย comma)</small></label>
          <CopyButton text={keywordString} label=" Keywords" />
        </div>
        <textarea readOnly rows={5} value={keywordString} />
      </div>

      <div className="metadata-field">
        <div className="metadata-field-top">
          <label>หมวดหมู่ภาพ (เลือกในฟอร์มอัปโหลด)</label>
          <CopyButton text={meta.categories.shutterstock.join(', ')} label="หมวด" />
        </div>
        <div className="category-rows">
          <div className="category-row">
            <span className="category-site">Shutterstock (เลือก 2)</span>
            <span className="category-values">{meta.categories.shutterstock.join(' + ')}</span>
          </div>
          <div className="category-row">
            <span className="category-site">Adobe Stock (เลือก 1)</span>
            <span className="category-values">{meta.categories.adobeStock}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
