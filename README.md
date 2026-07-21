# Vector Stock Pattern Studio

แอปสำหรับนักออกแบบเวกเตอร์ที่ขายลายพิมพ์ (seamless vector pattern) บน stock site
เช่น Adobe Stock, Shutterstock, Etsy, Freepik — ช่วยตั้งแต่คิดคอนเซ็ปต์ลาย ไปจนถึง
export ไฟล์ SVG พร้อมเปิดแก้ต่อใน **Affinity Designer 2 (iPad)**

เป็น static site ล้วน ไม่มี build step ไม่ต้องใช้ API key ใดๆ — เปิดใช้งานได้ทันทีบน
GitHub Pages

## วิธีใช้งาน

1. เปิด `index.html` แล้วเลือก **Style Family** (Botanical, Geometric, Textile,
   Seasonal, Commercial Icons)
2. คลิกไอเดียในช่อง "แรงบันดาลใจ" เพื่อเริ่มจากคอนเซ็ปต์สำเร็จรูป หรือกรอก Concept เอง
3. (ทางเลือก) ไปที่แท็บ **Prompt** เพื่อคัดลอก prompt ไปถาม ChatGPT/Claude ให้ช่วยคิด
   คอนเซ็ปต์ palette และ keyword ใหม่ แล้วนำ JSON ที่ได้กลับมาใส่ในแท็บ **AI JSON**
4. ปรับ Pattern Type / Composition / Palette แล้วกด "สร้างลายใหม่"
5. ตรวจ Preview 3×3 ให้แน่ใจว่า repeat เนียนไม่มีรอยต่อ
6. Export SVG แล้วเปิดใน Affinity Designer 2 (iPad) เพื่อปรับแต่งก่อนส่งขาย
7. ดาวน์โหลด Metadata CSV เพื่อกรอก title/description/keywords ตอนอัปโหลดขึ้น stock site

## สถาปัตยกรรม

```
index.html            โครงหน้าเว็บ
css/app.css            สไตล์
js/app.js              bootstrap
js/ui.js               ผูก DOM/state ทั้งหมด
js/core/                engine, layout, schema, prompt, metadata, qc, ideas ฯลฯ
js/styles/               style family แต่ละแบบ (botanical, geometric, textile, seasonal, commercial)
```

โมดูล style แต่ละไฟล์ export `FAMILY` (ชื่อ, คำศัพท์โมทีฟ, palette เริ่มต้น, keyword)
และฟังก์ชัน `motif(tier, rng, palette, name, x, y, rot, scale, opacity)` — เมื่อ AI ส่ง
`assets.hero/secondary/filler/accent` กลับมาทาง JSON ชื่อเหล่านั้นจะถูกใช้เลือกลาย
จริงในการวาด ไม่ใช่แค่เก็บไว้เป็น label เฉยๆ

ส่วน "AI ช่วยคิดลวดลาย" ใช้วิธีคัดลอก prompt ไปคุยกับ ChatGPT/Claude เอง ไม่มีการเรียก
API หรือเก็บ API key ในแอป — ปลอดภัยสำหรับ static hosting

## React App (`/app`) และเวอร์ชัน Desktop

Repo นี้ยังมีแอปตัวที่สอง — Vector Stock Pattern Studio เวอร์ชัน React +
TypeScript ที่ `/app` (คนละตัวกับ static site ด้านบน, มี generator/scoring/
export engine ที่ครบและซับซ้อนกว่ามาก) โดยมี production build ที่ถูก commit
ไว้ที่ `/studio` และให้บริการผ่าน GitHub Pages ที่
https://cfo-ubon.github.io/vector-stock-pattern-studio/studio/

แอปตัวนี้มีเวอร์ชัน **Windows Desktop แบบออฟไลน์** ด้วย (Electron) — ใช้งานได้
โดยไม่ต้องต่ออินเทอร์เน็ตหลังติดตั้งเสร็จ ดูรายละเอียดที่:

- `docs/DESKTOP_INSTALLATION_GUIDE_TH.md` — วิธีติดตั้ง/เปิดโปรแกรม/ถอนการติดตั้ง
- `docs/DESKTOP_USER_GUIDE_TH.md` — วิธีใช้งานฟีเจอร์ desktop ทั้งหมด
- `docs/DESKTOP_TROUBLESHOOTING_TH.md` — แก้ปัญหาเบื้องต้น
- `docs/OFFLINE_ARCHITECTURE.md` — สถาปัตยกรรม Electron (ภาษาอังกฤษ, สำหรับนักพัฒนา)
- `docs/PROJECT_FILE_FORMAT.md` — สเปกไฟล์โปรเจกต์ `.vsps`
- `docs/BACKUP_AND_RECOVERY.md` — ระบบสำรอง/กู้คืนข้อมูล
- `docs/RELEASE_PROCESS_DESKTOP.md` — ขั้นตอน build/release เวอร์ชัน desktop
- `DESKTOP_MIGRATION_AUDIT.md` / `DESKTOP_OFFLINE_BUILD_REPORT.md` — เอกสาร
  ตรวจสอบและรายงานผลการทำ desktop migration (ภาษาอังกฤษ)

Build commands (จาก `/app`):

```
npm install
npm run dev              # web dev server (เหมือนเดิม)
npm run build             # web production build -> ../studio
npm test                  # test suite ทั้งหมด
npm run desktop:dev        # รัน Electron app โหมด dev
npm run desktop:build      # build เฉพาะไฟล์ desktop (ยังไม่ทำ installer)
npm run desktop:installer  # สร้าง Windows installer (.exe)
npm run desktop:portable   # สร้าง Windows portable (.exe)
npm run desktop:test       # test suite + type-check ของ Electron main process
```
