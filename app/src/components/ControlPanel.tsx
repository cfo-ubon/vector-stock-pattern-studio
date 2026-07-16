import type { GenerateParams, LayoutId } from '../engine/types';
import { GENERATOR_LIST } from '../generators';
import { LAYOUT_LIST } from '../layouts';
import { PALETTES } from '../palettes/palettes';
import { randomSeed } from '../engine/rng';
import { DEFAULT_HIERARCHY, HIERARCHY_PRESETS, type HierarchyParams } from '../engine/hierarchy';
import { DEFAULT_COMPOSITION_INTELLIGENCE, type CompositionIntelligenceParams } from '../engine/compositionIntelligence';
import { StyleDnaPanel } from './StyleDnaPanel';
import { ART_DIRECTION_PRESETS, resolveArtDirection } from '../engine/artDirection';
import { TREND_PRESETS, resolveTrend } from '../engine/trendEngine';
import type { GenerationMode, CandidateProgress } from '../engine/candidateEngine';
import { CANDIDATE_COUNTS } from '../engine/candidateEngine';
import { QUALITY_PRESET_LABELS, type QualityPresetId } from '../engine/scoring';

const QUALITY_MODE_LABELS: Record<GenerationMode, string> = { fast: 'Fast', standard: 'Standard', premium: 'Premium' };
const QUALITY_PRESET_IDS = Object.keys(QUALITY_PRESET_LABELS) as QualityPresetId[];

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
  qualityMode: GenerationMode;
  onQualityModeChange: (mode: GenerationMode) => void;
  qualityPresetId: QualityPresetId;
  onQualityPresetChange: (preset: QualityPresetId) => void;
  onGenerateBest: () => void;
  onGenerateBestOf12: () => void;
  onCancelGenerateBest: () => void;
  candidateProgress: CandidateProgress | null;
  onExportSingle: () => void;
  onExportTiled: () => void;
  onExportEps: () => void;
  onExportJpeg: () => void;
  onExportJpeg3x3: () => void;
  onColorwayAll: () => void;
  onReset: () => void;
  onGenerateCollection: () => void;
  collectionStatus: 'idle' | 'building' | 'done';
  aiPanel?: React.ReactNode;
}

const MAX_MIX_CATEGORIES = 5;

const HIERARCHY_SLIDERS: Array<{ key: Exclude<keyof HierarchyParams, 'secondaryHeroBoost'>; label: string; min: number; max: number; step: number }> = [
  { key: 'heroRatio', label: 'Hero proportion', min: 0, max: 0.4, step: 0.01 },
  { key: 'secondaryRatio', label: 'Secondary proportion', min: 0.1, max: 0.7, step: 0.01 },
  { key: 'fillerRatio', label: 'Filler proportion', min: 0, max: 0.6, step: 0.01 },
  { key: 'accentRatio', label: 'Tiny accent proportion', min: 0, max: 0.5, step: 0.01 },
  { key: 'heroScale', label: 'Hero scale', min: 0.8, max: 3, step: 0.05 },
  { key: 'secondaryScale', label: 'Secondary scale', min: 0.5, max: 1.8, step: 0.05 },
  { key: 'fillerScale', label: 'Filler scale', min: 0.15, max: 0.9, step: 0.05 },
  { key: 'accentScale', label: 'Accent scale', min: 0.05, max: 0.45, step: 0.01 },
];

