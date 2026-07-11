import { useMemo } from 'react';
import type { TileData } from '../engine/types';
import type { SavedItem } from './SavedPanel';
import { MetadataPanel } from './MetadataPanel';
import { MarketplaceProfileSelector } from './MarketplaceProfileSelector';
import { scoreColor } from './scoreColor';
import { CONTRIBUTOR_LINKS } from '../metadata/contributorLinks';
import { generateMarketplaceSeo, type MarketplaceSeo } from '../metadata/marketplaceSeo';
import { validateMarketplaceSeo, isMarketplaceReady } from '../metadata/marketplaceValidation';
import { MARKETPLACE_PROFILES, type MarketplaceId } from '../metadata/marketplaceProfiles';
import {
  buildSubmissionChecklist,
  analyzeSeo,
  computeStockReadiness,
  buildSubmissionRecommendations,
  type ChecklistStatus,
} from '../metadata/submissionCenter';

interface Props {
  tileData: TileData | null;
  saved: SavedItem[];
  /** Seed the last successfully-generated Collection (Asset Factory) was
   * built for — compared against the current pattern's own seed so
   * "Collection Ready" reflects *this* pattern, not a stale flag left over
   * from a previous one. */
  collectionGeneratedForSeed: string | null;
  /** Assembles + downloads one marketplace's Export Package zip (SVG +
   * PNG preview + title/description/keywords/filename.txt + metadata.json)
   * — lives in App.tsx since PNG rasterization is DOM-dependent, same
   * pattern as every other raster/zip export in this app. */
  onDownloadPackage: (marketplaceId: MarketplaceId, seo: MarketplaceSeo) => void;
}

const STATUS_ICON: Record<ChecklistStatus, string> = { ready: '✅', warning: '⚠️', missing: '❌' };
const READINESS_ICON: Record<'ready' | 'needsReview' | 'issues', string> = { ready: '✅', needsReview: '⚠️', issues: '❌' };
const READINESS_LABEL_TH: Record<'ready' | 'needsReview' | 'issues', string> = { ready: 'พร้อมส่ง', needsReview: 'ควรตรวจสอบ', issues: 'มีปัญหา' };

/** Turns the SEO panel into a full Stock Submission Center: Contributor
 * Portal quick-links (above Product Title, which lives inside the reused
 * MetadataPanel below), a real submission checklist, an SEO analyzer, and
 * per-site readiness cards — all computed from the pattern's actual SVG/
 * metadata/collection state (metadata/submissionCenter.ts), never a static
 * label. MetadataPanel itself is unchanged and rendered as-is at the
 * bottom — nothing about its own per-site field editing is duplicated. */
