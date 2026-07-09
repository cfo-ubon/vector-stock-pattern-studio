import type { GenerateParams, LayoutId } from '../engine/types';
import { GENERATOR_LIST } from '../generators';
import { LAYOUT_LIST } from '../layouts';
import { PALETTES } from '../palettes/palettes';
import { randomSeed } from '../engine/rng';

// Snap to the nearest 5% step and avoid floating-point noise (0.15000000000000002).
function round5(v: number): number {
  return Math.round(v * 20) / 20;
}

interface Props {
  params: GenerateParams;
  onChange: (patch: Partial<GenerateParams>) => void;
  onGenerate: () => void;
  onRandomizeAll: () => void;
  onGenerateBatch: () => void;
  onExportSingle: () => void;
  onExportTiled: () => void;
  onReset: () => void;
  aiPanel?: React.ReactNode;
}

export function ControlPanel({ params, onChange, onGenerate, onRandomizeAll, onGenerateBatch, onExportSingle, onExportTiled, onReset, aiPanel }: Props) {
  return (
    <div className="control-panel">
      <section>
        <h3>Category</h3>
        <div className="chip-row">
          {GENERATOR_LIST.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`chip ${params.categoryId === g.id ? 'chip--active' : ''}`}
              title={g.description}
              onClick={() =>
                onChange({
                  categoryId: g.id,
                  motifSize: g.defaultMotifSize,
                  ...(g.recommendedDensity !== undefined ? { density: g.recommendedDensity } : {}),
                })
              }
            >
              {g.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Layout</h3>
        <div className="chip-row">
          {LAYOUT_LIST.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`chip ${params.layoutId === l.id ? 'chip--active' : ''}`}
              onClick={() => onChange({ layoutId: l.id as LayoutId })}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Palette</h3>
        <div className="palette-grid">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`palette-swatch ${params.paletteId === p.id ? 'palette-swatch--active' : ''}`}
              title={p.label}
              onClick={() => onChange({ paletteId: p.id })}
            >
              {p.colors.slice(0, 5).map((c) => (
                <span key={c} style={{ background: c }} />
              ))}
            </button>
          ))}
        </div>
        <label className="field">
          <span>Colors: {params.colorCount}</span>
          <input
            type="range"
            min={2}
            max={6}
            value={params.colorCount}
            onChange={(e) => onChange({ colorCount: Number(e.target.value) })}
          />
        </label>
      </section>

      <section>
        <h3>Diversity controls</h3>
        <label className="field">
          <span>Density: {Math.round(params.density * 100)}%</span>
          <div className="stepper-row">
            <button
              type="button"
              className="stepper-btn"
              aria-label="Decrease density by 5%"
              disabled={params.density <= 0}
              onClick={() => onChange({ density: Math.max(0, round5(params.density - 0.05)) })}
            >
              −5%
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={params.density}
              onChange={(e) => onChange({ density: Number(e.target.value) })}
            />
            <button
              type="button"
              className="stepper-btn"
              aria-label="Increase density by 5%"
              disabled={params.density >= 1}
              onClick={() => onChange({ density: Math.min(1, round5(params.density + 0.05)) })}
            >
              +5%
            </button>
          </div>
        </label>
        <label className="field">
          <span>Motif size: {Math.round(params.motifSize)}</span>
          <input
            type="range"
            min={20}
            max={140}
            step={1}
            value={params.motifSize}
            onChange={(e) => onChange({ motifSize: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Rotation randomness: {Math.round(params.rotationJitter)}°</span>
          <input
            type="range"
            min={0}
            max={180}
            step={1}
            value={params.rotationJitter}
            onChange={(e) => onChange({ rotationJitter: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Scale jitter: {Math.round(params.scaleJitter * 100)}%</span>
          <input
            type="range"
            min={0}
            max={0.6}
            step={0.01}
            value={params.scaleJitter}
            onChange={(e) => onChange({ scaleJitter: Number(e.target.value) })}
          />
        </label>
        <label className="field field--inline">
          <span>Mirror symmetry</span>
          <input type="checkbox" checked={params.mirror} onChange={(e) => onChange({ mirror: e.target.checked })} />
        </label>
        <label className="field">
          <span>Radial symmetry fold: {params.radialSymmetry}</span>
          <input
            type="range"
            min={3}
            max={12}
            step={1}
            value={params.radialSymmetry}
            onChange={(e) => onChange({ radialSymmetry: Number(e.target.value) })}
          />
        </label>
      </section>

      <section>
        <h3>Seed</h3>
        <div className="seed-row">
          <input
            type="text"
            value={params.seed}
            onChange={(e) => onChange({ seed: e.target.value })}
            aria-label="Seed value"
          />
          <button type="button" onClick={() => onChange({ seed: randomSeed() })}>
            🎲
          </button>
        </div>
      </section>

      <section className="actions">
        <button type="button" className="btn btn--primary" onClick={onGenerate}>
          Generate
        </button>
        <button type="button" className="btn" onClick={onRandomizeAll}>
          Randomize All
        </button>
        <button type="button" className="btn" onClick={onGenerateBatch}>
          Generate 9 variations
        </button>
        <button type="button" className="btn btn--export" onClick={onExportSingle}>
          Export single tile (.svg)
        </button>
        <button type="button" className="btn btn--export" onClick={onExportTiled}>
          Export 3x3 tiled (.svg)
        </button>
        <button type="button" className="btn btn--danger" onClick={onReset}>
          ↩ รีเซ็ตเป็นค่าเริ่มต้น
        </button>
      </section>

      {aiPanel}
    </div>
  );
}
