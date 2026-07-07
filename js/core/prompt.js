export function buildPrompt(schema, famLabel) {
  return `IMPORTANT: DO NOT GENERATE OR ATTACH ANY IMAGE. RETURN JSON ONLY — NO MARKDOWN, NO EXPLANATION OUTSIDE THE JSON.

คุณคือนักออกแบบเวกเตอร์ลายพิมพ์ (surface pattern designer) มืออาชีพที่ขายงานบน Adobe Stock / Shutterstock / Etsy / Freepik
ช่วยคิดคอนเซ็ปต์ลายใหม่ 1 แบบที่มีโอกาสขายดี สำหรับสไตล์: ${famLabel}
Pattern type: ${schema.patternType}
Composition: ${schema.composition}

กรุณาตอบเป็น JSON เท่านั้น ตาม schema นี้ (ห้ามใส่ข้อความอื่นนอก JSON):
{
  "title": "ชื่อคอลเลกชันภาษาอังกฤษ สั้นและขายง่าย",
  "description": "คำอธิบายสั้น 1-2 ประโยคภาษาอังกฤษ",
  "concept": "แนวคิดของลายภาษาอังกฤษ",
  "palette": ["#hex", "...รวม 5-7 สี เรียงจากพื้นหลังไปเข้ม"],
  "assets": {
    "hero": ["...3-6 ชื่อโมทีฟหลักภาษาอังกฤษ"],
    "secondary": ["...3-5 ชื่อโมทีฟรอง"],
    "filler": ["...2-4 ชื่อโมทีฟเติมช่องว่าง"],
    "accent": ["...2-3 ชื่อจุดตกแต่งเล็กๆ"]
  },
  "metadata": { "keywords": ["...50 คำภาษาอังกฤษสำหรับ stock site เรียงตามความสำคัญ"] }
}`;
}
