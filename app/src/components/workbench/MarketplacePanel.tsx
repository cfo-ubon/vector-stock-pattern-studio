import { useMemo, useState } from 'react';
import type { DesignSpecification } from '../../trend/designSpecTypes';
import type { DesignSpecQualityLoopResult } from '../../trend/designSpecQuality';
import { buildTileFromDesignSpec } from '../../trend/designSpecToParams';
import { buildDesignSpecSeo } from '../../trend/designSpecSeo';
import { buildSeoHints } from '../../trend/seoHintEngine';
import { MARKETPLACE_PROFILES, type MarketplaceId } from '../../metadata/marketplaceProfiles';
import { validateMarketplaceSeo } from '../../metadata/marketplaceValidation';
import { computeMarketplaceReadiness } from '../../metadata/readinessScore';
import { buildSubmissionChecklist } from '../../metadata/submissionCenter';
import { MARKETPLACE_LINK_SETS, CONTRIBUTOR_LINK_TYPES } from '../../metadata/contributorLinks';
import { CopyButton } from '../MetadataPanel';

// Design Workbench Section 5 ("Marketplace Panel") — the first UI surface
// for two engines that existed but were never wired into any component
// before Phase 6: `metadata/readinessScore.ts` (Readiness Score, built
// Marketplace Intelligence Engine Phase 5) and `trend/seoHintEngine.ts`
// (SEO Hints, same phase). Every sub-section reads a real, already-built
// module — this component computes nothing about SEO, validation, or
// readiness itself, it only lays 7 real data sources out together:
// Marketplace Profiles (the chip picker + rules shown inline), Readiness
// Score, Validation, SEO Hints, Filename Hints, Submission Checklist, and
// Contributor Links.

const SCORE_LABELS: Record<string, string> = {
  seoReadiness: 'SEO',
  filenameReadiness: 'Filename',
  metadataReadiness: 'Metadata',
  marketplaceCompatibility: 'Compatibility',
  commercialReadiness: 'Commercial',
};

function scoreClass(value: number): string {
  if (value >= 80) return 'workbench-score--good';
  if (value >= 60) return 'workbench-score--ok';
  return 'workbench-score--low';
}

interface Props {
  spec: DesignSpecification;
  seed: string;
  qualityResult: DesignSpecQualityLoopResult | null;
}

