import { useState } from 'react';
import { PRODUCT_NAME, PRODUCT_TAGLINE, PRODUCT_VERSION, VERSION_STATUS, VERSION_SELECTOR_PATH } from './appMeta';
import { analyzeKeyword, type DesignIntent } from './keywordIntent';
import { VersionCenterDialog } from './VersionCenterDialog';
import './v3.css';

type Screen = 'workspace' | 'brief';

const EXAMPLE_KEYWORDS = ['minimal botanical', 'cute dinosaur kids', 'christmas candy', 'japanese geometric', 'luxury abstract leaves', 'boho rainbow nursery'];

export default function App() {
  const [screen, setScreen] = useState<Screen>('workspace');
  const [keyword, setKeyword] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [intent, setIntent] = useState<DesignIntent | null>(null);
  const [showVersionCenter, setShowVersionCenter] = useState(false);

  const handleAnalyze = () => {
    if (!keyword.trim()) return;
    setIntent(analyzeKeyword(keyword));
    setScreen('brief');
  };

  const handleAdjust = () => {
    setScreen('workspace');
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
              <button type="button" className="v3-btn v3-btn--primary" disabled title="Generation (V3-C) not yet implemented">
                Generate
              </button>
            </div>
            <p className="v3-hint">
              Vector generation, seamless validation, and preview are implemented in the next development slice (V3-C/D) — this Design
              Brief is real, derived from your keyword by the local Keyword Intent Engine, not a placeholder.
            </p>
          </section>
        )}
      </main>

      {showVersionCenter && <VersionCenterDialog onClose={() => setShowVersionCenter(false)} />}
    </div>
  );
}
