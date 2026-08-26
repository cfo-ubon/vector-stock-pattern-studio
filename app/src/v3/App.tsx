import { useState } from 'react';
import { PRODUCT_NAME, PRODUCT_TAGLINE, PRODUCT_VERSION, VERSION_STATUS, VERSION_SELECTOR_PATH } from './appMeta';
import { analyzeKeyword, type DesignIntent } from './keywordIntent';
import { generateConcepts, refineConcept, type Concept } from './generateFromIntent';
import { getDesignCoachRecommendations } from './designCoach';
import { importConcept, runCommercialQualityGate, exportConceptToMarketplace, type CommercialQaResult } from './approveAndExport';
import type { ExportMarketplaceId, BulkExportResult } from '../commercial/exportWorkflow';
import { DownloadCenter } from '../components/portfolio/DownloadCenter';
import { VersionCenterDialog } from './VersionCenterDialog';
// DownloadCenter.tsx (reused verbatim, no v3-specific copy) renders with
// the shared `.portfolio-modal`/`.btn`/`.download-center-*` classes —
// importing the same stylesheet v2 uses keeps it looking and working
// identically instead of rendering unstyled or needing a duplicate CSS
// copy that could drift.
import '../components/portfolio/portfolio.css';
import './v3.css';

const MARKETPLACES: Array<{ id: ExportMarketplaceId; label: string }> = [
  { id: 'shutterstock', label: 'Shutterstock' },
  { id: 'adobestock', label: 'Adobe Stock' },
  { id: 'freepik', label: 'Freepik' },
  { id: 'getty', label: 'Getty / iStock' },
  { id: 'etsy', label: 'Etsy' },
];

type Screen = 'workspace' | 'brief' | 'gallery';

/** Real, on-screen rendering of a concept's SVG output — same
 * <svg viewBox=...><... dangerouslySetInnerHTML .../></svg> pattern the
 * shared `PreviewCanvas.tsx` already uses for the identical
 * `buildPreviewMarkup()` output shape, not a re-implementation. */
