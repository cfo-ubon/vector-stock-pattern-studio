// AI-SBOS v3 — single source of truth for this version's own product
// identity/version/build metadata. Deliberately a SEPARATE module from
// v2's `src/appMeta.ts` and v1's `src/versionManifest.ts` — each version
// generation owns its own identity, matching the precedent
// AI_SBOS_VERSION_AUDIT.md established (v1 and v2 never share an
// identity module, even though they share the underlying engine code).

export const PRODUCT_NAME = 'AI-SBOS v3';
export const PRODUCT_TAGLINE = 'Keyword-to-Vector Seamless Factory';
export const PRODUCT_VERSION = '3.0.0';
export const VERSION_STATUS = 'New' as const;
export const BUILD_NAME = 'AI-SBOS v3 — V3-H (Keyword-to-Vector Seamless Factory)';
export const BUILD_DESCRIPTION = 'Full keyword-to-vector pipeline: Keyword Intent Engine, true vector + seamless generation with mandatory gates, refinement, AI Design Coach, Collection/Production Mode with similarity safety, 6-gate Commercial QA, stock SEO, marketplace export, and Download Center';
export const RELEASE_DATE = '2026-08-26';

/** Where "Switch Version" returns to — the Version Selector one level up
 * from this build's own base path (`/vector-stock-pattern-studio/studio/v3/`). */
export const VERSION_SELECTOR_PATH = '../';

/** The real commit this build was produced from — injected at build time
 * by `vite.v3.config.ts`, same convention as v2's `appMeta.ts`. */
export const COMMIT: string = typeof __COMMIT_HASH__ === 'string' ? __COMMIT_HASH__ : 'unknown';

export const ENVIRONMENT: 'production' | 'development' = import.meta.env.PROD ? 'production' : 'development';

export const PRODUCTION_STATUS = 'Full keyword-to-vector pipeline live: generation, Vector/Seamless Integrity gates, refinement, Collection/Production Mode, 6-gate Commercial QA, SEO, and marketplace export/download are all implemented and verified live (see AI_SBOS_V3_REPORT.md)';
export const REGRESSION_RESULT = '40/40 v3-specific tests passing; full app regression suite (4,506 tests) run twice, clean both times; live browser certification + adversarial keyword tests passed with zero console errors (see AI_SBOS_V3_REPORT.md)';

export interface WhatsNewEntry {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

/** Newest first. Namespaced localStorage keys (see `whatsNewStore.ts`)
 * prevent this from ever colliding with v1's or v2's own What's New
 * state — required because localStorage is scoped by origin, not path,
 * confirmed by direct testing in the Multi-Version Release mission. */
export const CHANGELOG: WhatsNewEntry[] = [
  {
    version: '3.0.0',
    date: '2026-08-26',
    title: 'AI-SBOS v3: Keyword-to-Vector Seamless Factory เปิดใช้งานเต็มรูปแบบ',
    highlights: [
      'ป้อนคำค้น/วลีสั้นๆ แล้วได้ Design Brief + ลายเวกเตอร์ seamless พร้อมขายจริง ไม่ต้องปรับพารามิเตอร์เอง',
      'ทุกลายผ่านด่านบังคับ Vector Integrity + Seamless Integrity ก่อนอนุมัติได้เสมอ พร้อมพรีวิวต่อกัน 3×3',
      'Refine ปรับสด + AI Design Coach ให้คำแนะนำจากปัญหาจริงที่ตรวจพบ ไม่เขียนทับต้นฉบับ',
      'Collection Mode (10) / Production Mode (30) สร้างชุดลายภาษาการออกแบบเดียวกัน พร้อมระบบเตือนลายที่คล้ายกันเกินไปอัตโนมัติ',
      'Commercial QA 6 ด่าน (Vector/Seamless/Quality/Commercial/Metadata/Marketplace) + สร้าง SEO จริงจากลาย + ส่งออกไป Shutterstock/Adobe Stock/Freepik/Getty/Etsy + Download Center',
      'ใช้ฐานข้อมูลและไฟล์สำรองร่วมกับ v1/v2 ได้ทันที ไม่ต้อง migrate ข้อมูล',
    ],
  },
];
