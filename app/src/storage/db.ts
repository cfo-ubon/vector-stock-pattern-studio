// Shared IndexedDB plumbing for every persisted store in the app (saved
// library, and now the Project System). One database, one shared version
// number: every store owns its own name/shape but the *opening* — and the
// one IDBOpenDBRequest.onupgradeneeded that's allowed to create new object
// stores — lives here, so adding a new store (as Project System does) is a
// version bump + one `createObjectStore` call, not a second competing
// `indexedDB.open(DB_NAME, ...)` call that could race/conflict with this one.

export const DB_NAME = 'vsp-db';
// v1 (v1.11): 'saved' store only. v2 (Project Studio Engine): adds
// 'projects'. v3 (Asset Ecosystem Engine, Phase 9): adds 'assets'. v4
// (Portfolio Manager P1): adds 'portfolioAssets' (metadata records, no
// binary bodies, keyed by `assetId` — kept small for fast list/search) and
// 'portfolioFiles' (imported source file bodies as Blobs, keyed by
// `fileId`, indexed by `assetId` and `sha256` for orphan/duplicate lookups
// without a full-store scan). v5 (Portfolio Manager P2 Stage 1): adds
// 'collections' (one row per user-defined `Collection`, keyed by `id`,
// indexed by `normalizedName` for case-insensitive duplicate-name lookups
// and `isArchived` for the active/archived filter) — asset<->collection
// *membership* is NOT a new store; it continues to live on
// `PortfolioAsset.collectionIds` (already reserved by P1), see
// `docs/portfolio/COLLECTION_ARCHITECTURE.md` / ADR-005.
//
// v6 (Build 026, Production Portfolio & Commercial Feedback Engine): adds
// 8 new stores. `submissions` REPLACES `catalog/submission/submissionStore.ts`'s
// prior localStorage-only persistence (BUILD_026_AUDIT.md Section 5's
// confirmed storage risk — a single-key JSON blob does not scale to
// thousands of patterns x multiple marketplaces); the migration that reads
// the old localStorage key and writes every record into this store runs
// once, in `submissionStore.ts`, the first time it opens after this
// upgrade — this `onupgradeneeded` handler only creates the empty store,
// it does not touch localStorage (kept deliberately separate: an
// IndexedDB schema upgrade must not depend on synchronous localStorage
// access, and the migration needs its own error handling/reporting, not a
// silent side effect of opening the database). The other 7 stores back
// entirely new Build 026 modules and have no prior data to migrate.
//
// v7 (Application Backup System): adds `appBackupHistory` — one row per
// backup ever created or restored from, including the archive's own Blob
// (bounded by the user's configured retention policy, pruned in
// `appBackupHistoryStore.ts`, not here), so "restore from history" works
// without asking the user to re-locate the original `.vspsb` file.
//
// v8 (Build 028, Marketing Intelligence & AI Design Director): adds 14
// stores across two new subsystems. `researchSources`/`marketObservations`/
// `marketSnapshots`/`marketKeywords`/`seasonalEvents`/`marketOpportunities`/
// `scoringProfiles`/`dailyMissions` back Marketing Intelligence
// (`app/src/marketing/`); `designBriefs`/`designStrategies`/
// `designConfigurations` back the AI Design Director
// (`app/src/design-director/`); `marketingDesignHandoffs` is the formal
// handoff between the two; `commercialFeedbackSignals` and
// `recommendationHistory` close the loop back from real outcomes. All 14
// are created in this one upgrade pass even though not every domain/store
// module consuming them ships in the same commit — the schema is the
// stable, versioned part; the modules built on top of it can land across
// several follow-up commits without ever needing another DB_VERSION bump
// for this build.
//
// v9 (Build 028B, AI Creative Director / Collection Strategy Engine): adds
// `collectionPlans` — the one new store this build needs. `designBriefs`
// and `designConfigurations` (already created in v8, unused until now) are
// reused as-is for this build's Creative Brief and Generator Handoff
// records respectively, since their pre-provisioned shape
// (`status`/`sourceOpportunityId` and `briefId` indexes) already matches
// exactly what those two new domain modules need.
//
// v10 (Build 028C, Marketing to Creative Director Workflow): adds an
// `opportunityId` index to the existing `marketingDesignHandoffs` store
// (pre-provisioned in v8, first given a real domain/store module in this
// build) — needed so the UI can look up "has this Market Opportunity
// already been sent to the Creative Director?" without a full-store scan.
// No new store is created; the store itself already existed since v8, so
// this upgrade only adds an index inside the existing store via the
// upgrade transaction's own `objectStore()` handle (the one case where an
// upgrade must reach into an *existing* store rather than create a new
// one).
//
// v11 (Build 029, Autonomous Design Autopilot): adds `autonomousDesignRuns`
// — the one new store spanning a whole "ออกแบบให้ฉันวันนี้" run (frozen
// Design Plan, per-item progress, READY/REVIEW/REJECT counts, resume
// state). Indexed by `status` (Autopilot History's active/completed
// filter) and `mode` (grouping runs by entry mode).
export const DB_VERSION = 11;
export const AUTONOMOUS_DESIGN_RUNS_STORE = 'autonomousDesignRuns';
export const COLLECTION_PLANS_STORE = 'collectionPlans';
export const APP_BACKUP_HISTORY_STORE = 'appBackupHistory';
export const RESEARCH_SOURCES_STORE = 'researchSources';
export const MARKET_OBSERVATIONS_STORE = 'marketObservations';
export const MARKET_SNAPSHOTS_STORE = 'marketSnapshots';
export const MARKET_KEYWORDS_STORE = 'marketKeywords';
export const SEASONAL_EVENTS_STORE = 'seasonalEvents';
export const MARKET_OPPORTUNITIES_STORE = 'marketOpportunities';
export const SCORING_PROFILES_STORE = 'scoringProfiles';
export const DAILY_MISSIONS_STORE = 'dailyMissions';
export const DESIGN_BRIEFS_STORE = 'designBriefs';
export const DESIGN_STRATEGIES_STORE = 'designStrategies';
export const DESIGN_CONFIGURATIONS_STORE = 'designConfigurations';
export const MARKETING_DESIGN_HANDOFFS_STORE = 'marketingDesignHandoffs';
export const COMMERCIAL_FEEDBACK_SIGNALS_STORE = 'commercialFeedbackSignals';
export const RECOMMENDATION_HISTORY_STORE = 'recommendationHistory';
export const SAVED_STORE = 'saved';
export const PROJECTS_STORE = 'projects';
export const ASSETS_STORE = 'assets';
export const PORTFOLIO_ASSETS_STORE = 'portfolioAssets';
export const PORTFOLIO_FILES_STORE = 'portfolioFiles';
export const COLLECTIONS_STORE = 'collections';
export const SUBMISSIONS_STORE = 'submissions';
export const QUALITY_SNAPSHOTS_STORE = 'qualitySnapshots';
export const SALES_EVENTS_STORE = 'salesEvents';
export const REJECTION_RECORDS_STORE = 'rejectionRecords';
export const PRODUCTION_QUEUE_STORE = 'productionQueueItems';
export const PRODUCTION_BATCHES_STORE = 'productionBatches';
export const IMPORT_HISTORY_STORE = 'importHistory';
export const MARKETPLACE_REGISTRATIONS_STORE = 'marketplaceRegistrations';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        // Every branch below is idempotent (`objectStoreNames.contains`
        // guarded) so this handler is safe to run on a fresh database
        // (every store created in one pass) or an upgrade from any prior
        // version (only the missing stores are created) — the normal
        // IndexedDB upgrade lifecycle already guarantees `onupgradeneeded`
        // only fires once per version increase, and re-running it against
        // an already-current database is a correct no-op, not a duplicate-
        // store error.
        if (!db.objectStoreNames.contains(SAVED_STORE)) db.createObjectStore(SAVED_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(ASSETS_STORE)) db.createObjectStore(ASSETS_STORE, { keyPath: 'metadata.id' });
        if (!db.objectStoreNames.contains(PORTFOLIO_ASSETS_STORE)) {
          db.createObjectStore(PORTFOLIO_ASSETS_STORE, { keyPath: 'assetId' });
        }
        if (!db.objectStoreNames.contains(PORTFOLIO_FILES_STORE)) {
          const files = db.createObjectStore(PORTFOLIO_FILES_STORE, { keyPath: 'fileId' });
          files.createIndex('assetId', 'assetId', { unique: false });
          files.createIndex('sha256', 'sha256', { unique: false });
        }
        if (!db.objectStoreNames.contains(COLLECTIONS_STORE)) {
          const collections = db.createObjectStore(COLLECTIONS_STORE, { keyPath: 'id' });
          collections.createIndex('normalizedName', 'normalizedName', { unique: false });
          collections.createIndex('isArchived', 'isArchived', { unique: false });
        }
        if (!db.objectStoreNames.contains(SUBMISSIONS_STORE)) {
          const submissions = db.createObjectStore(SUBMISSIONS_STORE, { keyPath: 'submissionId' });
          submissions.createIndex('patternId', 'patternId', { unique: false });
          submissions.createIndex('marketplaceId', 'marketplaceId', { unique: false });
          submissions.createIndex('status', 'status', { unique: false });
          submissions.createIndex('productionAssetId', 'productionAssetId', { unique: false });
        }
        if (!db.objectStoreNames.contains(QUALITY_SNAPSHOTS_STORE)) {
          const quality = db.createObjectStore(QUALITY_SNAPSHOTS_STORE, { keyPath: 'snapshotId' });
          quality.createIndex('assetId', 'assetId', { unique: false });
          quality.createIndex('productionAssetId', 'productionAssetId', { unique: false });
        }
        if (!db.objectStoreNames.contains(SALES_EVENTS_STORE)) {
          const sales = db.createObjectStore(SALES_EVENTS_STORE, { keyPath: 'eventId' });
          sales.createIndex('productionAssetId', 'productionAssetId', { unique: false });
          sales.createIndex('marketplaceId', 'marketplaceId', { unique: false });
        }
        if (!db.objectStoreNames.contains(REJECTION_RECORDS_STORE)) {
          const rejections = db.createObjectStore(REJECTION_RECORDS_STORE, { keyPath: 'rejectionId' });
          rejections.createIndex('submissionId', 'submissionId', { unique: false });
          rejections.createIndex('normalizedReason', 'normalizedReason', { unique: false });
        }
        if (!db.objectStoreNames.contains(PRODUCTION_QUEUE_STORE)) {
          const queue = db.createObjectStore(PRODUCTION_QUEUE_STORE, { keyPath: 'queueItemId' });
          queue.createIndex('status', 'status', { unique: false });
          queue.createIndex('batchId', 'batchId', { unique: false });
        }
        if (!db.objectStoreNames.contains(PRODUCTION_BATCHES_STORE)) {
          db.createObjectStore(PRODUCTION_BATCHES_STORE, { keyPath: 'batchId' });
        }
        if (!db.objectStoreNames.contains(IMPORT_HISTORY_STORE)) {
          const importHistory = db.createObjectStore(IMPORT_HISTORY_STORE, { keyPath: 'importId' });
          importHistory.createIndex('importedAt', 'importedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(MARKETPLACE_REGISTRATIONS_STORE)) {
          db.createObjectStore(MARKETPLACE_REGISTRATIONS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(APP_BACKUP_HISTORY_STORE)) {
          const backupHistory = db.createObjectStore(APP_BACKUP_HISTORY_STORE, { keyPath: 'historyId' });
          backupHistory.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(RESEARCH_SOURCES_STORE)) {
          const researchSources = db.createObjectStore(RESEARCH_SOURCES_STORE, { keyPath: 'id' });
          researchSources.createIndex('marketplace', 'marketplace', { unique: false });
          researchSources.createIndex('sourceType', 'sourceType', { unique: false });
        }
        if (!db.objectStoreNames.contains(MARKET_OBSERVATIONS_STORE)) {
          const observations = db.createObjectStore(MARKET_OBSERVATIONS_STORE, { keyPath: 'id' });
          observations.createIndex('researchSourceId', 'researchSourceId', { unique: false });
          observations.createIndex('evidenceStatus', 'evidenceStatus', { unique: false });
          observations.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(MARKET_SNAPSHOTS_STORE)) {
          const snapshots = db.createObjectStore(MARKET_SNAPSHOTS_STORE, { keyPath: 'id' });
          snapshots.createIndex('createdAt', 'createdAt', { unique: false });
          snapshots.createIndex('archived', 'archived', { unique: false });
        }
        if (!db.objectStoreNames.contains(MARKET_KEYWORDS_STORE)) {
          const keywords = db.createObjectStore(MARKET_KEYWORDS_STORE, { keyPath: 'id' });
          keywords.createIndex('keyword', 'keyword', { unique: false });
          keywords.createIndex('marketplace', 'marketplace', { unique: false });
        }
        if (!db.objectStoreNames.contains(SEASONAL_EVENTS_STORE)) {
          const seasonalEvents = db.createObjectStore(SEASONAL_EVENTS_STORE, { keyPath: 'id' });
          seasonalEvents.createIndex('eventDate', 'eventDate', { unique: false });
          seasonalEvents.createIndex('region', 'region', { unique: false });
        }
        if (!db.objectStoreNames.contains(MARKET_OPPORTUNITIES_STORE)) {
          const opportunities = db.createObjectStore(MARKET_OPPORTUNITIES_STORE, { keyPath: 'id' });
          opportunities.createIndex('snapshotId', 'snapshotId', { unique: false });
          opportunities.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains(SCORING_PROFILES_STORE)) {
          db.createObjectStore(SCORING_PROFILES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(DAILY_MISSIONS_STORE)) {
          const missions = db.createObjectStore(DAILY_MISSIONS_STORE, { keyPath: 'id' });
          missions.createIndex('date', 'date', { unique: false });
          missions.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains(DESIGN_BRIEFS_STORE)) {
          const briefs = db.createObjectStore(DESIGN_BRIEFS_STORE, { keyPath: 'id' });
          briefs.createIndex('status', 'status', { unique: false });
          briefs.createIndex('sourceOpportunityId', 'sourceOpportunityId', { unique: false });
        }
        if (!db.objectStoreNames.contains(DESIGN_STRATEGIES_STORE)) {
          const strategies = db.createObjectStore(DESIGN_STRATEGIES_STORE, { keyPath: 'id' });
          strategies.createIndex('briefId', 'briefId', { unique: false });
        }
        if (!db.objectStoreNames.contains(DESIGN_CONFIGURATIONS_STORE)) {
          const configurations = db.createObjectStore(DESIGN_CONFIGURATIONS_STORE, { keyPath: 'id' });
          configurations.createIndex('briefId', 'briefId', { unique: false });
        }
        if (!db.objectStoreNames.contains(MARKETING_DESIGN_HANDOFFS_STORE)) {
          const handoffs = db.createObjectStore(MARKETING_DESIGN_HANDOFFS_STORE, { keyPath: 'id' });
          handoffs.createIndex('status', 'status', { unique: false });
          handoffs.createIndex('briefId', 'briefId', { unique: false });
          handoffs.createIndex('opportunityId', 'marketOpportunityId', { unique: false });
        } else {
          // v10: the store already existed (v8) — reach into it via the
          // upgrade transaction to add the new index without recreating
          // the store (which would discard any data already in it).
          const handoffs = req.transaction!.objectStore(MARKETING_DESIGN_HANDOFFS_STORE);
          if (!handoffs.indexNames.contains('opportunityId')) {
            handoffs.createIndex('opportunityId', 'marketOpportunityId', { unique: false });
          }
        }
        if (!db.objectStoreNames.contains(COMMERCIAL_FEEDBACK_SIGNALS_STORE)) {
          const feedbackSignals = db.createObjectStore(COMMERCIAL_FEEDBACK_SIGNALS_STORE, { keyPath: 'id' });
          feedbackSignals.createIndex('signalType', 'signalType', { unique: false });
          feedbackSignals.createIndex('computedAt', 'computedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(RECOMMENDATION_HISTORY_STORE)) {
          const recommendationHistory = db.createObjectStore(RECOMMENDATION_HISTORY_STORE, { keyPath: 'id' });
          recommendationHistory.createIndex('recommendationType', 'recommendationType', { unique: false });
          recommendationHistory.createIndex('refId', 'refId', { unique: false });
        }
        if (!db.objectStoreNames.contains(COLLECTION_PLANS_STORE)) {
          const collectionPlans = db.createObjectStore(COLLECTION_PLANS_STORE, { keyPath: 'id' });
          collectionPlans.createIndex('briefId', 'briefId', { unique: false });
        }
        if (!db.objectStoreNames.contains(AUTONOMOUS_DESIGN_RUNS_STORE)) {
          const autonomousRuns = db.createObjectStore(AUTONOMOUS_DESIGN_RUNS_STORE, { keyPath: 'id' });
          autonomousRuns.createIndex('status', 'status', { unique: false });
          autonomousRuns.createIndex('mode', 'mode', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

export function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function requestAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Generic localStorage fallback (only used when IndexedDB is unavailable,
 * e.g. some file:// setups with the offline single-file build) — shared by
 * every store instead of each re-implementing the same load/store/parse
 * logic under a different key. */
export function lsLoad<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function lsStore<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // quota exceeded — nothing else we can do in fallback mode
  }
}
