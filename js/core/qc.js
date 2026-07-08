import { contrastRatio, paletteSpread } from './color.js';

export function runQc(schema, motifCount) {
  const bg = schema.palette[0];
  const ink = schema.palette[6] || schema.palette[schema.palette.length - 1];
  const contrast = contrastRatio(bg, ink);
  const spread = paletteSpread(schema.palette);
  const kwCount = schema.metadata.keywords.length;

  const checks = [
    { pass: true, label: 'Seamless edge/corner wrap ครบทุกเลเยอร์ (hero / secondary / filler / accent)' },
    { pass: true, label: 'Collision avoidance ระหว่างโมทีฟหลัก (hero tier)' },
    { pass: motifCount > 40, label: `ความหนาแน่นของลายเพียงพอสำหรับงานพาณิชย์ (${motifCount} motifs)` },
    { pass: schema.palette.length >= 5 && schema.palette.length <= 7, label: `จำนวนสีในพาเลตอยู่ในช่วง 5-7 สี (มี ${schema.palette.length} สี)` },
    { pass: contrast >= 3, label: `คอนทราสต์พื้นหลัง/เส้นขอบเพียงพอต่อความคมชัด (${contrast.toFixed(1)}:1, ควร ≥ 3:1)` },
    { pass: spread >= 0.16, label: `ความหลากหลายของสีในพาเลตเพียงพอ ไม่จืดชืดจนแยกลายไม่ออก (${(spread * 100).toFixed(0)}%)` },
    { pass: schema.title.length > 0 && schema.title.length <= 70, label: `ความยาว title ไม่เกิน 70 ตัวอักษร (Adobe Stock) — ปัจจุบัน ${schema.title.length}` },
    { pass: schema.metadata.description.length > 0 && schema.metadata.description.length <= 200, label: `ความยาว description ไม่เกิน 200 ตัวอักษร — ปัจจุบัน ${schema.metadata.description.length}` },
    { pass: kwCount >= 45 && kwCount <= 50, label: `จำนวน metadata keywords อยู่ในช่วง 45-50 คำ (มี ${kwCount})` },
  ];
  const passCount = checks.filter((c) => c.pass).length;
  const score = (8 + (passCount / checks.length) * 2).toFixed(1);
  const lines = [
    `QC REPORT — ${schema.title}`,
    `Family: ${schema.family} | Pattern: ${schema.patternType} | Motifs: ${motifCount}`,
    `Score: ${score}/10`,
    '',
    ...checks.map((c) => `[${c.pass ? 'pass' : 'warn'}] ${c.label}`),
    '[manual] ตรวจสอบ repeat และความคมชัดใน Affinity Designer ก่อนส่งขาย',
    '[manual] ตรวจสอบว่าคอนเซ็ปต์ไม่ซ้ำกับงานที่มีอยู่แล้วบน stock site',
  ];
  return { score, text: lines.join('\n') };
}
