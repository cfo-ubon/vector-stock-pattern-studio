import { useEffect, useMemo, useState } from 'react';
import type { TileData } from '../engine/types';
import { MARKETPLACE_LIST, type MarketplaceId } from '../metadata/marketplaceProfiles';
import { generateMarketplaceSeo, type MarketplaceSeo } from '../metadata/marketplaceSeo';
import { validateMarketplaceSeo, isMarketplaceReady } from '../metadata/marketplaceValidation';
import { CopyButton } from './MetadataPanel';

interface Props {
  tileData: TileData | null;
  onDownloadPackage: (marketplaceId: MarketplaceId, seo: MarketplaceSeo) => void;
}

/** User-editable overrides layered on top of the generated defaults — the
 * Filename Engine's ("allow user customization") and the profile system's
 * general "minimal manual editing required, but editing is allowed"
 * success criterion. Kept as local component state (not persisted) since
 * this operates on the *current* pattern, matching how the rest of the
 * Stock Submission Center already works — edits are one-off touch-ups
 * right before download, not a permanent record. */
interface SeoOverride {
  title?: string;
  description?: string;
  keywords?: string;
  filenameTemplate?: string;
}

/** Marketplace Profile Selector — "select a marketplace, instantly get a
 * complete Title/Description/Keywords/Filename" plus validation feedback
 * and a one-click Export Package download, all driven by
 * metadata/marketplaceProfiles.ts's config instead of one generic SEO
 * profile. */
export function MarketplaceProfileSelector({ tileData, onDownloadPackage }: Props) {
  const [selected, setSelected] = useState<MarketplaceId>('shutterstock');
  const [overrides, setOverrides] = useState<SeoOverride>({});

  useEffect(() => {
    setOverrides({});
  }, [selected, tileData]);

  const profile = MARKETPLACE_LIST.find((p) => p.id === selected)!;
  const generated = useMemo(() => (tileData ? generateMarketplaceSeo(tileData, selected, overrides.filenameTemplate) : null), [tileData, selected, overrides.filenameTemplate]);

  const seo: MarketplaceSeo | null = useMemo(() => {
    if (!generated) return null;
    return {
      ...generated,
      title: overrides.title ?? generated.title,
      description: overrides.description ?? generated.description,
      keywords: overrides.keywords !== undefined ? overrides.keywords.split(',').map((k) => k.trim()).filter(Boolean) : generated.keywords,
    };
  }, [generated, overrides]);

  const issues = useMemo(() => (seo ? validateMarketplaceSeo(seo, profile) : []), [seo, profile]);
  const ready = isMarketplaceReady(issues);

  if (!tileData || !seo) return null;

  return (
    <div className="marketplace-selector">
      <div className="metadata-header">
        <h3>🏪 Marketplace Profile</h3>
        <span className="metadata-hint">เลือกเว็บ แล้วระบบสร้าง Title/Description/Keywords/Filename ให้ทันทีตามกฎเฉพาะของเว็บนั้น</span>
      </div>

      <div className="marketplace-chips">
        {MARKETPLACE_LIST.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`marketplace-chip${p.id === selected ? ' active' : ''}`}
            onClick={() => setSelected(p.id)}
          >
            {p.label}
            {p.future && ' 🔜'}
          </button>
        ))}
      </div>
      {profile.future && (
        <p className="marketplace-future-hint">🔜 Future-ready: โปรไฟล์นี้สร้างข้อมูลจริงให้ครบแล้ว แต่ยังไม่ยืนยัน URL หน้าลงขายที่แม่นยำ</p>
      )}

      <div className="marketplace-fields">
        <div className="metadata-field">
          <div className="metadata-field-top">
            <label>
              Title <small>({seo.title.length}/{profile.titleRules.maxLength} ตัวอักษร)</small>
            </label>
            <CopyButton text={seo.title} label=" Title" />
          </div>
          <textarea rows={2} value={seo.title} onChange={(e) => setOverrides((o) => ({ ...o, title: e.target.value }))} />
        </div>

        {(profile.descriptionRules.required || seo.description) && (
          <div className="metadata-field">
            <div className="metadata-field-top">
              <label>
                Description <small>({seo.description.length} ตัวอักษร)</small>
              </label>
              <CopyButton text={seo.description} label=" Description" />
            </div>
            <textarea rows={4} value={seo.description} onChange={(e) => setOverrides((o) => ({ ...o, description: e.target.value }))} />
          </div>
        )}

        <div className="metadata-field">
          <div className="metadata-field-top">
            <label>
              {profile.keywordRules.termLabel === 'tags' ? 'Tags' : 'Keywords'}{' '}
              <small>({seo.keywords.length}/{profile.keywordRules.maxCount})</small>
            </label>
            <CopyButton text={seo.keywords.join(', ')} label=" Keywords" />
          </div>
          <textarea
            rows={3}
            value={overrides.keywords ?? seo.keywords.join(', ')}
            onChange={(e) => setOverrides((o) => ({ ...o, keywords: e.target.value }))}
          />
        </div>

        <div className="metadata-field">
          <div className="metadata-field-top">
            <label>Filename</label>
            <CopyButton text={seo.filename} label=" Filename" />
          </div>
          <input type="text" className="marketplace-filename-input" readOnly value={seo.filename} />
          <input
            type="text"
            className="marketplace-filename-template"
            placeholder="แม่แบบชื่อไฟล์เอง เช่น {category}-{seed}"
            value={overrides.filenameTemplate ?? ''}
            onChange={(e) => setOverrides((o) => ({ ...o, filenameTemplate: e.target.value || undefined }))}
          />
        </div>
      </div>

      <div className={`marketplace-ready-indicator marketplace-ready-indicator--${ready ? 'ready' : 'issues'}`}>
        {ready ? '✅ พร้อมส่ง (Ready)' : `⚠️ มี ${issues.filter((i) => i.severity === 'error').length} ปัญหาที่ต้องแก้ก่อนส่ง`}
      </div>
      {issues.length > 0 && (
        <ul className="marketplace-issues">
          {issues.map((issue, i) => (
            <li key={i} className={`marketplace-issue marketplace-issue--${issue.severity}`}>
              {issue.severity === 'error' ? '❌' : '⚠️'} {issue.message}
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="btn btn--primary" onClick={() => onDownloadPackage(selected, seo)}>
        📦 ดาวน์โหลด Export Package ({profile.label})
      </button>
    </div>
  );
}
