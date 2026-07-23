# Production Portfolio & Commercial Feedback Engine — Build 026

This is the top-level map of everything Build 026 added. It turns the
app from a pattern *generator* into a system for regularly submitting
patterns to stock marketplaces, tracking what happens to them, and
feeding real outcomes back into what to make next.

## Why this build exists

By Build 025 the app could generate high-quality, deterministic patterns
and export them, and Build 015–017 had already added a Submission
Center foundation, SEO tooling, and a health-score dashboard. What was
still missing for someone submitting regularly: a durable identity for
"this exact design" that survives copies/renames, a place to record what
a marketplace actually decided and why, revenue tracking, and a feedback
loop from those real outcomes back into "what should I make next" —
without ever touching a marketplace's live API, and without weakening
anything the pattern generator itself already does.

## The pieces, and where their own docs live

| Area | Doc |
|---|---|
| Content-derived identity (`productionAssetId`) | `docs/PRODUCTION_ASSET_ID.md` |
| Submission schema v2 + 4th duplicate rule | `docs/SUBMISSION_TRACKER.md` |
| Marketplace submission ZIP builder | `docs/SUBMISSION_PACKAGE_BUILDER.md` |
| Confidence-gated outcome analysis + "what to generate next" | `docs/COMMERCIAL_FEEDBACK_ENGINE.md` |
| 17-category structured rejection taxonomy | `docs/REJECTION_INTELLIGENCE.md` |
| Manual sales/download/revenue tracking | `docs/SALES_AND_REVENUE_TRACKING.md` |
| Backup/restore for the 8 new stores | `docs/BACKUP_AND_RESTORE.md` |
| Importing old report folders + bulk CSV results | `docs/IMPORT_EXISTING_PORTFOLIO.md` |
| IndexedDB schema (DB_VERSION 6) | `docs/DATABASE_SCHEMA.md` |
| ZIP/CSV hardening, no-credentials guarantee | `docs/SECURITY_AND_PRIVACY.md` |

Two more pieces that don't need their own doc, covered here:

### Production Queue (9-stage lifecycle)

`app/src/catalog/queue/productionQueue.ts` — a per-idea/per-asset
pipeline tracker distinct from both `PortfolioAsset.workflowStatus` and
`SubmissionStatus`. It starts at `IDEA`, before generation has even
happened — a stage neither existing status concept can represent:

```
IDEA → GENERATED → QUALITY_REVIEW → READY → PACKAGE_PREPARED
     → SUBMITTED → APPROVED → PERFORMANCE_TRACKING
                 → REJECTED → (IDEA | GENERATED)   [rework loop]
     QUALITY_REVIEW → GENERATED                     [regenerate-on-failure loop]
```

`transitionProductionQueueItem` throws
`InvalidProductionQueueTransitionError` on any transition not in this
table — invalid jumps (e.g. `IDEA` straight to `SUBMITTED`) are rejected,
not silently allowed.

### Production Batches

`app/src/catalog/queue/productionBatch.ts` — groups `ProductionQueueItem`s
(which may not have a finished asset yet) under one of 6 types:
`collection`, `production-batch`, `submission-batch`,
`seasonal-campaign`, `marketplace-batch`, `experimental-batch`. Distinct
from `domain/collection.ts`'s `Collection` (a curated grouping of
*finished* assets) — a batch operates one layer earlier in the pipeline
and can hold pure ideas.

## UI: Production Center

`app/src/components/production/ProductionCenterView.tsx` — reached from
Portfolio Manager's nav (a third `ManagerSection` alongside "Assets" and
"Collections"). Seven tabs:

| Tab (Thai label) | What it does |
|---|---|
| ติดตามการส่ง (Submission Tracker) | Create a submission for an asset/marketplace, transition its status |
| นำเข้าผลลัพธ์ (Import Results) | Bulk-apply a marketplace CSV export (status/rejection/sales) to existing submissions |
| ผลตอบรับเชิงพาณิชย์ (Commercial Feedback) | Run the Commercial Feedback Engine, see confidence-gated per-dimension insights |
| คำแนะนำการผลิต (Recommendations) | Run Production Recommendations, see ranked presets + excluded-for-duplicate-risk |
| คิวการผลิต (Production Queue) | Create ideas, move them through the 9 stages, group into batches |
| นำเข้าผลงานเก่า (Historical Import) | Import `portfolio_phase_1*`/`reports/build_02x` folders, see import history |
| สำรอง/กู้คืน (Backup/Restore) | Download/restore a Production Backup archive covering all 8 new stores |

Every tab is wiring only — it calls existing, independently-tested domain
functions and renders the result; no validation/scoring/classification
logic lives in the component itself (see each tab's own file header
comment in `ProductionCenterView.tsx`).

## What this build deliberately does not do

Per the brief's non-negotiable rules, restated here as a single checklist:
no paid APIs, no marketplace API keys, no automated marketplace login or
upload, no stored marketplace passwords, no scraping of protected
contributor dashboards, no live currency conversion, no change to
Build 025's generation behavior/deterministic replay/export formats/
SVG editability, no weakening of READY/REVIEW/REJECT thresholds, no
change to `fragmentedSilhouette` diagnostics, no silent deletion of any
portfolio record or file. See `docs/SECURITY_AND_PRIVACY.md` for how each
of these is enforced in code, not just policy.
