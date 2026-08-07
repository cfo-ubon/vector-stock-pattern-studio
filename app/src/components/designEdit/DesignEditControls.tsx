import type { GenerateParams } from '../../engine/types';
import { GENERATOR_LIST } from '../../generators';
import { LAYOUT_LIST } from '../../layouts';
import { PALETTES } from '../../palettes/palettes';
import { HIERARCHY_PRESETS } from '../../engine/hierarchy';
import { randomSeed } from '../../engine/rng';

interface Props {
  params: GenerateParams;
  onChange: (patch: Partial<GenerateParams>) => void;
}

/** Design Refinement Studio Pro, Mission 3 — Editable Design Model. Every
 * control here is a real, already-existing `GenerateParams` field (the
 * exact same model `ControlPanel.tsx`/Style DNA already edit) — this is a
 * second, focused editor for the Design Edit Mode context (it does not
 * duplicate `ControlPanel.tsx`'s batch-production/gallery-specific
 * plumbing, only the pattern-shape controls relevant to refining one
 * already-generated asset). Only fields with a real underlying param are
 * exposed; nothing here writes to a property that doesn't exist. */
export function DesignEditControls({ params, onChange }: Props) {
  const activeHierarchyPresetId =
    Object.entries(HIERARCHY_PRESETS).find(([, p]) => JSON.stringify(p.value) === JSON.stringify(params.hierarchy))?.[0] ?? 'custom';

  return (
    <div className="design-edit-controls">
      <div className="design-edit-field-row">
        <label htmlFor="de-seed">Seed</label>
        <input id="de-seed" type="text" value={params.seed} onChange={(e) => onChange({ seed: e.target.value })} />
        <button type="button" className="btn btn--small" onClick={() => onChange({ seed: randomSeed() })}>
          🎲
        </button>
      </div>

      <div className="design-edit-field-row">
        <label htmlFor="de-category">Category</label>
        <select id="de-category" value={params.categoryId} onChange={(e) => onChange({ categoryId: e.target.value })}>
          {GENERATOR_LIST.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      <div className="design-edit-field-row">
        <label htmlFor="de-layout">Layout</label>
        <select id="de-layout" value={params.layoutId} onChange={(e) => onChange({ layoutId: e.target.value as GenerateParams['layoutId'] })}>
          {LAYOUT_LIST.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="design-edit-field-row">
        <label htmlFor="de-palette">Palette</label>
        <select id="de-palette" value={params.paletteId} onChange={(e) => onChange({ paletteId: e.target.value })}>
          {PALETTES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="design-edit-field-row">
        <label htmlFor="de-color-count">Color Count: {params.colorCount}</label>
        <input id="de-color-count" type="range" min={2} max={8} step={1} value={params.colorCount} onChange={(e) => onChange({ colorCount: Number(e.target.value) })} />
      </div>

      <div className="design-edit-field-row">
        <label>
          <input type="checkbox" checked={params.colorHarmonyBias ?? false} onChange={(e) => onChange({ colorHarmonyBias: e.target.checked })} /> Color Harmony
        </label>
      </div>

      <div className="design-edit-field-row">
        <label htmlFor="de-density">Motif Density: {Math.round(params.density * 100)}%</label>
        <input id="de-density" type="range" min={0} max={1} step={0.05} value={params.density} onChange={(e) => onChange({ density: Number(e.target.value) })} />
      </div>

      <div className="design-edit-field-row">
        <label htmlFor="de-negative-space">Negative Space: {Math.round((params.negativeSpace ?? 0) * 100)}%</label>
        <input
          id="de-negative-space"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={params.negativeSpace ?? 0}
          onChange={(e) => onChange({ negativeSpace: Number(e.target.value) })}
        />
      </div>

      <div className="design-edit-field-row">
        <label htmlFor="de-overlap">Overlap: {Math.round((params.overlapAmount ?? 0) * 100)}%</label>
        <input
          id="de-overlap"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={params.overlapAmount ?? 0}
          onChange={(e) => onChange({ overlapAmount: Number(e.target.value) })}
        />
      </div>

      <div className="design-edit-field-row">
        <label htmlFor="de-rotation">Rotation Jitter: {Math.round(params.rotationJitter * 100)}%</label>
        <input id="de-rotation" type="range" min={0} max={1} step={0.05} value={params.rotationJitter} onChange={(e) => onChange({ rotationJitter: Number(e.target.value) })} />
      </div>

      <div className="design-edit-field-row">
        <label htmlFor="de-scale-jitter">Scale Jitter: {Math.round(params.scaleJitter * 100)}%</label>
        <input id="de-scale-jitter" type="range" min={0} max={1} step={0.05} value={params.scaleJitter} onChange={(e) => onChange({ scaleJitter: Number(e.target.value) })} />
      </div>

      <div className="design-edit-field-row">
        <label htmlFor="de-pattern-scale">Pattern Scale: {(params.patternScale ?? 1).toFixed(2)}×</label>
        <input
          id="de-pattern-scale"
          type="range"
          min={0.5}
          max={2}
          step={0.05}
          value={params.patternScale ?? 1}
          onChange={(e) => onChange({ patternScale: Number(e.target.value) })}
        />
      </div>

      <div className="design-edit-field-row">
        <label>
          <input type="checkbox" checked={params.mirror} onChange={(e) => onChange({ mirror: e.target.checked })} /> Mirror
        </label>
      </div>

      <div className="design-edit-field-row">
        <label htmlFor="de-symmetry">Radial Symmetry: {params.radialSymmetry}</label>
        <input id="de-symmetry" type="range" min={0} max={8} step={1} value={params.radialSymmetry} onChange={(e) => onChange({ radialSymmetry: Number(e.target.value) })} />
      </div>

      <div className="design-edit-field-row">
        <label htmlFor="de-hierarchy">Hierarchy (Hero / Secondary / Accent)</label>
        <select
          id="de-hierarchy"
          value={activeHierarchyPresetId}
          onChange={(e) => {
            const preset = HIERARCHY_PRESETS[e.target.value];
            if (preset) onChange({ hierarchy: preset.value });
          }}
        >
          {activeHierarchyPresetId === 'custom' && <option value="custom">Custom</option>}
          {Object.entries(HIERARCHY_PRESETS).map(([id, p]) => (
            <option key={id} value={id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
