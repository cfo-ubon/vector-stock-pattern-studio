import { useMemo, useState } from 'react';
import type { TileData } from '../engine/types';
import { buildSiteMetadata, type StockSiteId } from '../metadata/shutterstock';

interface Props {
  tileData: TileData | null;
}

export function CopyButton({ text, label }: { text: string; label: string }) {
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

/** Per-site SEO metadata for the current pattern: a tab per stock site,
 * each showing that site's upload-form fields shaped to its own limits
 * (character caps, keyword counts, categories), every field with its own
 * copy button. */
export function MetadataPanel({ tileData }: Props) {
  const [activeSite, setActiveSite] = useState<StockSiteId>('shutterstock');
  const sites = useMemo(() => (tileData ? buildSiteMetadata(tileData) : null), [tileData]);
  if (!sites) return null;
  const site = sites.find((s) => s.id === activeSite) ?? sites[0];

  return (
    <div className="metadata-panel">
      <div className="metadata-header">
        <h3>SEO สำหรับ Stock — แยกตามเว็บ</h3>
        <span className="metadata-hint">อัปเดตอัตโนมัติตามลายที่แสดงอยู่</span>
      </div>

      <div className="site-tabs" role="tablist">
        {sites.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === site.id}
            className={`site-tab ${s.id === site.id ? 'site-tab--active' : ''}`}
            onClick={() => setActiveSite(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {site.note && <p className="site-note">ℹ️ {site.note}</p>}

      {site.fields.map((f) => (
        <div className="metadata-field" key={`${site.id}-${f.label}`}>
          <div className="metadata-field-top">
            <label>
              {f.label} {f.meta && <small>({f.meta})</small>}
            </label>
            <CopyButton text={f.value} label={` ${f.label}`} />
          </div>
          <textarea readOnly rows={f.value.length > 160 ? 4 : 2} value={f.value} />
        </div>
      ))}
    </div>
  );
}
