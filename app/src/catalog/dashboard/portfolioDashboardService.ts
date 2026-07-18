import { loadCollections } from '../storage/collectionStore';
import { loadPortfolioAssets } from '../storage/portfolioStore';
import { loadSubmissions } from '../submission/submissionStore';
import { buildDashboardSnapshot } from './dashboardSnapshot';
import type { DashboardSnapshot } from './dashboardSnapshot';

// Build 017 — Portfolio Dashboard Service: the one place this module
// touches live storage, and even here only ever by calling three
// already-existing, unmodified READ functions — `loadCollections`
// (frozen Collection API), `loadPortfolioAssets` (frozen Collection
// API), `loadSubmissions` (Submission Center, Build 015). No write
// function from any module is imported anywhere in
// `app/src/catalog/dashboard/`, which is what makes "Read-only
// integration" a checkable fact about this module's import graph, not
// just a description of intent.
//
// Every other file in this module (`collectionAnalytics.ts` through
// `dashboardSnapshot.ts`) is a pure function over plain data and has no
// storage dependency at all — this is the only place the three loaders
// are called and stitched together, matching the same
// pure-computation/thin-loader split `catalog/submission/`'s
// `submissionQueue.ts` (pure) vs `submissionStore.ts` (loader) and
// `catalog/backup/`'s `backupBuilder.ts` already established.

/** Loads the current live state of Collections, the Portfolio catalog,
 * and Submission Center, and assembles a real `DashboardSnapshot` from
 * it. The only non-deterministic part of the result is `generatedAt`
 * (`Date.now()`, since no `now` override is given here) — every score,
 * count, and recommendation is a deterministic function of whatever
 * `loadCollections`/`loadPortfolioAssets`/`loadSubmissions` return at
 * the moment this is called. */
export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [collections, assets] = await Promise.all([loadCollections(), loadPortfolioAssets()]);
  const submissions = loadSubmissions();
  return buildDashboardSnapshot({ collections, assets, submissions });
}
