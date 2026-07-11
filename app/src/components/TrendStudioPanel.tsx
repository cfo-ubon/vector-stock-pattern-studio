import { useMemo, useState } from 'react';
import type { GenerateParams } from '../engine/types';
import { GENERATORS } from '../generators';
import { STYLE_DNA_PRESETS } from '../engine/styleDna';
import { MARKETPLACE_LIST, MARKETPLACE_PROFILES, type MarketplaceId } from '../metadata/marketplaceProfiles';
import { validateMarketplaceSeo, isMarketplaceReady } from '../metadata/marketplaceValidation';
import { buildSingleTileSvg } from '../export/svgExporter';
import { CopyButton } from './MetadataPanel';
import type { DesignSpecification, DifficultyId, KeywordBundle, SeasonId } from '../trend/designSpecTypes';
import { buildDesignSpecification } from '../trend/designIntelligence';
import { buildGenerateParamsFromDesignSpec, buildTileFromDesignSpec } from '../trend/designSpecToParams';
import { buildDesignSpecSeo } from '../trend/designSpecSeo';
import { PROMPT_PLATFORM_LIST, buildPrompt, type PromptPlatformId } from '../trend/promptTemplates';
import { TREND_PACK_LIST } from '../trend/trendPacks';
import { parseDesignSpecificationJson, validateDesignSpecification, isDesignSpecificationValid, type ValidationIssue } from '../trend/designSpecValidation';
import { runDesignSpecQualityLoop, type DesignSpecQualityLoopResult } from '../trend/designSpecQuality';

interface Props {
  onApplyToEditor: (params: GenerateParams) => void;
  onDownloadPackage: (spec: DesignSpecification, seed: string, marketplaceId: MarketplaceId) => void;
  onGenerateCollection: (spec: DesignSpecification, seed: string) => void;
  collectionStatus: 'idle' | 'building' | 'done';
  onClose: () => void;
}

const SEASONS: Array<{ id: SeasonId; label: string }> = [
  { id: 'spring', label: 'Spring' },
  { id: 'summer', label: 'Summer' },
  { id: 'autumn', label: 'Autumn' },
  { id: 'winter', label: 'Winter' },
  { id: 'yearRound', label: 'Year-round' },
];

const DIFFICULTIES: Array<{ id: DifficultyId; label: string }> = [
  { id: 'simple', label: 'Simple' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'complex', label: 'Complex' },
];

const CATEGORY_LIST = Object.values(GENERATORS);
const STYLE_DNA_LIST = Object.values(STYLE_DNA_PRESETS);

function newSeed(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultBundle(): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical',
    secondaryKeywords: ['Wallpaper', 'Editorial'],
    marketplace: 'adobestock',
    season: 'spring',
    audience: 'editorial / boutique buyers',
    commercialCategory: 'wallpaper',
    patternType: 'botanical',
    paletteDirection: '',
    difficulty: 'moderate',
    collectionSize: 8,
  };
}

/** Minimal, real, read-only JSON tree renderer (Section 6's "Tree View") —
 * recurses over the actual spec object, no separate schema description to
 * keep in sync. */
function JsonTreeNode({ label, value, depth }: { label: string; value: unknown; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  if (value === null || typeof value !== 'object') {
    return (
      <div className="json-tree-leaf" style={{ paddingLeft: depth * 14 }}>
        <span className="json-tree-key">{label}:</span> <span className="json-tree-value">{JSON.stringify(value)}</span>
      </div>
    );
  }
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value);
  return (
    <div className="json-tree-branch" style={{ paddingLeft: depth * 14 }}>
      <button type="button" className="json-tree-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} {label} {Array.isArray(value) ? `[${entries.length}]` : '{...}'}
      </button>
      {open && entries.map(([k, v]) => <JsonTreeNode key={k} label={k} value={v} depth={depth + 1} />)}
    </div>
  );
}

/** Trend Intelligence Studio (Section 1) — the market-driven design page:
 * Keyword Bundle input -> Trend Pack selection -> Design Intelligence ->
 * Design Specification JSON (the single source of truth) -> Review & Edit
 * (Section 6's JSON Editor: Code View + Tree View + Validation + Undo/
 * Redo) -> Live Preview (Section 13) -> real SVG generation (Section 8's
 * SVG Engine adapter) / SEO / Prompts / Marketplace Package, all reading
 * directly from the same spec object. Every generator this page calls
 * lives in `trend/` and is already independently unit-tested — this
 * component is purely the UI wiring. */
