import { useMemo, useState } from 'react';
import type { DesignSpecification } from '../../trend/designSpecTypes';
import { CopyButton } from '../MetadataPanel';
import { JsonTreeView } from './JsonTreeView';
import { collectContainerPaths } from '../../workbench/jsonTreeUtils';

// Design Workbench Section 2 ("Design Specification Panel") — Tree View /
// JSON Code View / Inspector View + Search + Collapse/Expand, all reading
// the exact same `spec` object the Design Intelligence Engine produced (no
// re-derivation). Code View editing round-trips through
// `trend/designSpecValidation.ts`'s parseDesignSpecificationJson — the
// same parser used everywhere else JSON is imported.

export type DesignSpecViewMode = 'tree' | 'code' | 'inspector';

interface Props {
  spec: DesignSpecification;
  onApplyJson: (json: string) => string | null; // returns an error message, or null on success
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="workbench-inspector-row">
      <span className="workbench-inspector-label">{label}</span>
      <span className="workbench-inspector-value">{value}</span>
    </div>
  );
}

function InspectorView({ spec }: { spec: DesignSpecification }) {
  return (
    <div className="workbench-inspector-view">
      <section>
        <h4>Project</h4>
        <InspectorRow label="Name" value={spec.project.name} />
        <InspectorRow label="Created" value={new Date(spec.project.createdAt).toLocaleString()} />
        <InspectorRow label="Schema version" value={String(spec.schemaVersion)} />
      </section>
      <section>
        <h4>Trend &amp; Marketplace</h4>
        <InspectorRow label="Trend Pack" value={spec.trend ? `${spec.trend.trendPackId} — ${spec.trend.theme}` : '— none —'} />
        <InspectorRow label="Mood" value={spec.trend?.mood ?? '—'} />
        <InspectorRow label="Marketplace" value={spec.marketplace.id} />
        <InspectorRow label="Season" value={spec.seoHints.season} />
        <InspectorRow label="Audience" value={spec.seoHints.audience} />
      </section>
      <section>
        <h4>Style</h4>
        <InspectorRow label="Style DNA" value={spec.styleDnaId} />
        <InspectorRow label="Palette" value={`${spec.palette.id} (${spec.palette.colors.length} colors)`} />
        <InspectorRow label="Flow / Rhythm" value={`${spec.flow} / ${spec.rhythm}`} />
      </section>
      <section>
        <h4>Composition</h4>
        <InspectorRow label="Composition style" value={spec.composition} />
        <InspectorRow label="Repeat type" value={spec.repeatType} />
        <InspectorRow label="Density" value={`${Math.round(spec.density * 100)}%`} />
        <InspectorRow label="Negative space" value={`${Math.round(spec.negativeSpace * 100)}%`} />
      </section>
      <section>
        <h4>Motifs</h4>
        <InspectorRow label="Hero" value={spec.heroMotifs.map((m) => m.categoryId).join(', ') || '—'} />
        <InspectorRow label="Secondary" value={spec.secondaryMotifs.map((m) => m.categoryId).join(', ') || '—'} />
        <InspectorRow label="Fillers" value={spec.fillers.map((m) => m.categoryId).join(', ') || '—'} />
      </section>
      <section>
        <h4>Quality Targets</h4>
        <InspectorRow label="Overall score ≥" value={String(spec.qualityTargets.minOverallScore)} />
        <InspectorRow label="Seamless integrity ≥" value={String(spec.qualityTargets.minSeamlessIntegrity)} />
        <InspectorRow label="Motif diversity ≥" value={String(spec.qualityTargets.minMotifDiversity)} />
        <InspectorRow label="Commercial readiness ≥" value={String(spec.qualityTargets.minCommercialReadiness)} />
      </section>
    </div>
  );
}

export function DesignSpecPanel({ spec, onApplyJson }: Props) {
  const [mode, setMode] = useState<DesignSpecViewMode>('tree');
  const [search, setSearch] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(['$']));
  const [jsonText, setJsonText] = useState(() => JSON.stringify(spec, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [lastAppliedSpec, setLastAppliedSpec] = useState(spec);

  // Keep the Code View's textarea in sync with external spec changes
  // (Property Inspector edits, Undo/Redo, snapshot restore) without
  // clobbering in-progress unsaved edits the user hasn't applied yet.
  if (spec !== lastAppliedSpec) {
    setLastAppliedSpec(spec);
    setJsonText(JSON.stringify(spec, null, 2));
    setJsonError(null);
  }

  const allContainerPaths = useMemo(() => new Set(collectContainerPaths(spec)), [spec]);

  function handleApply() {
    const error = onApplyJson(jsonText);
    setJsonError(error);
  }

  function handleToggle(path: string) {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <div className="workbench-spec-panel">
      <div className="workbench-spec-panel-toolbar">
        <div className="workbench-view-switch" role="tablist" aria-label="Design Specification view">
          {(['tree', 'code', 'inspector'] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} className={`workbench-tab${mode === m ? ' active' : ''}`} onClick={() => setMode(m)}>
              {m === 'tree' ? '🌳 Tree' : m === 'code' ? '📝 Code' : '🔍 Inspector'}
            </button>
          ))}
        </div>
        {mode === 'tree' && (
          <div className="workbench-spec-panel-tools">
            <input type="search" placeholder="Search keys/values…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search Design Specification" />
            <button type="button" className="btn" onClick={() => setExpandedPaths(allContainerPaths)}>
              Expand all
            </button>
            <button type="button" className="btn" onClick={() => setExpandedPaths(new Set())}>
              Collapse all
            </button>
          </div>
        )}
      </div>

      {mode === 'tree' && (
        <div className="json-tree">
          <JsonTreeView label="DesignSpecification" value={spec} search={search} expandedPaths={expandedPaths} onToggle={handleToggle} />
        </div>
      )}

      {mode === 'code' && (
        <div className="metadata-field">
          <div className="metadata-field-top">
            <label>Design Specification JSON</label>
            <div>
              <CopyButton text={jsonText} label=" JSON" />
              <button type="button" className="btn btn--primary" onClick={handleApply}>
                ✅ Apply Edits
              </button>
            </div>
          </div>
          <textarea className="trend-studio-json-editor" rows={20} value={jsonText} onChange={(e) => setJsonText(e.target.value)} spellCheck={false} />
          {jsonError && <p className="marketplace-issue marketplace-issue--error">❌ {jsonError}</p>}
        </div>
      )}

      {mode === 'inspector' && <InspectorView spec={spec} />}
    </div>
  );
}
