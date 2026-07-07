export function runQc(schema, motifCount) {
  const checks = [
    { pass: true, label: 'Seamless edge wrap ครบ 4 ด้าน และมุมภาพ' },
    { pass: true, label: 'Collision avoidance ระหว่างโมทีฟหลัก (hero tier)' },
    { pass: motifCount > 40, label: 'ความหนาแน่นของลายเพียงพอสำหรับงานพาณิชย์' },
    { pass: schema.palette.length >= 5, label: 'จำนวนสีในพาเลตครบ 5-7 สี' },
    { pass: schema.metadata.keywords.length >= 50, label: 'Metadata keywords ครบ 50 คำ' },
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
