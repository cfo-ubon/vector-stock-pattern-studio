import { loadMarketSnapshots, getMarketSnapshot, putMarketSnapshot } from '../storage/marketSnapshotStore';
import {
  createMarketSnapshot,
  duplicateMarketSnapshot,
  describeSnapshotFreshness,
  isValidMarketSnapshot,
  type MarketSnapshot,
  type CreateMarketSnapshotInput,
} from '../domain/marketSnapshot';

// Build 028, Module 1 Section 3 — the service layer over
// `marketSnapshotStore.ts` for the operations the brief lists by name (save,
// duplicate, compare, archive, export, import, use offline). Kept separate
// from the raw store so UI code never has to know the difference between
// "create a snapshot record" and "persist it" — `saveSnapshot` does both in
// one call, matching how every other domain module in this app (e.g.
// `submissionService.ts` over `submissionStore.ts`) separates the pure
// record factory from the stateful save operation.

export async function saveSnapshot(input: CreateMarketSnapshotInput): Promise<MarketSnapshot> {
  const snapshot = createMarketSnapshot(input);
  await putMarketSnapshot(snapshot);
  return snapshot;
}

export async function duplicateSnapshot(snapshotId: string, now: number = Date.now()): Promise<MarketSnapshot> {
  const source = await getMarketSnapshot(snapshotId);
  if (!source) {
    throw new Error(`Market Snapshot "${snapshotId}" was not found — cannot duplicate a snapshot that doesn't exist.`);
  }
  const copy = duplicateMarketSnapshot(source, now);
  await putMarketSnapshot(copy);
  return copy;
}

export async function archiveSnapshot(snapshotId: string): Promise<MarketSnapshot> {
  const source = await getMarketSnapshot(snapshotId);
  if (!source) {
    throw new Error(`Market Snapshot "${snapshotId}" was not found — cannot archive a snapshot that doesn't exist.`);
  }
  const archived: MarketSnapshot = { ...source, archived: true };
  await putMarketSnapshot(archived);
  return archived;
}

export interface SnapshotComparison {
  a: MarketSnapshot;
  b: MarketSnapshot;
  addedKeywords: string[];
  removedKeywords: string[];
  addedThemes: string[];
  removedThemes: string[];
  addedMarketplaces: string[];
  removedMarketplaces: string[];
  demandChanged: boolean;
  competitionChanged: boolean;
  confidenceChanged: boolean;
}

function diffLists(before: string[], after: string[]): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((x) => !beforeSet.has(x)),
    removed: before.filter((x) => !afterSet.has(x)),
  };
}

/** Section 3's "Compare snapshots" — a plain, explainable field-by-field
 * diff, not a fabricated "similarity score"; every difference is something
 * the user can see traced directly to the two snapshots' own real fields. */
export async function compareSnapshots(snapshotIdA: string, snapshotIdB: string): Promise<SnapshotComparison> {
  const a = await getMarketSnapshot(snapshotIdA);
  const b = await getMarketSnapshot(snapshotIdB);
  if (!a || !b) {
    throw new Error('Both snapshots must exist to compare them.');
  }
  const keywords = diffLists(a.keywords, b.keywords);
  const themes = diffLists(a.themes, b.themes);
  const marketplaces = diffLists(a.marketplaces, b.marketplaces);
  return {
    a,
    b,
    addedKeywords: keywords.added,
    removedKeywords: keywords.removed,
    addedThemes: themes.added,
    removedThemes: themes.removed,
    addedMarketplaces: marketplaces.added,
    removedMarketplaces: marketplaces.removed,
    demandChanged: a.observedDemand !== b.observedDemand,
    competitionChanged: a.observedCompetition !== b.observedCompetition,
    confidenceChanged: a.confidence !== b.confidence,
  };
}

/** Section 3's "Export snapshot as JSON" — a plain JSON string, not a Blob,
 * so both the browser download path and the `.vspsb` backup path (which
 * serializes the same store generically, see `appBackupFormat.ts`) can
 * reuse this one serialization without duplicating field-selection logic. */
export function exportSnapshotAsJson(snapshot: MarketSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export class InvalidSnapshotImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSnapshotImportError';
  }
}

/** Section 3's "Import snapshot from JSON" — validates shape before
 * persisting, and always mints a fresh id on import so importing the same
 * exported file twice creates two independent snapshots rather than
 * silently overwriting one by a shared id collision. */
export async function importSnapshotFromJson(json: string, now: number = Date.now()): Promise<MarketSnapshot> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new InvalidSnapshotImportError('The provided text is not valid JSON.');
  }
  if (!isValidMarketSnapshot(parsed)) {
    throw new InvalidSnapshotImportError('The provided JSON is not a valid Market Snapshot.');
  }
  const imported = duplicateMarketSnapshot(parsed, now);
  await putMarketSnapshot(imported);
  return imported;
}

/** Section 3's "Use saved snapshot offline" plus the app-wide "never
 * disguise stale data" rule — returns the most recent non-archived
 * snapshot (there is always at least the last one saved, matching "do not
 * delete old snapshots automatically") along with a ready-to-render
 * freshness label and explicit live/offline classification, so a caller
 * never has to re-derive this logic. */
export interface OfflineSnapshotResult {
  snapshot: MarketSnapshot | null;
  freshnessLabel: string;
  classification: 'SAVED_SNAPSHOT' | 'NO_DATA';
  message: string;
}

export async function getMostRecentSnapshotForOfflineUse(now: number = Date.now()): Promise<OfflineSnapshotResult> {
  const all = await loadMarketSnapshots();
  const active = all.filter((s) => !s.archived).sort((a, b) => b.createdAt - a.createdAt);
  const snapshot = active[0] ?? null;
  if (!snapshot) {
    return {
      snapshot: null,
      freshnessLabel: '',
      classification: 'NO_DATA',
      message: 'No verified live market data is available. No saved Market Snapshot exists yet — visit Market Research Workspace to capture one.',
    };
  }
  const freshnessLabel = describeSnapshotFreshness(snapshot.createdAt, now);
  const dateLabel = new Date(snapshot.createdAt).toISOString().slice(0, 10);
  return {
    snapshot,
    freshnessLabel,
    classification: 'SAVED_SNAPSHOT',
    message: `No verified live market data is available. Recommendations are based on the saved snapshot dated ${dateLabel} (${freshnessLabel}).`,
  };
}
