// AI-SBOS Mission, Part 1/2 — Product Identity + Version Center. Single
// hand-maintained source of truth for the app's own identity/version/build
// metadata, read by the always-visible header, the "About AI-SBOS" Version
// Center dialog, and the What's New dialog. Mirrors the existing
// hand-maintained-constant convention `electron/main.ts`'s own
// `APP_VERSION` already uses for the desktop shell's native About dialog —
// that file is a separate build (main process, its own tsconfig, never
// imports from `src/`) so it can't literally import this module, but the
// same "one small constant, updated at release time" pattern applies here
// for the renderer.

export const PRODUCT_NAME = 'AI-SBOS';
export const PRODUCT_SUBTITLE = 'AI Stock Business Operating System';
/** Vector Stock Pattern Studio is now a module of AI-SBOS, not the product
 * name itself — shown as a module label, not the primary brand. */
export const MODULE_NAME = 'Vector Stock Pattern Studio';

export const APP_VERSION = '2.13';
export const BUILD_NAME = 'AI-SBOS M5';
export const BUILD_DESCRIPTION = 'Closing verification — device/responsive, offline, regression (twice), Production Workspace Guide';
export const RELEASE_DATE = '2026-08-07';

/** The real commit this build was produced from — injected at build time
 * by `vite.config.ts` (see that file's own comment on why it's always the
 * *previous* commit, never the one it's about to be saved into). During
 * `vitest`/dev it reflects whatever commit is currently checked out. */
export const COMMIT: string = typeof __COMMIT_HASH__ === 'string' ? __COMMIT_HASH__ : 'unknown';

/** Real, not fabricated: Vite's own build-mode boolean, true only for an
 * actual `vite build` production bundle (e.g. the checked-in `/studio`
 * artifact), false for `vite dev`/`vitest`. */
export const ENVIRONMENT: 'production' | 'development' = import.meta.env.PROD ? 'production' : 'development';

/** Hand-maintained status summaries — the in-app equivalent of the same
 * hand-authored evidence `PRODUCTION_CERTIFICATION.md`/`docs/USER_GUIDE.md`'s
 * changelog already record; updated at each release, same convention as
 * every field above. Never computed/inferred at runtime — that would risk
 * silently drifting from what was actually verified. */
export const PRODUCTION_STATUS = 'Verified — Design Refinement Studio Pro (M1-M6) complete, AI-SBOS Production Workspace mission (M1-M5) complete';
export const COMMERCIAL_CERTIFICATION_STATUS = 'PASS — Commercial Pipeline (readiness, SEO, package export) verified through Design Refinement Studio Pro Milestone 2/4 live-browser checks, reused as-is by Today\'s Production Workspace';
export const REGRESSION_RESULT = 'Full suite passing, verified twice back-to-back (see PRODUCTION_WORKSPACE_GUIDE.md for exact counts)';

export interface WhatsNewEntry {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

/** Newest first. Read by the Version Center's "Latest Changes" section and
 * by the What's New dialog (which shows only `CHANGELOG[0]` once per
 * version, see `components/appIdentity/WhatsNewDialog.tsx`). */
export const CHANGELOG: WhatsNewEntry[] = [
  {
    version: '2.13',
    date: '2026-08-07',
    title: 'AI-SBOS: การตรวจสอบปิดภารกิจ (Closing Verification)',
    highlights: [
      'ทดสอบทุกหน้าบนหน้าจอ Desktop, Laptop, iPad แนวตั้ง และ iPad แนวนอน — ไม่มี scroll แนวนอน, ไม่มี console error',
      'ทดสอบ AI-SBOS แบบออฟไลน์เต็มรูปแบบ: แบรนด์, Version Center, Today\'s Production (Generate → Gallery → Export → Download), Portfolio Analytics — ทำงานได้ครบทุกจุดโดยไม่ใช้เครือข่าย',
      'รัน Regression suite เต็มรูปแบบซ้ำ 2 ครั้งติดต่อกัน ผ่านทั้งหมด',
      'เพิ่มเอกสาร PRODUCTION_WORKSPACE_GUIDE.md อธิบายขั้นตอนการทำงานประจำวันและจำนวนคลิกที่วัดจริง',
    ],
  },
  {
    version: '2.12',
    date: '2026-08-07',
    title: 'AI-SBOS: Portfolio role repositioning',
    highlights: [
      'Portfolio Manager เปลี่ยนบทบาทเป็น Library/Search/Analytics/Collections/History & Submissions — ไม่ใช่จุดหลักสำหรับ Export ประจำวันอีกต่อไป (ใช้ Today\'s Production แทน)',
      'แท็บ "📊 Analytics" ใหม่ — ดูภาพรวมคลังและชิ้นงานที่นำเข้า/สร้างล่าสุดในหน้าเดียว',
      'ป้ายแท็บทั้งหมดเปลี่ยนชื่อให้สื่อความหมายชัดเจนขึ้น: Library & Search, Collections, History & Submissions',
    ],
  },
  {
    version: '2.11',
    date: '2026-08-07',
    title: "AI-SBOS: Today's Production Workspace",
    highlights: [
      'รวม Generate → Preview → Refine → Approve → Marketplace → Export → Download ไว้ในหน้า "Today\'s Production" หน้าเดียว ไม่ต้องสลับไปหน้า Portfolio สำหรับงานผลิตประจำวัน',
      'แท็บ Gallery ใหม่ — เห็นทุกลายที่เพิ่งสร้างทันทีพร้อมคะแนน Commercial/Quality, สถานะ Marketplace Ready/SEO Ready และปุ่ม Preview/Edit/Export ต่อชิ้น',
      'เลือกหลายชิ้นงานพร้อมกันแล้ว Export ไปหลาย Marketplace (Shutterstock, Adobe Stock, Freepik, Getty, Etsy) ได้ทันทีจากแท็บ Gallery',
      'Download Center เปิดอัตโนมัติหลัง Export — ดาวน์โหลด ZIP ทีละไฟล์หรือเปิดโฟลเดอร์ (เดสก์ท็อป) ได้จากหน้านี้เลย',
    ],
  },
  {
    version: '2.10',
    date: '2026-08-07',
    title: "AI-SBOS: What's New",
    highlights: [
      'เปิดแอปครั้งแรกหลังมีอัปเดตเวอร์ชันใหม่ จะเห็นหน้าต่าง "What\'s New" สรุปสิ่งที่เปลี่ยนแปลงล่าสุดโดยอัตโนมัติ',
      'ติ๊ก "ไม่ต้องแสดงอีก" เพื่อปิดการแจ้งเตือนนี้ถาวรได้ทุกเมื่อ',
    ],
  },
  {
    version: '2.09',
    date: '2026-08-07',
    title: 'AI-SBOS: Product Identity + Version Center',
    highlights: [
      'เปลี่ยนชื่อแอปเป็น "AI-SBOS" (AI Stock Business Operating System) — Vector Stock Pattern Studio กลายเป็นชื่อโมดูล',
      'เพิ่มแถบข้อมูลแอปที่แสดงตลอด: เวอร์ชัน, Build, โปรเจกต์ปัจจุบัน, สถานะ Production/Development',
      'คลิกที่เวอร์ชันเพื่อเปิด "About AI-SBOS" — Version Center ดูข้อมูล build/commit/สถานะการรับรองเชิงพาณิชย์/ผล regression ล่าสุด',
    ],
  },
];
