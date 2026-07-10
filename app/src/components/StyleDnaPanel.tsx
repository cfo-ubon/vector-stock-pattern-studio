import { useEffect, useRef, useState } from 'react';
import type { GenerateParams } from '../engine/types';
import { PALETTES } from '../palettes/palettes';
import {
  STYLE_DNA_LIST,
  resolveStyleDna,
  computeStyleDrift,
  resetToStyleDna,
  deriveStyleDnaFromParams,
  duplicateStyleDna,
  exportStyleDnaJson,
  importStyleDnaJson,
  isStyleDnaCompatible,
  type StyleDna,
} from '../engine/styleDna';
import { loadCustomStyles, saveCustomStyles, loadFavoriteStyleIds, saveFavoriteStyleIds } from '../storage/styleDnaStore';
import { downloadBlobFile } from '../export/svgExporter';

interface Props {
  params: GenerateParams;
  onChange: (patch: Partial<GenerateParams>) => void;
}

const FIELD_LABELS_TH: Record<string, string> = {
  categoryId: 'หมวดลาย', motifSize: 'ขนาดชิ้นลาย', layoutId: 'Layout', paletteId: 'ชุดสี',
  colorCount: 'จำนวนสี', colorStory: 'คุมโทนสี', density: 'ความหนาแน่น', negativeSpace: 'พื้นที่ว่าง',
  overlapAmount: 'ระยะซ้อนทับ', rotationJitter: 'การหมุนสุ่ม', scaleJitter: 'ขนาดสุ่ม', fillerStyle: 'ลาย filler',
  flatShadow: 'เงา', flatHighlight: 'ไฮไลต์', hierarchy: 'ลำดับชั้น', compositionIntelligence: 'Composition Intelligence',
  tileSize: 'ขนาด tile', patternScale: 'สเกลลาย', styleDnaId: 'Style DNA',
};

const PALETTE_IDS = new Set(PALETTES.map((p) => p.id));