export function TrendStudioPanel({ onApplyToEditor, onDownloadPackage, onGenerateCollection, collectionStatus, onClose }: Props) {
  const [bundle, setBundle] = useState<KeywordBundle>(defaultBundle());
  const [secondaryKeywordsText, setSecondaryKeywordsText] = useState(defaultBundle().secondaryKeywords.join(', '));
  const [trendPackId, setTrendPackId] = useState<string | undefined>(undefined);

  const [history, setHistory] = useState<DesignSpecification[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const spec = historyIndex >= 0 ? history[historyIndex] : null;

  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [treeView, setTreeView] = useState(false);

  const [seed, setSeed] = useState<string>(() => newSeed('trend'));
  const [previewMarketplace, setPreviewMarketplace] = useState<MarketplaceId>('shutterstock');
  const [promptPlatform, setPromptPlatform] = useState<PromptPlatformId>('midjourney');
  const [qualityResult, setQualityResult] = useState<DesignSpecQualityLoopResult | null>(null);
  const [qualityRunning, setQualityRunning] = useState(false);

  function pushSpec(next: DesignSpecification) {
    setHistory((h) => [...h.slice(0, historyIndex + 1), next]);
    setHistoryIndex((i) => i + 1);
    setJsonText(JSON.stringify(next, null, 2));
    setJsonError(null);
    setQualityResult(null);
  }

  function handleGenerateSpec() {
    const nextSeed = newSeed('trend');
    setSeed(nextSeed);
    setQualityResult(null);
    const next = buildDesignSpecification({
      keywordBundle: { ...bundle, secondaryKeywords: secondaryKeywordsText.split(',').map((k) => k.trim()).filter(Boolean) },
      trendPackId,
      createdAt: Date.now(),
    });
    pushSpec(next);
  }

  function handleRunQualityLoop() {
    if (!spec) return;
    setQualityRunning(true);
    // Synchronous (engine/candidateEngine.ts's non-chunked generateBest,
    // 'fast' mode = 4 candidates/round) — fine for a manual "check quality"
    // action; a chunked/cancellable version (mirroring the main editor's
    // "Generate Best" quality mode) would be a future enhancement if this
    // becomes slow for heavy categories.
    setTimeout(() => {
      const result = runDesignSpecQualityLoop(spec, seed, 'fast');
      setQualityResult(result);
      setQualityRunning(false);
    }, 0);
  }

  function handleApplyJson() {
    try {
      const parsed = parseDesignSpecificationJson(jsonText);
      pushSpec(parsed);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleUndo() {
    if (historyIndex <= 0) return;
    setHistoryIndex((i) => i - 1);
    setJsonText(JSON.stringify(history[historyIndex - 1], null, 2));
    setJsonError(null);
    setQualityResult(null);
  }

  function handleRedo() {
    if (historyIndex >= history.length - 1) return;
    setHistoryIndex((i) => i + 1);
    setJsonText(JSON.stringify(history[historyIndex + 1], null, 2));
    setJsonError(null);
    setQualityResult(null);
  }

  const validationIssues: ValidationIssue[] = useMemo(() => (spec ? validateDesignSpecification(spec) : []), [spec]);

  const plainTile = useMemo(() => (spec ? buildTileFromDesignSpec(spec, seed) : null), [spec, seed]);
  // Once a quality loop has run, its winning candidate (whichever round
  // scored highest) replaces the plain single-shot tile in every preview —
  // real generated output, not a mockup, same as `plainTile`.
  const tile = qualityResult ? qualityResult.pool.winner.tileData : plainTile;
  const tileSvgHtml = useMemo(() => (tile ? buildSingleTileSvg(tile).replace(/^<\?xml[^>]*\?>\s*/, '') : ''), [tile]);

  const seo = useMemo(() => (spec && tile ? buildDesignSpecSeo(spec, tile, previewMarketplace) : null), [spec, tile, previewMarketplace]);
  const seoIssues = useMemo(() => (seo ? validateMarketplaceSeo(seo, MARKETPLACE_PROFILES[previewMarketplace]) : []), [seo, previewMarketplace]);

  const prompt = useMemo(() => (spec ? buildPrompt(spec, promptPlatform) : ''), [spec, promptPlatform]);

  return (
    <section className="trend-studio">
      <div className="metadata-header">
        <h2>🧠 Trend Intelligence Studio</h2>
        <button type="button" className="btn" onClick={onClose}>
          ← กลับหน้าสร้างลาย
        </button>
      </div>
      <p className="metadata-hint">
        กรอก Keyword Bundle → เลือก Marketplace/Trend Pack → ระบบสร้าง Design Specification JSON (ต้นแบบเดียวที่ทุกอย่างอ่านต่อ) →
        ดูตัวอย่างลาย/SEO/ชื่อไฟล์/Prompt ก่อนสร้างจริง
      </p>

      <div className="trend-studio-form">
        <label>
          Primary Keyword
          <input type="text" value={bundle.primaryKeyword} onChange={(e) => setBundle((b) => ({ ...b, primaryKeyword: e.target.value }))} />
        </label>
        <label>
          Secondary Keywords (คั่นด้วยจุลภาค)
          <input type="text" value={secondaryKeywordsText} onChange={(e) => setSecondaryKeywordsText(e.target.value)} />
        </label>
        <label>
          Marketplace
          <select value={bundle.marketplace} onChange={(e) => setBundle((b) => ({ ...b, marketplace: e.target.value as MarketplaceId }))}>
            {MARKETPLACE_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Season
          <select value={bundle.season} onChange={(e) => setBundle((b) => ({ ...b, season: e.target.value as SeasonId }))}>
            {SEASONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Audience
          <input type="text" value={bundle.audience} onChange={(e) => setBundle((b) => ({ ...b, audience: e.target.value }))} />
        </label>
        <label>
          Commercial Category
          <input type="text" value={bundle.commercialCategory} onChange={(e) => setBundle((b) => ({ ...b, commercialCategory: e.target.value }))} />
        </label>
        <label>
          Pattern Type
          <select value={bundle.patternType} onChange={(e) => setBundle((b) => ({ ...b, patternType: e.target.value }))}>
            {CATEGORY_LIST.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Style DNA
          <select value={bundle.styleDnaId ?? ''} onChange={(e) => setBundle((b) => ({ ...b, styleDnaId: e.target.value || undefined }))}>
            <option value="">— ให้ระบบเลือกจาก Keyword/Trend Pack —</option>
            {STYLE_DNA_LIST.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Palette Direction
          <input
            type="text"
            placeholder="เช่น muted green, jewel tones (เว้นว่าง = ให้ระบบเลือก)"
            value={bundle.paletteDirection}
            onChange={(e) => setBundle((b) => ({ ...b, paletteDirection: e.target.value }))}
          />
        </label>
        <label>
          Difficulty
          <select value={bundle.difficulty} onChange={(e) => setBundle((b) => ({ ...b, difficulty: e.target.value as DifficultyId }))}>
            {DIFFICULTIES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Collection Size
          <input
            type="number"
            min={1}
            value={bundle.collectionSize}
            onChange={(e) => setBundle((b) => ({ ...b, collectionSize: Math.max(1, Number(e.target.value) || 1) }))}
          />
        </label>
      </div>

      <div className="trend-pack-picker">
        <span className="metadata-hint">Trend Pack:</span>
        <button type="button" className={`marketplace-chip${trendPackId === undefined ? ' active' : ''}`} onClick={() => setTrendPackId(undefined)}>
          ✨ Auto-match
        </button>
        {TREND_PACK_LIST.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`marketplace-chip${trendPackId === p.id ? ' active' : ''}`}
            onClick={() => setTrendPackId(p.id)}
            title={p.mood}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button type="button" className="btn btn--primary" onClick={handleGenerateSpec}>
        🧠 Generate Design Specification
      </button>

      {spec && (
        <>
          <div className="trend-studio-actions">
            <button type="button" className="btn" onClick={handleUndo} disabled={historyIndex <= 0}>
              ↶ Undo
            </button>
            <button type="button" className="btn" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
              ↷ Redo
            </button>
            <button type="button" className="btn" onClick={() => setTreeView((v) => !v)}>
              {treeView ? '📝 Code View' : '🌳 Tree View'}
            </button>
          </div>

          <div className={`marketplace-ready-indicator marketplace-ready-indicator--${isDesignSpecificationValid(validationIssues) ? 'ready' : 'issues'}`}>
            {isDesignSpecificationValid(validationIssues) ? '✅ Design Specification ถูกต้อง' : `⚠️ มี ${validationIssues.filter((i) => i.severity === 'error').length} ปัญหา`}
          </div>
          {validationIssues.length > 0 && (
            <ul className="marketplace-issues">
              {validationIssues.map((issue, i) => (
                <li key={i} className={`marketplace-issue marketplace-issue--${issue.severity}`}>
                  {issue.severity === 'error' ? '❌' : '⚠️'} {issue.path}: {issue.message}
                </li>
              ))}
            </ul>
          )}

          {treeView ? (
            <div className="json-tree">
              <JsonTreeNode label="DesignSpecification" value={spec} depth={0} />
            </div>
          ) : (
            <div className="metadata-field">
              <div className="metadata-field-top">
                <label>Design Specification JSON</label>
                <div>
                  <CopyButton text={jsonText} label=" JSON" />
                  <button type="button" className="btn" onClick={handleApplyJson}>
                    ✅ Apply Edits
                  </button>
                </div>
              </div>
              <textarea className="trend-studio-json-editor" rows={16} value={jsonText} onChange={(e) => setJsonText(e.target.value)} />
              {jsonError && <p className="marketplace-issue marketplace-issue--error">❌ {jsonError}</p>}
            </div>
          )}

          <h3>🖼 Live Preview</h3>
          <div className="trend-studio-preview-grid">
            <div className="trend-studio-preview-card">
              <strong>Trend Summary</strong>
              <p>{spec.trend ? `${spec.trend.theme} — ${spec.trend.mood}` : 'ไม่ได้ผูก Trend Pack'}</p>
              <p>Composition: {spec.composition} · Density: {Math.round(spec.density * 100)}% · Negative Space: {Math.round(spec.negativeSpace * 100)}%</p>
            </div>
            <div className="trend-studio-preview-card">
              <strong>Moodboard</strong>
              <div className="trend-studio-swatches">
                {Object.entries(spec.colorRoles).map(([role, hex]) => (
                  <div key={role} className="trend-studio-swatch" style={{ background: hex }} title={`${role}: ${hex}`} />
                ))}
              </div>
            </div>
            <div className="trend-studio-preview-card">
              <strong>Palette ({spec.palette.id})</strong>
              <div className="trend-studio-swatches">
                {spec.palette.colors.map((c) => (
                  <div key={c} className="trend-studio-swatch" style={{ background: c }} title={c} />
                ))}
              </div>
            </div>
            <div className="trend-studio-preview-card">
              <strong>Motif Preview</strong>
              <p>Hero: {GENERATORS[spec.heroMotifs[0]?.categoryId]?.label ?? spec.heroMotifs[0]?.categoryId}</p>
              <p>Secondary: {spec.secondaryMotifs.map((m) => GENERATORS[m.categoryId]?.label ?? m.categoryId).join(', ') || '—'}</p>
              <p>Style DNA: {STYLE_DNA_PRESETS[spec.styleDnaId]?.label ?? spec.styleDnaId}</p>
            </div>
          </div>

          {tile && (
            <div className="collection-asset-preview">
              <div className="collection-asset-preview-header">
                <strong>Composition Diagram (ลายจริงที่สร้างจาก Design Spec นี้)</strong>
                <div className="trend-studio-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setSeed(newSeed('trend'));
                      setQualityResult(null);
                    }}
                  >
                    🎲 สุ่ม seed ใหม่
                  </button>
                  <button type="button" className="btn" onClick={handleRunQualityLoop} disabled={qualityRunning}>
                    {qualityRunning ? '⏳ กำลังตรวจ...' : '🎯 Run Quality Loop'}
                  </button>
                </div>
              </div>
              <div className="collection-asset-svg" dangerouslySetInnerHTML={{ __html: tileSvgHtml }} />
              <button type="button" className="btn btn--primary" onClick={() => onApplyToEditor(buildGenerateParamsFromDesignSpec(spec, seed))}>
                ✍️ ใช้ค่านี้ในหน้าสร้างลาย
              </button>

              {qualityResult && (
                <div className="trend-studio-quality-report">
                  <div
                    className={`marketplace-ready-indicator marketplace-ready-indicator--${qualityResult.check.meetsTargets ? 'ready' : 'issues'}`}
                  >
                    {qualityResult.check.meetsTargets
                      ? `✅ ผ่านเกณฑ์คุณภาพ (${qualityResult.roundsUsed}/${qualityResult.maxRounds} รอบ)`
                      : `⚠️ ยังไม่ผ่านเกณฑ์หลังลอง ${qualityResult.roundsUsed}/${qualityResult.maxRounds} รอบ — ใช้รอบที่คะแนนสูงสุด`}
                  </div>
                  <div className="trend-studio-quality-grid">
                    {Object.entries(qualityResult.check.report).map(([key, value]) => (
                      <div key={key} className="trend-studio-quality-metric">
                        <span>{key}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                  {qualityResult.check.shortfalls.length > 0 && (
                    <ul className="marketplace-issues">
                      {qualityResult.check.shortfalls.map((s, i) => (
                        <li key={i} className="marketplace-issue marketplace-issue--warning">
                          ⚠️ {s}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          <h3>🏭 Collection Generator</h3>
          <p className="metadata-hint">
            สร้างคอลเลกชันเต็ม (Hero/Secondary/Blender/Mini/Stripe/Border/Corner/Spot Motif Sheet) จาก Design Spec นี้ — ทุกชิ้นใช้ Style
            DNA/Palette/Motif Family เดียวกันโดยอัตโนมัติ บันทึกเข้าโปรเจกต์ที่เปิดอยู่ให้ทันที
          </p>
          <button type="button" className="btn btn--primary" onClick={() => onGenerateCollection(spec, seed)} disabled={collectionStatus === 'building'}>
            {collectionStatus === 'building' ? '🏭 กำลังสร้างคอลเลกชัน...' : '🏭 Generate Collection จาก Design Spec'}
          </button>

          <h3>📊 SEO Preview</h3>
          <div className="marketplace-chips">
            {MARKETPLACE_LIST.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`marketplace-chip${p.id === previewMarketplace ? ' active' : ''}`}
                onClick={() => setPreviewMarketplace(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {seo && (
            <div className="marketplace-fields">
              <div className="metadata-field">
                <div className="metadata-field-top">
                  <label>Title</label>
                  <CopyButton text={seo.title} label=" Title" />
                </div>
                <textarea rows={2} readOnly value={seo.title} />
              </div>
              {seo.description && (
                <div className="metadata-field">
                  <div className="metadata-field-top">
                    <label>Description</label>
                    <CopyButton text={seo.description} label=" Description" />
                  </div>
                  <textarea rows={3} readOnly value={seo.description} />
                </div>
              )}
              <div className="metadata-field">
                <div className="metadata-field-top">
                  <label>Keywords ({seo.keywords.length})</label>
                  <CopyButton text={seo.keywords.join(', ')} label=" Keywords" />
                </div>
                <textarea rows={2} readOnly value={seo.keywords.join(', ')} />
              </div>
              <div className="metadata-field">
                <div className="metadata-field-top">
                  <label>Filename</label>
                  <CopyButton text={seo.filename} label=" Filename" />
                </div>
                <input type="text" className="marketplace-filename-input" readOnly value={seo.filename} />
              </div>
              <p className="metadata-hint">
                Collection Name: <strong>{seo.collectionName}</strong> · Asset Name: <strong>{seo.assetName}</strong>
              </p>
              <div className={`marketplace-ready-indicator marketplace-ready-indicator--${isMarketplaceReady(seoIssues) ? 'ready' : 'issues'}`}>
                {isMarketplaceReady(seoIssues) ? '✅ พร้อมส่ง (Ready)' : `⚠️ มี ${seoIssues.filter((i) => i.severity === 'error').length} ปัญหาที่ต้องแก้ก่อนส่ง`}
              </div>
              <button type="button" className="btn btn--primary" onClick={() => onDownloadPackage(spec, seed, previewMarketplace)}>
                📦 ดาวน์โหลด Marketplace Package ({MARKETPLACE_PROFILES[previewMarketplace].label})
              </button>
            </div>
          )}

          <h3>🤖 Prompt Preview</h3>
          <div className="marketplace-chips">
            {PROMPT_PLATFORM_LIST.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`marketplace-chip${p.id === promptPlatform ? ' active' : ''}`}
                onClick={() => setPromptPlatform(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="metadata-field">
            <div className="metadata-field-top">
              <label>{PROMPT_PLATFORM_LIST.find((p) => p.id === promptPlatform)?.label} Prompt</label>
              <CopyButton text={prompt} label=" Prompt" />
            </div>
            <textarea rows={4} readOnly value={prompt} />
          </div>
        </>
      )}
    </section>
  );
}