export function ControlPanel({
  params,
  onChange,
  onGenerate,
  onRandomizeAll,
  onGenerateBatch,
  qualityMode,
  onQualityModeChange,
  qualityPresetId,
  onQualityPresetChange,
  onGenerateBest,
  onGenerateBestOf12,
  onCancelGenerateBest,
  candidateProgress,
  onExportSingle,
  onExportTiled,
  onExportEps,
  onExportJpeg,
  onExportJpeg3x3,
  onColorwayAll,
  onReset,
  onGenerateCollection,
  collectionStatus,
  aiPanel,
}: Props) {
  const mixMode = !!params.mixCategoryIds;
  const mixSelection = params.mixCategoryIds ?? [];

  const toggleMixMode = (on: boolean) => {
    onChange({ mixCategoryIds: on ? [params.categoryId] : undefined });
  };

  const toggleMixCategory = (id: string) => {
    const isSelected = mixSelection.includes(id);
    if (isSelected) {
      if (mixSelection.length <= 1) return; // keep at least one selected
      onChange({ mixCategoryIds: mixSelection.filter((x) => x !== id) });
    } else if (mixSelection.length < MAX_MIX_CATEGORIES) {
      onChange({ mixCategoryIds: [...mixSelection, id] });
    }
  };

  return (
    <div className="control-panel">
      <StyleDnaPanel params={params} onChange={onChange} />

      <details className="control-section" open>
        <summary>
          <h3>🎨 Art Direction</h3>
          {params.artDirection && (
            <button
              type="button"
              className="chip"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ artDirection: undefined });
              }}
            >
              ✕ ล้าง preset
            </button>
          )}
        </summary>
        <p className="mix-hint">
          เลือกทิศทางงานออกแบบสำเร็จรูป — ปรับ category/layout/hierarchy/negative space/overlap/สี ให้พร้อมกันทันที
          (ปรับค่าย่อยต่อเองได้หลังเลือก)
        </p>
        <div className="chip-row">
          {Object.entries(ART_DIRECTION_PRESETS).map(([id, preset]) => (
            <button
              key={id}
              type="button"
              className={`chip ${params.artDirection === id ? 'chip--active' : ''}`}
              onClick={() => {
                const patch = resolveArtDirection(id);
                if (patch) onChange(patch);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </details>

      <details className="control-section" open>
        <summary>
          <h3>📈 Trend Intelligence</h3>
          {params.trend && (
            <button
              type="button"
              className="chip"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ trend: undefined });
              }}
            >
              ✕ ล้าง trend
            </button>
          )}
        </summary>
        <p className="mix-hint">
          เลือกโปรไฟล์สไตล์ที่คัดไว้ล่วงหน้า — ปรับ category/layout/palette/hierarchy/density ให้พร้อมกัน แล้วหลัง Generate
          จะมีแผง Trend Fit ประเมินว่าสี/ความหนาแน่นที่สร้างจริงตรงกับลักษณะของเทรนด์นั้นแค่ไหน (ไม่ใช่ข้อมูลเทรนด์เรียลไทม์จากอินเทอร์เน็ต)
        </p>
        <div className="chip-row">
          {Object.entries(TREND_PRESETS).map(([id, preset]) => (
            <button
              key={id}
              type="button"
              className={`chip ${params.trend === id ? 'chip--active' : ''}`}
              title={preset.description}
              onClick={() => {
                const patch = resolveTrend(id);
                if (patch) onChange(patch);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </details>

      <details className="control-section" open>
        <summary>
          <h3>Category</h3>
          <label className="field--inline mix-toggle" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={mixMode} onChange={(e) => toggleMixMode(e.target.checked)} />
            <span>🧩 Asset Mix</span>
          </label>
        </summary>
        {mixMode && (
          <p className="mix-hint">
            เลือกได้ 2-{MAX_MIX_CATEGORIES} หมวด — แต่ละชิ้นลายจะสุ่มมาจากหมวดที่เลือกแบบผสมกันในลายเดียว
            (เลือกแล้ว {mixSelection.length})
          </p>
        )}
        <div className="chip-row">
          {GENERATOR_LIST.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`chip ${mixMode ? (mixSelection.includes(g.id) ? 'chip--active' : '') : params.categoryId === g.id ? 'chip--active' : ''}`}
              title={g.description}
              onClick={() =>
                mixMode
                  ? toggleMixCategory(g.id)
                  : onChange({
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
      </details>

      <details className="control-section" open>
        <summary>
          <h3>Layout</h3>
        </summary>
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
      </details>

      <details className="control-section" open>
        <summary>
          <h3>Palette</h3>
        </summary>
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
        <label className="field field--inline" title="แต่ละลายจะมีสีเด่น 2 สีที่ใช้บ่อย ส่วนสีอื่นแซมเป็นจุดเน้น — โทนสีดูตั้งใจแบบนักออกแบบจริง (มีผลเมื่อใช้สี 4 สีขึ้นไป)">
          <span>🎯 คุมโทนสี (สีเด่น 2 สี)</span>
          <input type="checkbox" checked={params.colorStory ?? true} onChange={(e) => onChange({ colorStory: e.target.checked })} />
        </label>
      </details>

      <details className="control-section" open>
        <summary>
          <h3>Diversity controls</h3>
        </summary>
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
          <span>✨ Filler พื้นหลัง (จุด/รายละเอียดแทรกระหว่างลาย)</span>
          <div className="chip-row">
            {(
              [
                { v: 'none', label: 'ไม่มี' },
                { v: 'subtle', label: 'บางเบา' },
                { v: 'rich', label: 'หนาแน่น' },
              ] as const
            ).map(({ v, label }) => (
              <button
                key={v}
                type="button"
                className={`chip ${(params.fillerStyle ?? 'none') === v ? 'chip--active' : ''}`}
                onClick={() => onChange({ fillerStyle: v })}
              >
                {label}
              </button>
            ))}
          </div>
        </label>
        <label className="field field--inline">
          <span>🏷 เงาสติกเกอร์ (flat shadow)</span>
          <input type="checkbox" checked={!!params.flatShadow} onChange={(e) => onChange({ flatShadow: e.target.checked })} />
        </label>
        <label className="field field--inline" title="วงรีสว่างเทียมมุมบน-ซ้ายของทุกชิ้นลาย เหมือนแสงสะท้อนบนสติกเกอร์เคลือบเงา — เข้ากันดีกับเงาสติกเกอร์ด้านบน">
          <span>✨ ไฮไลต์เงา (shine)</span>
          <input type="checkbox" checked={!!params.flatHighlight} onChange={(e) => onChange({ flatHighlight: e.target.checked })} />
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
      </details>

      <details className="control-section" open>
        <summary>
          <h3>🎭 Visual Hierarchy</h3>
          <label className="field--inline mix-toggle" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={!!params.hierarchy}
              onChange={(e) => onChange({ hierarchy: e.target.checked ? DEFAULT_HIERARCHY : undefined, artDirection: undefined })}
            />
            <span>เปิดใช้งาน</span>
          </label>
        </summary>
        {params.hierarchy && (
          <>
            <p className="mix-hint">
              แบ่งชิ้นลายเป็น 4 ระดับ (hero/secondary/filler/accent) อัตโนมัติตามสัดส่วน+ขนาดที่ตั้ง — เลือก preset
              หรือปรับละเอียดเองด้านล่าง
            </p>
            <div className="chip-row">
              {Object.entries(HIERARCHY_PRESETS).map(([id, preset]) => (
                <button
                  key={id}
                  type="button"
                  className="chip"
                  onClick={() => onChange({ hierarchy: preset.value, artDirection: undefined })}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {HIERARCHY_SLIDERS.map((s) => {
              const hierarchy = params.hierarchy as HierarchyParams;
              return (
                <label className="field" key={s.key}>
                  <span>
                    {s.label}: {Math.round(hierarchy[s.key] * 100)}%
                  </span>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={hierarchy[s.key]}
                    onChange={(e) => onChange({ hierarchy: { ...hierarchy, [s.key]: Number(e.target.value) }, artDirection: undefined })}
                  />
                </label>
              );
            })}
          </>
        )}
      </details>

      <details className="control-section" open>
        <summary>
          <h3>📐 Negative Space & Overlap</h3>
        </summary>
        <label className="field" title="เพิ่มระยะห่างระหว่างชิ้นลายให้ดูโปร่งขึ้น โดยไม่เปลี่ยนค่า density ที่แสดง">
          <span>Negative space: {Math.round((params.negativeSpace ?? 0) * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={params.negativeSpace ?? 0}
            onChange={(e) => onChange({ negativeSpace: Number(e.target.value) })}
          />
        </label>
        <label className="field" title="ลดระยะห่างให้ชิ้นลายซ้อนทับกันเป็นธรรมชาติมากขึ้น">
          <span>Overlap amount: {Math.round((params.overlapAmount ?? 0) * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={params.overlapAmount ?? 0}
            onChange={(e) => onChange({ overlapAmount: Number(e.target.value) })}
          />
        </label>
      </details>

      <details className="control-section" open>
        <summary>
          <h3>🧭 Composition Intelligence</h3>
          <label className="field--inline mix-toggle" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={!!params.compositionIntelligence}
              onChange={(e) => onChange({ compositionIntelligence: e.target.checked ? DEFAULT_COMPOSITION_INTELLIGENCE : undefined })}
            />
            <span>เปิดใช้งาน</span>
          </label>
        </summary>
        {params.compositionIntelligence && (
          <>
            <p className="mix-hint">
              วิเคราะห์การกระจายน้ำหนักภาพจริง (quadrant) และระยะห่างระหว่างชิ้นลาย แล้วปรับตำแหน่งชิ้นที่ทำให้ลายเสีย
              สมดุลหรือมีช่องว่างผิดจังหวะ — ปรับจากเรขาคณิตจริงของ layout เดิม ไม่สุ่มใหม่
            </p>
            <label className="field" title="แก้ไขมุมที่ชิ้นลายกระจุกตัวหนักเกินไปในโซนใดโซนหนึ่งของผืนลาย">
              <span>
                Balance strength: {Math.round((params.compositionIntelligence as CompositionIntelligenceParams).balanceStrength * 100)}%
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={(params.compositionIntelligence as CompositionIntelligenceParams).balanceStrength}
                onChange={(e) =>
                  onChange({
                    compositionIntelligence: {
                      ...(params.compositionIntelligence as CompositionIntelligenceParams),
                      balanceStrength: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label className="field" title="ปรับชิ้นลายที่อยู่โดดเดี่ยวห่างจากเพื่อนบ้านผิดจังหวะให้เข้าจังหวะเดิม">
              <span>
                Rhythm strength: {Math.round((params.compositionIntelligence as CompositionIntelligenceParams).rhythmStrength * 100)}%
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={(params.compositionIntelligence as CompositionIntelligenceParams).rhythmStrength}
                onChange={(e) =>
                  onChange({
                    compositionIntelligence: {
                      ...(params.compositionIntelligence as CompositionIntelligenceParams),
                      rhythmStrength: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          </>
        )}
      </details>

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
        <button
          type="button"
          className="btn btn--save"
          onClick={onGenerateCollection}
          disabled={collectionStatus === 'building'}
          title="สร้างคอลเลกชันเชิงพาณิชย์ครบชุดจากตัวตนเดียวกัน (Style DNA/หมวด/ชุดสีเดียวกันทั้งหมด): Hero/Secondary/Blender/Mini/Stripe pattern, Border 4 ด้าน, Corner 4 มุม, Spot Motif Sheet, Decorative Elements Sheet, Collection Preview, PNG preview, metadata + SEO package, และ Collection.json — ดาวน์โหลดเป็น zip เดียว และบันทึกเข้าโปรเจกต์ที่เปิดอยู่อัตโนมัติ"
        >
          {collectionStatus === 'building' ? '🏭 กำลังสร้างคอลเลกชัน…' : collectionStatus === 'done' ? '✅ สร้างคอลเลกชันอีกครั้ง' : '🏭 Generate Collection (ZIP)'}
        </button>
        <div className="candidate-controls" title="สร้างลายหลายแบบจาก seed เดียวกัน วิเคราะห์คุณภาพจริงจากโครงสร้างภาพ แล้วเลือกลายที่คะแนนสูงสุดมาแสดง">
          <div className="candidate-controls-row">
            <label>
              โหมด
              <select value={qualityMode} onChange={(e) => onQualityModeChange(e.target.value as GenerationMode)} disabled={!!candidateProgress}>
                {(Object.keys(QUALITY_MODE_LABELS) as GenerationMode[]).map((m) => (
                  <option key={m} value={m}>
                    {QUALITY_MODE_LABELS[m]} ({CANDIDATE_COUNTS[m]})
                  </option>
                ))}
              </select>
            </label>
            <label>
              เกณฑ์คุณภาพ
              <select value={qualityPresetId} onChange={(e) => onQualityPresetChange(e.target.value as QualityPresetId)} disabled={!!candidateProgress}>
                {QUALITY_PRESET_IDS.map((p) => (
                  <option key={p} value={p}>
                    {QUALITY_PRESET_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {candidateProgress ? (
            <div className="candidate-progress-row">
              <span>
                กำลังสร้าง candidate {candidateProgress.completed}/{candidateProgress.total || CANDIDATE_COUNTS[qualityMode]}…
              </span>
              <button type="button" className="btn btn--danger" onClick={onCancelGenerateBest}>
                ยกเลิก
              </button>
            </div>
          ) : (
            <>
              <button type="button" className="btn btn--primary" onClick={() => onGenerateBest()}>
                ✨ Generate Best ({QUALITY_MODE_LABELS[qualityMode]})
              </button>
              <button
                type="button"
                className="btn"
                onClick={onGenerateBestOf12}
                title="สร้าง 12 candidate จาก seed เดียวกัน วิเคราะห์คุณภาพจริง แล้วเลือกคะแนนสูงสุด — ไม่ขึ้นกับตัวเลือกโหมดด้านบน"
              >
                🏆 Generate Best of 12
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          className="btn"
          onClick={onColorwayAll}
          title="สร้างลายเดิม (seed เดิม) ครบทุกชุดสี แล้วบันทึกเข้าคลังเป็นคอลเลกชัน"
        >
          🎨 Colorway ทุกชุดสี → คลัง
        </button>
        <button type="button" className="btn btn--export" onClick={onExportSingle}>
          Export single tile (.svg, 3000px)
        </button>
        <button type="button" className="btn btn--export" onClick={onExportTiled}>
          Export 3x3 tiled (.svg)
        </button>
        <button
          type="button"
          className="btn btn--export"
          onClick={onExportEps}
          title="ไฟล์เวคเตอร์ฟอร์แมตที่ Shutterstock / Adobe Stock / Freepik รับ — สร้างจากแอปโดยตรง ไม่ต้องแปลงใน Affinity อีกต่อไป (ขนาด artboard 3000×3000 px)"
        >
          Export EPS (.eps, 3000px) — พร้อมส่งขาย
        </button>
        <button
          type="button"
          className="btn btn--export"
          onClick={onExportJpeg}
          title="สร้างไฟล์ JPEG จากลายปัจจุบันในเบราว์เซอร์ ไว้ใช้เป็น preview คู่ EPS (เช่น Freepik)"
        >
          Export JPEG preview (5000px)
        </button>
        <button
          type="button"
          className="btn btn--export"
          onClick={onExportJpeg3x3}
          title="สร้างไฟล์ JPEG แบบต่อ 3×3 จากลายปัจจุบัน ไว้เช็ค seamless หรือใช้เป็น preview"
        >
          Export JPEG 3×3 preview (3000px)
        </button>
        <button type="button" className="btn btn--danger" onClick={onReset}>
          ↩ รีเซ็ตเป็นค่าเริ่มต้น
        </button>
      </section>

      {aiPanel}
    </div>
  );
}
