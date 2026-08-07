# Today's Production Workspace — Guide

**Module:** `app/src/components/productionExperience/ProductionHomeView.tsx`
**Reached from:** the "🏭 Today's Production" button in the always-visible header/project bar (no sub-navigation required).
**Mission:** AI-SBOS — Production Workflow Optimization and Product Identity, Part 4–8.

## Purpose

Today's Production Workspace is the one screen an owner needs for the entire
daily routine: **Generate → Preview → Refine → Approve → Marketplace →
Export → Download**. Before this workspace existed, the same routine
required navigating between the pattern generator, the Portfolio Manager,
and a separate export dialog. Every step now happens on this one screen,
and every step reuses an existing engine — nothing here is a new scoring,
export, or commercial-readiness system.

## Screen flow

`ProductionHomeView` is a small state machine (`Screen = 'home' | 'progress'
| 'gallery' | 'review' | 'export' | 'dashboard' | 'summary'`):

1. **Home** — shows the daily brief (factory health, backlog, "continue
   yesterday" check) and a single **▶ START FACTORY** action.
2. **Approve session** — one confirmation before the factory begins
   producing for the day.
3. **Generate Now** — runs the real Factory Orchestrator batch generation
   pipeline (unchanged from Autopilot/Factory). Progress is shown on the
   **Progress** tab.
4. **Preview Gallery** (Part 5) — shown automatically the moment generation
   finishes, with **no extra click**. Every newly produced asset appears as
   a card with:
   - Preview thumbnail
   - Commercial Score (`commercial/readinessEngine.ts`)
   - Quality Score (`qualitySnapshotStore.ts`'s `beautyScore`)
   - Marketplace Ready / Not Ready (`readiness.band === 'READY'`)
   - SEO Ready / SEO Missing (`readiness.checks` seoExists check)
   - Preview / Edit / Export buttons per asset
5. **Marketplace Export** (Part 6) — select one or many gallery cards, pick
   one or more marketplaces (Shutterstock, Adobe Stock, Freepik, Getty,
   Etsy, or generic Custom ZIP), and export — calling the exact same
   `buildCommercialPackage()` / `buildBulkExportForMarketplace()` /
   `exportAssetsAsZip()` functions the Portfolio Manager already used, via
   the shared `commercial/bulkMarketplaceExport.ts` module (extracted so
   neither screen has its own copy of this logic).
6. **Download Center** (Part 7) — opens automatically after export
   completes. Download each ZIP individually, or (on the desktop app) open
   its folder directly — no trip through Portfolio.

## Measured owner workflow (Part 8)

Measured directly with a real Playwright script
(`app/scripts/uiAudit/aisbos_m3_verify.mjs`), not estimated:

| Step | Action | Clicks |
|---|---|---|
| 1 | Open Today's Production | 1 |
| 2 | ▶ START FACTORY | 1 |
| 3 | Approve today's production session | 1 |
| 4 | ✨ Generate Now | 1 |
| 5 | Select 2 patterns in the Gallery | 2 |
| 6 | Export ที่เลือก (Export selected) | 1 |
| 7 | Pick a marketplace | 1 |
| 8 | Confirm export | 1 |
| **Total** | **Generate → Preview → Marketplace → Export → Download reachable** | **9** |

The Download Center then opens automatically (0 extra clicks) with the
built package ready to download.

Before this workspace, the same outcome required leaving this screen
entirely, opening Portfolio Manager, locating the newly generated assets,
and running the equivalent export flow from there — with no single-screen
preview gallery at all.

## Reuse discipline (no duplicated logic)

| Concern | Reused, never duplicated |
|---|---|
| Batch generation | Factory Orchestrator (unchanged) |
| Commercial Readiness / Marketplace Ready / SEO Ready | `commercial/readinessEngine.ts` |
| Quality Score | `qualitySnapshotStore.ts` |
| Duplicate-submission warnings + bulk export execution | `commercial/bulkMarketplaceExport.ts` (extracted from `PortfolioManagerView.tsx`, now shared by both screens) |
| Per-marketplace ZIP packaging | `buildBulkExportForMarketplace` / `buildCommercialPackage` / `exportAssetsAsZip` (`commercial/exportWorkflow.ts`) |
| Download / Open Folder | `DownloadCenter.tsx` (same component Portfolio Manager already used) |

## Portfolio's new role (Part 9)

Portfolio Manager is no longer required for routine daily export. It is now
organized as **Library & Search, Analytics, Collections, History &
Submissions** — for search, review of the whole catalog, grouping, and
looking back at past submissions, not for the daily Generate→Export loop.

## Offline (Part 11)

Every step above — generation, the Preview Gallery, Marketplace Export, and
the Download Center — was verified to work with the browser fully offline
(service worker installed, `context.setOffline(true)`), since none of it
depends on any external network call. See
`app/scripts/uiAudit/aisbos_m5_offline_verify.mjs`.

## Verification

- `app/scripts/uiAudit/aisbos_m3_verify.mjs` — full workflow + click count, live browser.
- `app/scripts/uiAudit/aisbos_m3_preview_edit_verify.mjs` — Preview/Edit buttons per gallery card.
- `app/scripts/uiAudit/aisbos_m5_responsive_verify.mjs` — Desktop / Laptop / iPad Portrait / iPad Landscape.
- `app/scripts/uiAudit/aisbos_m5_offline_verify.mjs` — full offline run.
- `app/src/components/productionExperience/ProductionPreviewGallery.test.tsx`, `ProductionHomeView.test.tsx`, `commercial/bulkMarketplaceExport.test.ts` — unit coverage.
