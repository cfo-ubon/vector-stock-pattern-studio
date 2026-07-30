interface Props {
  onClose: () => void;
}

// Build 027 Phase 2 — the exact 7-step Safari install guide, plus the
// Safari-limitation caveats the brief requires we not paper over (no real
// .ipa is produced; this is a standards-based installable web app, not an
// App Store binary).
export function InstallGuide({ onClose }: Props) {
  return (
    <div className="offline-guide-overlay" role="dialog" aria-modal="true" aria-label="วิธีติดตั้งใช้งานออฟไลน์บน iPad">
      <div className="offline-guide-panel">
        <div className="offline-guide-header">
          <h2>วิธีติดตั้งบน iPad (Safari)</h2>
          <button type="button" className="offline-guide-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>
        <ol className="offline-guide-steps">
          <li>เปิดแอปนี้ใน Safari (ต้องเป็น Safari เท่านั้น — เบราว์เซอร์อื่นบน iOS ไม่รองรับการติดตั้งแบบนี้)</li>
          <li>แตะปุ่ม แชร์ (ไอคอนสี่เหลี่ยมมีลูกศรชี้ขึ้น)</li>
          <li>เลือก เพิ่มไปที่หน้าจอโฮม (Add to Home Screen)</li>
          <li>แตะ เพิ่ม (Add) เพื่อยืนยัน</li>
          <li>เปิดแอปจากไอคอนบนหน้าจอโฮม (ไม่ใช่จาก Safari อีกต่อไป)</li>
          <li>
            ก่อนใช้งานออฟไลน์ครั้งแรก ให้เปิดแอปขณะมีอินเทอร์เน็ตและรอจนกว่าแถบสถานะด้านบนจะแสดง
            <strong> “พร้อมใช้งานออฟไลน์แล้ว”</strong>
          </li>
          <li>ทดสอบโดยเปิดโหมดเครื่องบิน (Airplane Mode) แล้วเปิดแอปอีกครั้งจากหน้าจอโฮม</li>
        </ol>
        <div className="offline-guide-caveats">
          <p>
            <strong>ข้อจำกัดของ Safari/iPadOS ที่ควรทราบ:</strong>
          </p>
          <ul>
            <li>นี่คือเว็บแอปที่ติดตั้งได้ตามมาตรฐาน (PWA) ไม่ใช่ไฟล์ .ipa ที่ดาวน์โหลดจาก App Store</li>
            <li>iPadOS ไม่รับประกันการทำงานเบื้องหลัง — สำรองข้อมูลอัตโนมัติแบบไม่ต้องเปิดแอปจึงทำไม่ได้จริง (ดูแท็บ "สำรองข้อมูลอัตโนมัติ")</li>
            <li>หาก Safari ล้างพื้นที่จัดเก็บของเว็บไซต์ (เช่น ไม่ได้เปิดใช้งานนาน หรือพื้นที่เครื่องเต็มมาก) ข้อมูลอาจหายได้ — กด "ป้องกันข้อมูลถูกลบอัตโนมัติ" และสำรอง .vspsb เป็นประจำ</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
