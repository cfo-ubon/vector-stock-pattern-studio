import { useMemo, useState } from 'react';
import type { DesignSpecification } from '../../trend/designSpecTypes';
import { buildGenerateParamsFromDesignSpec, buildTileFromDesignSpec } from '../../trend/designSpecToParams';
import { buildDesignSpecSeo } from '../../trend/designSpecSeo';
import { validateMarketplaceSeo, isMarketplaceReady } from '../../metadata/marketplaceValidation';
import { MARKETPLACE_PROFILES, type MarketplaceId } from '../../metadata/marketplaceProfiles';
import { buildSingleTileSvg, buildTiledSvg } from '../../export/svgExporter';
import { CopyButton } from '../MetadataPanel';
import { getMotifGrammar } from '../../services/motifGrammarService';
import type { GenerateParams } from '../../engine/types';
import type { DesignSpecQualityLoopResult } from '../../trend/designSpecQuality';

// Design Workbench Section 4 ("Live Preview") — every sub-preview reads
// directly from `spec` (a `useMemo` per tab keyed on `spec`/`seed`/
// selected marketplace, so switching tabs never recomputes stale data and
// every edit is reflected the instant the memo key changes). The SVG shown
// in "Composition Diagram"/"Pattern Repeat" is the *real* output of
// `trend/designSpecToParams.ts`'s `buildTileFromDesignSpec` — the same SVG
// Engine adapter the rest of the app already uses — not a mockup. The
// Prompt tab that used to live here was promoted to its own standalone
// `PromptPanel.tsx` in Phase 6, matching the brief's "Prompt Panel" as a
// separate dockable panel; Quality Indicators' full picture (all 6 named
// dimensions + recommendations) now lives in `QualityPanel.tsx` — the
// inline summary in the "Composition" tab below stays as an immediate,
// no-extra-click glance right after running the loop.

type PreviewTab = 'trend' | 'palette' | 'composition' | 'repeat' | 'motifs' | 'seo' | 'filename' | 'collection';

const TABS: Array<{ id: PreviewTab; label: string }> = [
  { id: 'trend', label: '📈 Trend Summary' },
  { id: 'palette', label: '🎨 Palette' },
  { id: 'composition', label: '🖼 Composition' },
  { id: 'repeat', label: '🔁 Pattern Repeat' },
  { id: 'motifs', label: '🌿 Motifs' },
  { id: 'seo', label: '📊 SEO' },
  { id: 'filename', label: '🏷 Filename' },
  { id: 'collection', label: '🏭 Collection' },
];

const ASSET_TYPE_LABELS: Record<string, string> = {
  heroPattern: 'Hero Pattern',
  secondaryPattern: 'Secondary Pattern',
  blenderPattern: 'Blender Pattern',
  miniPattern: 'Mini Pattern',
  stripePattern: 'Stripe Pattern',
  borderPattern: 'Border Pattern',
  cornerPattern: 'Corner Pattern',
  spotMotifSheet: 'Spot Motif Sheet',
};

interface Props {
  spec: DesignSpecification;
  seed: string;
  onRerollSeed: () => void;
  onApplyToEditor: (params: GenerateParams) => void;
  onRunQualityLoop: () => void;
  qualityResult: DesignSpecQualityLoopResult | null;
  qualityRunning: boolean;
  onGenerateCollection: () => void;
  collectionStatus: 'idle' | 'building' | 'done';
  onDownloadPackage: (marketplaceId: MarketplaceId) => void;
}