export function MarketplacePanel({ spec, seed, qualityResult }: Props) {
  const [marketplaceId, setMarketplaceId] = useState<MarketplaceId>(spec.marketplace.id);

  const plainTile = useMemo(() => buildTileFromDesignSpec(spec, seed), [spec, seed]);
  const tile = qualityResult ? qualityResult.pool.winner.tileData : plainTile;
  const profile = MARKETPLACE_PROFILES[marketplaceId];

  const seo = useMemo(() => buildDesignSpecSeo(spec, tile, marketplaceId), [spec, tile, marketplaceId]);
  const validationIssues = useMemo(() => validateMarketplaceSeo(seo, profile), [seo, profile]);
  const readiness = useMemo(() => computeMarketplaceReadiness(tile, marketplaceId), [tile, marketplaceId]);
  const hints = useMemo(() => buildSeoHints(spec, marketplaceId), [spec, marketplaceId]);
  const checklist = useMemo(() => buildSubmissionChecklist(tile, { collectionGeneratedForSeed: null, saved: [] }), [tile]);
  const linkSet = MARKETPLACE_LINK_SETS.find((l) => l.id === marketplaceId);

  return (
    <div className="workbench-marketplace-panel">
      <div className="marketplace-chips">
        {Object.values(MARKETPLACE_PROFILES).map((p) => (
          <button key={p.id} type="button" className={`marketplace-chip${p.id === marketplaceId ? ' active' : ''}`} onClick={() => setMarketplaceId(p.id)}>
            {p.label}
            {p.future ? ' 🔜' : ''}
          </button>
        ))}
      </div>

      <details open className="workbench-collapsible">
        <summary>📊 Readiness Score — {readiness.overall}/100</summary>
        <div className="workbench-quality-scores">
          {(['seoReadiness', 'filenameReadiness', 'metadataReadiness', 'marketplaceCompatibility', 'commercialReadiness'] as const).map((key) => (
            <div key={key} className={`workbench-quality-score ${scoreClass(readiness[key])}`}>
              <span>{SCORE_LABELS[key]}</span>
              <strong>{readiness[key]}</strong>
            </div>
          ))}
        </div>
        {readiness.issues.length > 0 && (
          <ul className="workbench-diff-list">
            {readiness.issues.map((issue) => (
              <li key={issue} className="workbench-diff-entry">
                {issue}
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="workbench-collapsible">
        <summary>✅ Validation {validationIssues.length > 0 ? `(${validationIssues.length})` : ''}</summary>
        {validationIssues.length === 0 && <p className="metadata-hint">No issues.</p>}
        <ul className="workbench-diff-list">
          {validationIssues.map((issue, i) => (
            <li key={i} className={`marketplace-issue marketplace-issue--${issue.severity}`}>
              {issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : '💡'} {issue.message}
            </li>
          ))}
        </ul>
      </details>

      <details className="workbench-collapsible">
        <summary>💡 SEO Hints</summary>
        <p className="metadata-hint">
          Title target: {hints.titleTarget.minLength}-{hints.titleTarget.maxLength} chars · Keywords target: {hints.keywordCountTarget.minCount}-{hints.keywordCountTarget.maxCount}{' '}
          {hints.keywordCountTarget.termLabel}
        </p>
        <p className="metadata-hint">
          Category suggestion: <strong>{hints.categorySuggestion}</strong> · Collection name suggestion: <strong>{hints.collectionNameSuggestion}</strong>
        </p>
        <span className="workbench-inspector-field-title">Keyword candidates ({hints.keywordCandidates.length})</span>
        <div className="workbench-motif-chips">
          {hints.keywordCandidates.slice(0, 30).map((k) => (
            <span key={k} className="marketplace-chip">
              {k}
            </span>
          ))}
        </div>
        {hints.hints.length > 0 && (
          <ul className="workbench-diff-list">
            {hints.hints.map((h) => (
              <li key={h.code} className="workbench-diff-entry">
                {h.message}
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="workbench-collapsible">
        <summary>🏷 Filename Hints</summary>
        <div className="metadata-field">
          <div className="metadata-field-top">
            <label>Filename</label>
            <CopyButton text={seo.filename} label=" Filename" />
          </div>
          <input type="text" className="marketplace-filename-input" readOnly value={seo.filename} />
        </div>
        <p className="metadata-hint">
          Template: <code>{profile.filenameRules.template}</code> · Max length: {profile.filenameRules.maxLength} · Extension: .{profile.filenameRules.extension}
        </p>
      </details>

      <details className="workbench-collapsible">
        <summary>📋 Submission Checklist</summary>
        <ul className="workbench-diff-list">
          {checklist.map((item) => (
            <li key={item.id} className="workbench-diff-entry">
              {item.status === 'ready' ? '✅' : item.status === 'warning' ? '⚠️' : '❌'} <strong>{item.label}</strong> — {item.detail}
            </li>
          ))}
        </ul>
      </details>

      <details className="workbench-collapsible">
        <summary>🔗 Contributor Links</summary>
        <div className="workbench-contributor-links">
          {linkSet &&
            CONTRIBUTOR_LINK_TYPES.map(({ key, label }) => {
              const entry = linkSet.links[key];
              return (
                <a
                  key={key}
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-btn"
                  title={entry.verified ? undefined : 'URL not yet verified'}
                >
                  🔗 {label}
                  {!entry.verified && ' ⚠️'}
                </a>
              );
            })}
        </div>
      </details>
    </div>
  );
}