export function StockSubmissionCenter({ tileData, saved, collectionGeneratedForSeed, onDownloadPackage }: Props) {
  const checklist = useMemo(
    () => (tileData ? buildSubmissionChecklist(tileData, { collectionGeneratedForSeed, saved }) : null),
    [tileData, collectionGeneratedForSeed, saved],
  );
  const seo = useMemo(() => (tileData ? analyzeSeo(tileData) : null), [tileData]);
  const readiness = useMemo(() => (tileData && checklist ? computeStockReadiness(tileData, checklist) : null), [tileData, checklist]);
  const recommendations = useMemo(
    () => (checklist && seo && readiness ? buildSubmissionRecommendations(checklist, seo, readiness) : []),
    [checklist, seo, readiness],
  );
  // Per-marketplace SEO + validation, used by the readiness cards' new
  // "Download Package"/Validation Status — computed once here (not inside
  // the render loop) so every card reuses the same generated result.
  const marketplaceSeoById = useMemo(() => {
    if (!tileData) return null;
    const map = new Map<MarketplaceId, MarketplaceSeo>();
    for (const profile of Object.values(MARKETPLACE_PROFILES)) map.set(profile.id, generateMarketplaceSeo(tileData, profile.id));
    return map;
  }, [tileData]);

  return (
    <div className="submission-center">
      <section className="contributor-portal">
        <h3>🔗 Contributor Portal</h3>
        <div className="contributor-links">
          {CONTRIBUTOR_LINKS.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn contributor-link-btn"
              title={link.verified ? undefined : 'ลิงก์นี้เป็นหน้า landing page ทั่วไป (ยังไม่ยืนยัน URL อัปโหลดที่แม่นยำ) — แก้ไขได้ที่ metadata/contributorLinks.ts'}
            >
              {link.label}
              {!link.verified && ' ⚠️'}
            </a>
          ))}
        </div>
      </section>

      {tileData && checklist && (
        <section className="submission-checklist">
          <h3>✅ Submission Checklist</h3>
          <ul className="checklist-list">
            {checklist.map((item) => (
              <li key={item.id} className={`checklist-item checklist-item--${item.status}`}>
                <span className="checklist-icon">{STATUS_ICON[item.status]}</span>
                <span className="checklist-label">{item.label}</span>
                <span className="checklist-detail">{item.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tileData && seo && (
        <section className="seo-analyzer">
          <h3>📊 SEO Analyzer — คะแนน {seo.score}/100</h3>
          <div className="quality-bar">
            <div className="quality-bar-fill" style={{ width: `${seo.score}%`, background: scoreColor(seo.score) }} />
          </div>
          <div className="seo-metrics-grid">
            <div className="seo-metric">
              <span className="seo-metric-label">Keyword Count</span>
              <span className="seo-metric-value">{seo.keywordCount}</span>
            </div>
            <div className="seo-metric">
              <span className="seo-metric-label">Duplicate Keywords</span>
              <span className="seo-metric-value">{seo.duplicateKeywords.length}</span>
            </div>
            <div className="seo-metric">
              <span className="seo-metric-label">Title Length</span>
              <span className="seo-metric-value">{seo.titleLength}</span>
            </div>
            <div className="seo-metric">
              <span className="seo-metric-label">Description Length</span>
              <span className="seo-metric-value">{seo.descriptionLength}</span>
            </div>
            <div className="seo-metric">
              <span className="seo-metric-label">Filename Length</span>
              <span className="seo-metric-value">{seo.filenameLength}</span>
            </div>
            <div className="seo-metric">
              <span className="seo-metric-label">Commercial Tags</span>
              <span className="seo-metric-value">{seo.commercialTags.length}</span>
            </div>
            <div className="seo-metric">
              <span className="seo-metric-label">Keyword Coverage</span>
              <span className="seo-metric-value">{seo.keywordCoverage}%</span>
            </div>
          </div>
        </section>
      )}

      {tileData && readiness && marketplaceSeoById && (
        <section className="stock-readiness">
          <h3>🏬 Stock Readiness</h3>
          <div className="readiness-cards">
            {readiness.map((card) => {
              const marketplaceSeo = marketplaceSeoById.get(card.siteId)!;
              const profile = MARKETPLACE_PROFILES[card.siteId];
              const validationIssues = validateMarketplaceSeo(marketplaceSeo, profile);
              const validationReady = isMarketplaceReady(validationIssues);
              const contributor = CONTRIBUTOR_LINKS.find((l) => l.id === card.siteId);
              return (
                <div key={card.siteId} className={`readiness-card readiness-card--${card.status}`}>
                  <div className="readiness-card-header">
                    <span>{READINESS_ICON[card.status]}</span>
                    <strong>{card.label}</strong>
                    <span className="readiness-status-label">{READINESS_LABEL_TH[card.status]}</span>
                  </div>
                  <div className="readiness-card-statuses">
                    <span>📊 SEO: {marketplaceSeo.title ? '✅ สร้างแล้ว' : '❌ ยังไม่มี'}</span>
                    <span>{validationReady ? '✅ Validation ผ่าน' : `⚠️ Validation มี ${validationIssues.filter((i) => i.severity === 'error').length} ปัญหา`}</span>
                  </div>
                  {card.issues.length > 0 && (
                    <ul className="readiness-issues">
                      {card.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  )}
                  {card.recommendations.length > 0 && (
                    <ul className="readiness-recommendations">
                      {card.recommendations.map((rec, i) => (
                        <li key={i}>💡 {rec}</li>
                      ))}
                    </ul>
                  )}
                  <div className="readiness-card-actions">
                    {contributor && (
                      <a href={contributor.url} target="_blank" rel="noopener noreferrer" className="link-btn">
                        🔗 Contributor Link
                      </a>
                    )}
                    <button type="button" className="link-btn" onClick={() => onDownloadPackage(card.siteId, marketplaceSeo)}>
                      📦 Download Package
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {recommendations.length > 0 && (
        <section className="submission-recommendations">
          <h3>🧭 คำแนะนำจากการตรวจสอบ</h3>
          <ul>
            {recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </section>
      )}

      <MarketplaceProfileSelector tileData={tileData} onDownloadPackage={onDownloadPackage} />

      <MetadataPanel tileData={tileData} />
    </div>
  );
}