export function LivePreviewPanel({
  spec,
  seed,
  onRerollSeed,
  onApplyToEditor,
  onRunQualityLoop,
  qualityResult,
  qualityRunning,
  onGenerateCollection,
  collectionStatus,
  onDownloadPackage,
}: Props) {
  const [tab, setTab] = useState<PreviewTab>('trend');
  const [marketplaceId, setMarketplaceId] = useState(spec.marketplace.id);

  const plainTile = useMemo(() => buildTileFromDesignSpec(spec, seed), [spec, seed]);
  const tile = qualityResult ? qualityResult.pool.winner.tileData : plainTile;
  const tileSvgHtml = useMemo(() => buildSingleTileSvg(tile).replace(/^<\?xml[^>]*\?>\s*/, ''), [tile]);
  const tiledSvgHtml = useMemo(() => (tab === 'repeat' ? buildTiledSvg(tile, 3, 3).replace(/^<\?xml[^>]*\?>\s*/, '') : ''), [tile, tab]);
  const seo = useMemo(() => buildDesignSpecSeo(spec, tile, marketplaceId), [spec, tile, marketplaceId]);
  const seoIssues = useMemo(() => validateMarketplaceSeo(seo, MARKETPLACE_PROFILES[marketplaceId]), [seo, marketplaceId]);

  return (
    <div className="workbench-live-preview">
      <div className="workbench-view-switch workbench-view-switch--wrap" role="tablist" aria-label="Live Preview">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`workbench-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'trend' && (
        <div className="trend-studio-preview-card">
          <p>{spec.trend ? `${spec.trend.theme} — ${spec.trend.mood}` : 'No Trend Pack attached'}</p>
          <p>
            Composition: {spec.composition} · Density: {Math.round(spec.density * 100)}% · Negative space: {Math.round(spec.negativeSpace * 100)}%
          </p>
          <p>
            Season: {spec.seoHints.season} · Audience: {spec.seoHints.audience} · Category: {spec.seoHints.commercialCategory}
          </p>
        </div>
      )}

      {tab === 'palette' && (
        <div className="trend-studio-preview-card">
          <strong>Palette ({spec.palette.id})</strong>
          <div className="trend-studio-swatches">
            {spec.palette.colors.map((c) => (
              <div key={c} className="trend-studio-swatch" style={{ background: c }} title={c} />
            ))}
          </div>
          <strong>Color Roles</strong>
          <div className="trend-studio-swatches">
            {Object.entries(spec.colorRoles).map(([role, hex]) => (
              <div key={role} className="trend-studio-swatch" style={{ background: hex }} title={`${role}: ${hex}`} />
            ))}
          </div>
        </div>
      )}

      {tab === 'composition' && (
        <div className="collection-asset-preview">
          <div className="collection-asset-preview-header">
            <strong>Composition Diagram — real SVG Engine output for this spec</strong>
            <div className="trend-studio-actions">
              <button type="button" className="btn" onClick={onRerollSeed}>
                🎲 New seed
              </button>
              <button type="button" className="btn" onClick={onRunQualityLoop} disabled={qualityRunning}>
                {qualityRunning ? '⏳ Checking…' : '🎯 Run Quality Loop'}
              </button>
            </div>
          </div>
          <div className="collection-asset-svg" dangerouslySetInnerHTML={{ __html: tileSvgHtml }} />
          <button type="button" className="btn btn--primary" onClick={() => onApplyToEditor(buildGenerateParamsFromDesignSpec(spec, seed))}>
            ✍️ Use in Editor
          </button>

          {qualityResult && (
            <div className="trend-studio-quality-report">
              <div className={`marketplace-ready-indicator marketplace-ready-indicator--${qualityResult.check.meetsTargets ? 'ready' : 'issues'}`}>
                {qualityResult.check.meetsTargets
                  ? `✅ Meets quality targets (${qualityResult.roundsUsed}/${qualityResult.maxRounds} rounds)`
                  : `⚠️ Did not meet targets after ${qualityResult.roundsUsed}/${qualityResult.maxRounds} rounds — showing the best-scoring round`}
              </div>
              <div className="trend-studio-quality-grid">
                {Object.entries(qualityResult.check.report).map(([key, value]) => (
                  <div key={key} className="trend-studio-quality-metric">
                    <span>{key}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <p className="metadata-hint">Full scoring, all 6 named dimensions, and recommendations live in the Quality Panel.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'repeat' && (
        <div className="collection-asset-preview">
          <strong>Pattern Repeat — 3×3 tiled, real SVG Engine output (seamlessness check)</strong>
          <div className="collection-asset-svg" dangerouslySetInnerHTML={{ __html: tiledSvgHtml }} />
        </div>
      )}

      {tab === 'motifs' && (
        <div className="trend-studio-preview-card">
          {(
            [
              ['Hero', spec.heroMotifs],
              ['Secondary', spec.secondaryMotifs],
              ['Fillers', spec.fillers],
            ] as const
          ).map(([label, refs]) => (
            <div key={label}>
              <strong>{label}</strong>
              {refs.length === 0 && <p className="metadata-hint">— none —</p>}
              {refs.map((ref) => {
                const grammar = getMotifGrammar(ref.categoryId);
                return (
                  <p key={ref.categoryId}>
                    {grammar?.label ?? ref.categoryId} <span className="metadata-hint">({grammar?.family ?? 'unknown family'})</span>
                  </p>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {tab === 'seo' && (
        <div className="marketplace-fields">
          <div className="marketplace-chips">
            {Object.keys(MARKETPLACE_PROFILES).map((id) => (
              <button key={id} type="button" className={`marketplace-chip${id === marketplaceId ? ' active' : ''}`} onClick={() => setMarketplaceId(id as typeof marketplaceId)}>
                {MARKETPLACE_PROFILES[id as keyof typeof MARKETPLACE_PROFILES].label}
              </button>
            ))}
          </div>
          <div className="metadata-field">
            <div className="metadata-field-top">
              <label>Title</label>
              <CopyButton text={seo.title} label=" Title" />
            </div>
            <textarea rows={2} readOnly value={seo.title} />
          </div>
          <div className="metadata-field">
            <div className="metadata-field-top">
              <label>Keywords ({seo.keywords.length})</label>
              <CopyButton text={seo.keywords.join(', ')} label=" Keywords" />
            </div>
            <textarea rows={2} readOnly value={seo.keywords.join(', ')} />
          </div>
          <div className={`marketplace-ready-indicator marketplace-ready-indicator--${isMarketplaceReady(seoIssues) ? 'ready' : 'issues'}`}>
            {isMarketplaceReady(seoIssues) ? '✅ Ready' : `⚠️ ${seoIssues.filter((i) => i.severity === 'error').length} issue(s)`}
          </div>
        </div>
      )}

      {tab === 'filename' && (
        <div className="metadata-field">
          <div className="metadata-field-top">
            <label>Filename ({MARKETPLACE_PROFILES[marketplaceId].label})</label>
            <CopyButton text={seo.filename} label=" Filename" />
          </div>
          <input type="text" className="marketplace-filename-input" readOnly value={seo.filename} />
          <p className="metadata-hint">
            Collection: <strong>{seo.collectionName}</strong> · Asset: <strong>{seo.assetName}</strong>
          </p>
          <button type="button" className="btn btn--primary" onClick={() => onDownloadPackage(marketplaceId)}>
            📦 Download Marketplace Package ({MARKETPLACE_PROFILES[marketplaceId].label})
          </button>
        </div>
      )}

      {tab === 'collection' && (
        <div className="trend-studio-preview-card">
          <p>
            Planned collection size: <strong>{spec.collection.size}</strong>
          </p>
          <ul>
            {spec.collection.assetTypes.map((assetType) => (
              <li key={assetType}>{ASSET_TYPE_LABELS[assetType] ?? assetType}</li>
            ))}
          </ul>
          <p className="metadata-hint">This is a preview of planned assets only.</p>
          <button type="button" className="btn btn--primary" onClick={onGenerateCollection} disabled={collectionStatus === 'building'}>
            {collectionStatus === 'building' ? '🏭 Generating…' : '🏭 Generate Collection'}
          </button>
        </div>
      )}
    </div>
  );
}