export function StyleDnaPanel({ params, onChange }: Props) {
  const [customStyles, setCustomStyles] = useState<StyleDna[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCustomStyles(loadCustomStyles());
    setFavorites(loadFavoriteStyleIds());
  }, []);

  const allStyles: StyleDna[] = [...STYLE_DNA_LIST, ...customStyles];
  const activeDna = params.styleDnaId
    ? (allStyles.find((s) => s.id === params.styleDnaId) ?? null)
    : null;
  const drift = activeDna ? computeStyleDrift(params, activeDna) : [];

  const sortedStyles = [...allStyles].sort((a, b) => {
    const favA = favorites.includes(a.id) ? 0 : 1;
    const favB = favorites.includes(b.id) ? 0 : 1;
    if (favA !== favB) return favA - favB;
    return a.label.localeCompare(b.label);
  });

  function persistCustomStyles(next: StyleDna[]) {
    setCustomStyles(next);
    saveCustomStyles(next);
  }

  function persistFavorites(next: string[]) {
    setFavorites(next);
    saveFavoriteStyleIds(next);
  }

  function applyStyle(dna: StyleDna) {
    onChange(resolveStyleDna(dna, params.seed));
  }

  function toggleFavorite(id: string) {
    persistFavorites(favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id]);
  }

  function handleCreateFromCurrent() {
    const label = window.prompt('ตั้งชื่อ Style DNA ใหม่จากการตั้งค่าปัจจุบัน:', 'สไตล์ของฉัน');
    if (!label) return;
    const dna = deriveStyleDnaFromParams(params, label);
    persistCustomStyles([...customStyles, dna]);
    onChange({ styleDnaId: dna.id });
  }

  function handleDuplicate() {
    if (!activeDna) return;
    const label = window.prompt('ตั้งชื่อสำเนา:', `${activeDna.label} (สำเนา)`);
    if (!label) return;
    const dup = duplicateStyleDna(activeDna, label);
    persistCustomStyles([...customStyles, dup]);
    onChange({ styleDnaId: dup.id });
  }

  function handleRename() {
    if (!activeDna || !activeDna.custom) return;
    const label = window.prompt('ตั้งชื่อใหม่:', activeDna.label);
    if (!label) return;
    persistCustomStyles(customStyles.map((s) => (s.id === activeDna.id ? { ...s, label } : s)));
  }

  function handleDelete() {
    if (!activeDna || !activeDna.custom) return;
    if (!window.confirm(`ลบ Style DNA "${activeDna.label}"?`)) return;
    persistCustomStyles(customStyles.filter((s) => s.id !== activeDna.id));
    persistFavorites(favorites.filter((f) => f !== activeDna.id));
    onChange({ styleDnaId: undefined });
  }

  function handleExport() {
    if (!activeDna) return;
    downloadBlobFile(`style-dna-${activeDna.id}.json`, new Blob([exportStyleDnaJson(activeDna)], { type: 'application/json' }));
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const imported = importStyleDnaJson(text, { paletteIds: PALETTE_IDS });
      if (!imported) {
        window.alert('นำเข้าไม่สำเร็จ — ไฟล์ JSON ไม่ถูกต้องหรืออ้างอิงหมวด/ชุดสีที่ไม่มีอยู่จริง');
        return;
      }
      const withFreshId: StyleDna = { ...imported, id: `custom-${Date.now()}` };
      persistCustomStyles([...customStyles, withFreshId]);
      onChange({ styleDnaId: withFreshId.id });
    };
    reader.readAsText(file);
  }

  function handleReset() {
    if (!activeDna) return;
    onChange(resetToStyleDna(activeDna, params.seed));
  }

  return (
    <details className="control-section" open>
      <summary>
        <h3>🧬 Style DNA</h3>
        {params.styleDnaId && (
          <button type="button" className="chip" onClick={(e) => { e.stopPropagation(); onChange({ styleDnaId: undefined }); }}>
            ✕ ล้าง style
          </button>
        )}
      </summary>
      <p className="mix-hint">
        เลือกตัวตนงานออกแบบสำเร็จรูป — ปรับ category/layout/palette/hierarchy/density/flow/rhythm/overlap/cluster/สี/ความลึก
        SVG ให้พร้อมกันในคลิกเดียว (ปรับค่าย่อยต่อเองได้หลังเลือก — ระบบจะโชว์ว่าต่างจาก style เดิมตรงไหน)
      </p>
      <div className="chip-row">
        {sortedStyles.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`chip ${params.styleDnaId === s.id ? 'chip--active' : ''}`}
            title={s.description}
            onClick={() => applyStyle(s)}
          >
            {favorites.includes(s.id) ? '★ ' : ''}
            {s.label}
            {s.custom ? ' 👤' : ''}
          </button>
        ))}
      </div>

      <div className="saved-toolbar">
        <button type="button" className="btn btn--save" onClick={handleCreateFromCurrent} title="บันทึกการตั้งค่าปัจจุบันเป็น Style DNA ใหม่">
          ➕ สร้าง Style จากค่าปัจจุบัน
        </button>
        <button type="button" className="btn btn--save" disabled={!activeDna} onClick={handleDuplicate}>
          🧬 ทำสำเนา
        </button>
        <button type="button" className="btn btn--save" disabled={!activeDna} onClick={() => activeDna && toggleFavorite(activeDna.id)}>
          {activeDna && favorites.includes(activeDna.id) ? '★ เลิกโปรด' : '☆ ตั้งเป็นโปรด'}
        </button>
        <button type="button" className="btn btn--save" disabled={!activeDna?.custom} onClick={handleRename}>
          ✏️ เปลี่ยนชื่อ
        </button>
        <button type="button" className="btn btn--danger" disabled={!activeDna?.custom} onClick={handleDelete}>
          🗑 ลบ
        </button>
        <button type="button" className="btn btn--save" disabled={!activeDna} onClick={handleExport}>
          📤 Export JSON
        </button>
        <button type="button" className="btn btn--save" onClick={() => fileInputRef.current?.click()}>
          📥 Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImportFile(f);
            e.target.value = '';
          }}
        />
        <button type="button" className="btn btn--save" disabled={!activeDna || drift.length === 0} onClick={handleReset}>
          ↺ Reset to Style
        </button>
      </div>

      {activeDna && drift.length > 0 && (
        <p className="mix-hint style-dna-drift">
          ปรับต่างจาก "{activeDna.label}" แล้ว {drift.length} จุด:{' '}
          {drift.map((d) => FIELD_LABELS_TH[d.field] ?? d.field).join(', ')}
        </p>
      )}
      {activeDna && !isStyleDnaCompatible(activeDna, { paletteIds: PALETTE_IDS }) && (
        <p className="mix-hint style-dna-drift">
          ⚠️ Style นี้อ้างอิงหมวด/ชุดสีที่ไม่มีอยู่ในระบบปัจจุบันบางส่วน
        </p>
      )}
    </details>
  );
}
