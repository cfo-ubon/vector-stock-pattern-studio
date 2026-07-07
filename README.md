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
