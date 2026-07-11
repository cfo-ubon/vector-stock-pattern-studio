import { useState } from 'react';
import type { DesignSpecification, DesignSpecMotifRef } from '../../trend/designSpecTypes';
import { listPalettes, resolveColorRolesForPalette } from '../../services/colorRoleService';
import { listStyleDna } from '../../services/styleDnaService';
import { listPatternGrammars } from '../../services/patternGrammarService';
import { listMotifGrammars, isRoleAllowed } from '../../services/motifGrammarService';
import { listMarketplaces, getMarketplace } from '../../services/marketplaceService';
import { LAYOUT_LIST } from '../../layouts';
import type { LayoutId } from '../../engine/types';
import type { MarketplaceId } from '../../metadata/marketplaceProfiles';

// Design Workbench Section 3 ("Property Inspector") — every field listed
// in the brief (Palette, Style DNA, Pattern, Composition, Density, Hero/
// Secondary/Filler Motifs, Quality Targets, Marketplace) as a structured
// edit control. Every option list comes from the Design Intelligence
// Core's services (`services/*Service.ts`, built for exactly this purpose)
// or the existing engine's own layout registry — this component computes
// nothing about design correctness itself; it only builds a patched
// `DesignSpecification` and hands it to `onUpdateSpec`. The Validation
// Panel (Section 4), not this component, is what tells the designer
// whether a combination is actually valid.

interface Props {
  spec: DesignSpecification;
  onUpdateSpec: (next: DesignSpecification) => void;
}

const PALETTES = listPalettes();
const STYLE_DNA_OPTIONS = listStyleDna();
const PATTERN_GRAMMAR_OPTIONS = listPatternGrammars();
const MOTIF_GRAMMAR_OPTIONS = listMotifGrammars();
const MARKETPLACE_OPTIONS = listMarketplaces();

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="workbench-inspector-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function MotifRefEditor({
  title,
  role,
  refs,
  onChange,
}: {
  title: string;
  role: DesignSpecMotifRef['role'];
  refs: DesignSpecMotifRef[];
  onChange: (next: DesignSpecMotifRef[]) => void;
}) {
  const [pendingCategory, setPendingCategory] = useState('');
  const available = MOTIF_GRAMMAR_OPTIONS.filter((g) => isRoleAllowed(g.id, role) && !refs.some((r) => r.categoryId === g.id));

  return (
    <div className="workbench-motif-editor">
      <span className="workbench-inspector-field-title">{title}</span>
      <div className="workbench-motif-chips">
        {refs.length === 0 && <span className="metadata-hint">— none —</span>}
        {refs.map((ref) => (
          <span key={ref.categoryId} className="marketplace-chip active">
            {ref.categoryId}
            <button
              type="button"
              aria-label={`Remove ${ref.categoryId}`}
              className="workbench-motif-remove"
              onClick={() => onChange(refs.filter((r) => r.categoryId !== ref.categoryId))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {available.length > 0 && (
        <div className="workbench-motif-add">
          <select value={pendingCategory} onChange={(e) => setPendingCategory(e.target.value)} aria-label={`Add a ${title.toLowerCase()} category`}>
            <option value="">— add category —</option>
            {available.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            disabled={!pendingCategory}
            onClick={() => {
              if (!pendingCategory) return;
              onChange([...refs, { categoryId: pendingCategory, role }]);
              setPendingCategory('');
            }}
          >
            + Add
          </button>
        </div>
      )}
    </div>
  );
}

export function PropertyInspector({ spec, onUpdateSpec }: Props) {
  function update(patch: Partial<DesignSpecification>) {
    onUpdateSpec({ ...spec, ...patch });
  }

  function handlePaletteChange(paletteId: string) {
    const palette = PALETTES.find((p) => p.id === paletteId);
    if (!palette) return;
    const roles = resolveColorRolesForPalette(paletteId);
    update({
      palette: { id: palette.id, colors: palette.colors },
      colorRoles: roles ? { background: roles.background, primary: roles.primary, secondary: roles.secondary, accent: roles.accent } : spec.colorRoles,
      background: { color: roles?.background ?? spec.background.color },
    });
  }

  function handleMarketplaceChange(marketplaceId: string) {
    const marketplace = getMarketplace(marketplaceId);
    if (!marketplace) return;
    update({
      marketplace: { id: marketplaceId as MarketplaceId },
      exportHints: { ...spec.exportHints, exportFormats: [marketplace.filenameRules.extension] },
    });
  }

  return (
    <div className="workbench-inspector">
      <Field label="Palette">
        <select value={spec.palette.id} onChange={(e) => handlePaletteChange(e.target.value)}>
          {PALETTES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="trend-studio-swatches">
        {spec.palette.colors.map((c) => (
          <div key={c} className="trend-studio-swatch" style={{ background: c }} title={c} />
        ))}
      </div>

      <Field label="Style DNA">
        <select value={spec.styleDnaId} onChange={(e) => update({ styleDnaId: e.target.value })}>
          {STYLE_DNA_OPTIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Pattern (repeat type)">
        <select value={spec.repeatType} onChange={(e) => update({ repeatType: e.target.value as LayoutId })}>
          {LAYOUT_LIST.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Composition">
        <select value={spec.composition} onChange={(e) => update({ composition: e.target.value as DesignSpecification['composition'] })}>
          {PATTERN_GRAMMAR_OPTIONS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label={`Density: ${Math.round(spec.density * 100)}%`}>
        <input type="range" min={0} max={1} step={0.01} value={spec.density} onChange={(e) => update({ density: Number(e.target.value) })} />
      </Field>

      <MotifRefEditor title="Hero Motifs" role="hero" refs={spec.heroMotifs} onChange={(refs) => update({ heroMotifs: refs })} />
      <MotifRefEditor title="Secondary Motifs" role="secondary" refs={spec.secondaryMotifs} onChange={(refs) => update({ secondaryMotifs: refs })} />
      <MotifRefEditor title="Fillers" role="filler" refs={spec.fillers} onChange={(refs) => update({ fillers: refs })} />

      <span className="workbench-inspector-field-title">Quality Targets</span>
      <div className="workbench-quality-grid">
        {(
          [
            ['minOverallScore', 'Overall score'],
            ['minSeamlessIntegrity', 'Seamless integrity'],
            ['minMotifDiversity', 'Motif diversity'],
            ['minCommercialReadiness', 'Commercial readiness'],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              type="number"
              min={0}
              max={100}
              value={spec.qualityTargets[key]}
              onChange={(e) => update({ qualityTargets: { ...spec.qualityTargets, [key]: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } })}
            />
          </Field>
        ))}
      </div>

      <Field label="Marketplace">
        <select value={spec.marketplace.id} onChange={(e) => handleMarketplaceChange(e.target.value)}>
          {MARKETPLACE_OPTIONS.map((m) => (
            <option key={m.id} value={m.id} disabled={m.future}>
              {m.label}
              {m.future ? ' (coming soon)' : ''}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