function TilePreview({ markup, repeat, tileSize, label }: { markup: string; repeat: number; tileSize: number; label: string }) {
  return (
    <svg
      viewBox={`0 0 ${tileSize * repeat} ${tileSize * repeat}`}
      role="img"
      aria-label={label}
      className="v3-tile-preview"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

const EXAMPLE_KEYWORDS = ['minimal botanical', 'cute dinosaur kids', 'christmas candy', 'japanese geometric', 'luxury abstract leaves', 'boho rainbow nursery'];

export default function App() {
  const [screen, setScreen] = useState<Screen>('workspace');
  const [keyword, setKeyword] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [intent, setIntent] = useState<DesignIntent | null>(null);
  const [showVersionCenter, setShowVersionCenter] = useState(false);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [refiningConceptId, setRefiningConceptId] = useState<string | null>(null);
  const [refineDraft, setRefineDraft] = useState<{ density: number; negativeSpace: number; motifSize: number; rotationJitter: number } | null>(null);
  const [approvingConceptId, setApprovingConceptId] = useState<string | null>(null);
  const [qaResult, setQaResult] = useState<CommercialQaResult | null>(null);
  const [qaMarketplace, setQaMarketplace] = useState<ExportMarketplaceId>('etsy');
  const [qaBusy, setQaBusy] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const [downloadPackages, setDownloadPackages] = useState<BulkExportResult[] | null>(null);

  const handleAnalyze = () => {
    if (!keyword.trim()) return;
    setIntent(analyzeKeyword(keyword));
    setScreen('brief');
  };

  const handleAdjust = () => {
    setScreen('workspace');
  };

  const handleGenerate = () => {
    if (!intent) return;
    setGenerating(true);
    // Real generation is synchronous CPU work (same as the shared
    // `generateBest`/`buildTileForGenerate` calls elsewhere in the app) —
    // yield one frame first so the "generating" state actually paints
    // before the main thread blocks.
    requestAnimationFrame(() => {
      const results = generateConcepts(intent, 5);
      setConcepts(results);
      setSelectedConceptId(null);
      setGenerating(false);
      setScreen('gallery');
    });
  };

  const openRefine = (concept: Concept) => {
    setRefiningConceptId(concept.id);
    setRefineDraft({
      density: concept.params.density,
      negativeSpace: concept.params.negativeSpace ?? 0,
      motifSize: concept.params.motifSize,
      rotationJitter: concept.params.rotationJitter,
    });
  };

  const handleRegenerateVersion = () => {
    const original = concepts.find((c) => c.id === refiningConceptId);
    if (!original || !refineDraft) return;
    const refined = refineConcept(original, refineDraft);
    // Non-destructive: the original stays in the array untouched; the new
    // version is inserted right after it (Milestone 11 — "never overwrite
    // the original").
    setConcepts((prev) => {
      const idx = prev.findIndex((c) => c.id === original.id);
      const next = [...prev];
      next.splice(idx + 1, 0, refined);
      return next;
    });
    setRefiningConceptId(null);
    setRefineDraft(null);
  };

  const handleApprove = async (concept: Concept) => {
    setApprovingConceptId(concept.id);
    setQaResult(null);
    setQaError(null);
    setQaBusy(true);
    try {
      const outcome = await importConcept(concept);
      if (outcome.status !== 'imported') {
        setQaError(`Import did not complete (${outcome.status}) — this asset may already exist in the Portfolio catalog.`);
        return;
      }
      const qa = await runCommercialQualityGate(concept, outcome.asset, qaMarketplace);
      setQaResult(qa);
    } catch (err) {
      setQaError(err instanceof Error ? err.message : 'Commercial QA failed unexpectedly.');
    } finally {
      setQaBusy(false);
    }
  };

  const handleExport = async () => {
    if (!qaResult) return;
    setQaBusy(true);
    setQaError(null);
    try {
      const results = await exportConceptToMarketplace(qaResult, qaMarketplace);
      setDownloadPackages(results);
    } catch (err) {
      setQaError(err instanceof Error ? err.message : 'Export failed unexpectedly.');
    } finally {
      setQaBusy(false);
    }
  };

  return (
    <div className="v3-shell">
      <header className="v3-header">
        <div>
          <h1>
            {PRODUCT_NAME} <span className="v3-tagline">{PRODUCT_TAGLINE}</span>
          </h1>
          <p>Keyword → Commercial Vector Seamless Pattern</p>
        </div>
        <div className="v3-identity-bar">
          <span className="v3-badge v3-badge--new">{VERSION_STATUS}</span>
          <button type="button" className="v3-version-badge" onClick={() => setShowVersionCenter(true)}>
            {PRODUCT_NAME} v{PRODUCT_VERSION}
          </button>
          <a className="v3-link" href={VERSION_SELECTOR_PATH} rel="noreferrer">
            🔁 Switch Version
          </a>
        </div>
      </header>

      <main className="v3-main">
        {screen === 'workspace' && (
          <section className="v3-keyword-workspace">
            <h2>What do you want to create?</h2>
            <p className="v3-hint">
              One keyword, a short phrase, comma-separated concepts, or a short natural-language brief. Example: <em>minimal botanical leaves</em>
            </p>
            <textarea
              className="v3-keyword-input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="minimal botanical leaves"
              rows={2}
              aria-label="What do you want to create?"
            />
            <div className="v3-examples">
              {EXAMPLE_KEYWORDS.map((ex) => (
                <button key={ex} type="button" className="v3-example-chip" onClick={() => setKeyword(ex)}>
                  {ex}
                </button>
              ))}
            </div>
            <button type="button" className="v3-btn v3-btn--primary" onClick={handleAnalyze} disabled={!keyword.trim()}>
              Analyze &amp; Design
            </button>

            <details className="v3-advanced" open={advancedOpen} onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}>
              <summary>Advanced</summary>
              <p className="v3-hint">
                Manual parameter control is not required for routine production. Advanced controls for direct category/palette/density
                overrides will be added alongside the generation engine (V3-C onward).
              </p>
            </details>
          </section>
        )}

        {screen === 'brief' && intent && (
          <section className="v3-design-brief" aria-label="Design Brief">
            <h2>Design Brief</h2>
            <dl className="v3-brief-grid">
              <dt>Keyword</dt>
              <dd>{intent.keyword}</dd>

              <dt>Design Direction</dt>
              <dd>
                {intent.subject} — {intent.style}
              </dd>

              <dt>Motifs</dt>
              <dd>
                {intent.categoryId} ({intent.motifComplexity} complexity)
              </dd>

              <dt>Palette Direction</dt>
              <dd>{intent.paletteDirection}</dd>

              <dt>Composition</dt>
              <dd>
                {intent.composition} — density: {intent.density}
              </dd>

              <dt>Target Uses</dt>
              <dd>{intent.targetUses.join(', ')}</dd>

              <dt>Commercial Intent</dt>
              <dd>{intent.commercialIntent}</dd>

              <dt>Confidence</dt>
              <dd>
                {intent.confidence}% {intent.confidence === 0 ? '(no recognizable design terms — try a more specific keyword)' : ''}
              </dd>
            </dl>

            <div className="v3-brief-actions">
              <button type="button" className="v3-btn" onClick={handleAdjust}>
                Adjust
              </button>
              <button type="button" className="v3-btn v3-btn--primary" onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generating…' : 'Generate'}
              </button>
            </div>
            <p className="v3-hint">
              Generates 5 real, meaningfully different vector seamless concepts from this brief, each checked against the mandatory
              Vector Integrity and Seamless Integrity gates.
            </p>
          </section>
        )}

        {screen === 'gallery' && (
          <section className="v3-gallery-screen" aria-label="Preview Gallery">
            <div className="v3-gallery-header">
              <h2>Preview Gallery</h2>
              <button type="button" className="v3-btn" onClick={handleAdjust}>
                ← Adjust keyword
              </button>
            </div>
            <div className="v3-gallery-grid">
              {concepts.map((concept) => (
                <article key={concept.id} className="v3-gallery-card">
                  <TilePreview markup={concept.seamlessIntegrity.tilePreviewMarkup1x1} repeat={1} tileSize={concept.params.tileSize} label={concept.label} />
                  <h3>{concept.label}</h3>
                  <div className="v3-gallery-badges">
                    <span className={`v3-gate-badge ${concept.vectorIntegrity.status === 'VECTOR_PASS' ? 'v3-gate-badge--pass' : 'v3-gate-badge--blocked'}`}>
                      {concept.vectorIntegrity.status === 'VECTOR_PASS' ? 'VECTOR PASS' : 'VECTOR BLOCKED'}
                    </span>
                    <span className={`v3-gate-badge ${concept.seamlessIntegrity.status === 'SEAMLESS_PASS' ? 'v3-gate-badge--pass' : 'v3-gate-badge--blocked'}`}>
                      {concept.seamlessIntegrity.status === 'SEAMLESS_PASS' ? 'SEAMLESS PASS' : 'SEAMLESS BLOCKED'}
                    </span>
                  </div>
                  <p className="v3-hint">
                    Corner continuity: {concept.seamlessIntegrity.cornerContinuity} · Composition: {concept.metrics.composition}
                  </p>
                  <div className="v3-gallery-card-actions">
                    <button type="button" className="v3-btn" onClick={() => setSelectedConceptId(concept.id)}>
                      Open 3×3 preview
                    </button>
                    <button type="button" className="v3-btn" onClick={() => openRefine(concept)}>
                      Refine
                    </button>
                  </div>
                  <button
                    type="button"
                    className="v3-btn v3-btn--primary"
                    onClick={() => handleApprove(concept)}
                    disabled={!concept.overallReady}
                    title={concept.overallReady ? undefined : 'Vector Integrity and Seamless Integrity must both PASS before Commercial QA'}
                  >
                    Approve → Commercial QA
                  </button>
                </article>
              ))}
            </div>

            {refiningConceptId &&
              refineDraft &&
              (() => {
                const original = concepts.find((c) => c.id === refiningConceptId);
                if (!original) return null;
                const recommendations = getDesignCoachRecommendations(original.tileData, original.metrics);
                return (
                  <div className="v3-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Refine — ${original.label}`}>
                    <div className="v3-modal">
                      <div className="v3-modal-header">
                        <h2>Refine — {original.label}</h2>
                        <button type="button" className="v3-btn" onClick={() => setRefiningConceptId(null)}>
                          Close
                        </button>
                      </div>

                      <section>
                        <h3>AI Design Coach</h3>
                        <ul className="v3-coach-list">
                          {recommendations.map((rec) => (
                            <li key={rec.id}>{rec.message}</li>
                          ))}
                        </ul>
                      </section>

                      <label className="v3-refine-field">
                        Density: {refineDraft.density.toFixed(2)}
                        <input
                          type="range"
                          min={0.1}
                          max={1}
                          step={0.05}
                          value={refineDraft.density}
                          onChange={(e) => setRefineDraft({ ...refineDraft, density: Number(e.target.value) })}
                        />
                      </label>
                      <label className="v3-refine-field">
                        Negative space: {refineDraft.negativeSpace.toFixed(2)}
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={refineDraft.negativeSpace}
                          onChange={(e) => setRefineDraft({ ...refineDraft, negativeSpace: Number(e.target.value) })}
                        />
                      </label>
                      <label className="v3-refine-field">
                        Motif scale: {refineDraft.motifSize.toFixed(0)}
                        <input
                          type="range"
                          min={Math.max(10, refineDraft.motifSize * 0.5)}
                          max={refineDraft.motifSize * 1.5}
                          step={1}
                          value={refineDraft.motifSize}
                          onChange={(e) => setRefineDraft({ ...refineDraft, motifSize: Number(e.target.value) })}
                        />
                      </label>
                      <label className="v3-refine-field">
                        Rotation jitter: {refineDraft.rotationJitter.toFixed(0)}°
                        <input
                          type="range"
                          min={0}
                          max={45}
                          step={1}
                          value={refineDraft.rotationJitter}
                          onChange={(e) => setRefineDraft({ ...refineDraft, rotationJitter: Number(e.target.value) })}
                        />
                      </label>

                      <div className="v3-brief-actions">
                        <button type="button" className="v3-btn" onClick={() => setRefiningConceptId(null)}>
                          Cancel
                        </button>
                        <button type="button" className="v3-btn v3-btn--primary" onClick={handleRegenerateVersion}>
                          Regenerate Version
                        </button>
                      </div>
                      <p className="v3-hint">Creates a new version below the original in the gallery — the original is never overwritten.</p>
                    </div>
                  </div>
                );
              })()}

            {selectedConceptId &&
              (() => {
                const concept = concepts.find((c) => c.id === selectedConceptId);
                if (!concept) return null;
                return (
                  <div className="v3-modal-backdrop" role="dialog" aria-modal="true" aria-label={`${concept.label} — 3×3 repeat preview`}>
                    <div className="v3-modal v3-modal--wide">
                      <div className="v3-modal-header">
                        <h2>{concept.label} — 3×3 repeat preview</h2>
                        <button type="button" className="v3-btn" onClick={() => setSelectedConceptId(null)}>
                          Close
                        </button>
                      </div>
                      <TilePreview
                        markup={concept.seamlessIntegrity.repeatPreviewMarkup3x3}
                        repeat={3}
                        tileSize={concept.params.tileSize}
                        label={`${concept.label} 3x3 repeat`}
                      />
                      {concept.seamlessIntegrity.issues.length > 0 && (
                        <ul className="v3-hint">
                          {concept.seamlessIntegrity.issues.map((issue) => (
                            <li key={issue.code}>{issue.detail}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })()}

            {approvingConceptId && (
              <div className="v3-modal-backdrop" role="dialog" aria-modal="true" aria-label="Commercial QA">
                <div className="v3-modal">
                  <div className="v3-modal-header">
                    <h2>Commercial QA{downloadPackages ? ' — Export Ready' : ''}</h2>
                    <button
                      type="button"
                      className="v3-btn"
                      onClick={() => {
                        setApprovingConceptId(null);
                        setQaResult(null);
                        setDownloadPackages(null);
                        setQaError(null);
                      }}
                    >
                      Close
                    </button>
                  </div>

                  {qaBusy && <p className="v3-hint">Running Commercial QA…</p>}
                  {qaError && <p className="v3-hint">⚠️ {qaError}</p>}

                  {qaResult && !downloadPackages && (
                    <>
                      <p className={`v3-overall-status v3-overall-status--${qaResult.overallStatus.toLowerCase()}`}>Overall: {qaResult.overallStatus}</p>
                      <ul className="v3-gate-list">
                        {qaResult.gates.map((gate) => (
                          <li key={gate.id}>
                            <span className={`v3-gate-badge ${gate.status === 'PASS' ? 'v3-gate-badge--pass' : 'v3-gate-badge--blocked'}`}>
                              {gate.label}: {gate.status}
                            </span>
                            <span className="v3-hint"> {gate.detail}</span>
                          </li>
                        ))}
                      </ul>

                      <label className="v3-refine-field">
                        Marketplace
                        <select value={qaMarketplace} onChange={(e) => setQaMarketplace(e.target.value as ExportMarketplaceId)}>
                          {MARKETPLACES.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <p className="v3-hint">
                        {qaResult.seoPackage.title} — {qaResult.seoPackage.keywords.length} keywords generated for {qaMarketplace}.
                      </p>

                      <button
                        type="button"
                        className="v3-btn v3-btn--primary"
                        onClick={handleExport}
                        disabled={qaBusy || qaResult.overallStatus === 'BLOCKED'}
                        title={qaResult.overallStatus === 'BLOCKED' ? 'Resolve blocked gates before export' : undefined}
                      >
                        Export to {MARKETPLACES.find((m) => m.id === qaMarketplace)?.label}
                      </button>
                    </>
                  )}

                  {downloadPackages && (
                    <p className="v3-hint">Export complete — {downloadPackages.length} package(s) built. Use the Download Center below.</p>
                  )}
                </div>
              </div>
            )}

            {downloadPackages && (
              <DownloadCenter
                packages={downloadPackages}
                onClose={() => {
                  setDownloadPackages(null);
                  setApprovingConceptId(null);
                  setQaResult(null);
                }}
              />
            )}
          </section>
        )}
      </main>

      {showVersionCenter && <VersionCenterDialog onClose={() => setShowVersionCenter(false)} />}
    </div>
  );
}
