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
export const BUILD_NAME = 'AI-SBOS v3 — V3-A (Shell + Keyword Workspace)';
export const BUILD_DESCRIPTION = 'Version shell, product identity, and the Keyword Workspace home screen';
export const RELEASE_DATE = '2026-08-14';

/** Where "Switch Version" returns to — the Version Selector one level up
 * from this build's own base path (`/vector-stock-pattern-studio/studio/v3/`). */
export const VERSION_SELECTOR_PATH = '../';

/** The real commit this build was produced from — injected at build time
 * by `vite.v3.config.ts`, same convention as v2's `appMeta.ts`. */
export const COMMIT: string = typeof __COMMIT_HASH__ === 'string' ? __COMMIT_HASH__ : 'unknown';

export const ENVIRONMENT: 'production' | 'development' = import.meta.env.PROD ? 'production' : 'development';

export const PRODUCTION_STATUS = 'In development — V3-A (Version Shell + Keyword Workspace) only; generation/gates/export not yet implemented';
export const REGRESSION_RESULT = 'Not yet run for v3-specific code (see AI_SBOS_V3_REPORT.md for current status)';

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
    date: '2026-08-14',
    title: 'AI-SBOS v3: เริ่มต้น Keyword-to-Vector Seamless Factory',
    highlights: [
      'เปิดตัว AI-SBOS v3 — ป้อนคำค้นหรือแนวคิดสั้นๆ แล้วให้ระบบออกแบบลายเวกเตอร์ไร้รอยต่อให้',
      'หน้าแรก Keyword Workspace เรียบง่าย — ไม่ต้องตั้งค่าพารามิเตอร์ซับซ้อนสำหรับงานทั่วไป',
      'อยู่ระหว่างการพัฒนา — ยังไม่รองรับการสร้างลายจริงในเวอร์ชันนี้',
    ],
  },
];
