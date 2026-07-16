// Design Knowledge Engine (Phase 6.5) — Section 10 "Learning History".
// Distinct from `workbench/workbenchFavorites.ts` (explicit star-toggle
// favorites, unmodified, still the real owner of that concern): this
// tracks *implicit* usage — how often a Style DNA/Palette/Motif was
// actually used, and which Collections were generated recently, whether
// or not the user ever starred anything. Two separate concerns, two
// separate stores, same pure-function/localStorage convention
// `workbench/workspaceSettings.ts` already established (load/save,
// defensive normalize, JSON export/import) — reused here rather than
// invented a second way to persist local state.

export interface RecentCollectionRef {
  id: string;
  name: string;
  createdAt: number;
}

export interface LearningHistory {
  schemaVersion: number;
  enabled: boolean;
  styleDnaUsage: Record<string, number>;
  paletteUsage: Record<string, number>;
  motifUsage: Record<string, number>;
  recentCollections: RecentCollectionRef[];
}

export const LEARNING_HISTORY_SCHEMA_VERSION = 1;
export const RECENT_COLLECTIONS_LIMIT = 20;

export const DEFAULT_LEARNING_HISTORY: LearningHistory = {
  schemaVersion: LEARNING_HISTORY_SCHEMA_VERSION,
  enabled: true,
  styleDnaUsage: {},
  paletteUsage: {},
  motifUsage: {},
  recentCollections: [],
};

const STORAGE_KEY = 'vsp-knowledge-learning-history-v1';

function normalizeUsageMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && value >= 0) out[key] = value;
  }
  return out;
}

function normalizeRecentCollections(raw: unknown): RecentCollectionRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is RecentCollectionRef => {
      return (
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as RecentCollectionRef).id === 'string' &&
        typeof (entry as RecentCollectionRef).name === 'string' &&
        typeof (entry as RecentCollectionRef).createdAt === 'number'
      );
    })
    .slice(0, RECENT_COLLECTIONS_LIMIT);
}

/** Defensive merge — every field falls back to the default individually,
 * matching `workbench/workspaceSettings.ts`'s `normalizeWorkspaceSettings`
 * convention, so a corrupt/partial/hand-edited import never crashes. */
function normalizeLearningHistory(raw: unknown): LearningHistory {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<LearningHistory>;
  return {
    schemaVersion: LEARNING_HISTORY_SCHEMA_VERSION,
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : DEFAULT_LEARNING_HISTORY.enabled,
    styleDnaUsage: normalizeUsageMap(obj.styleDnaUsage),
    paletteUsage: normalizeUsageMap(obj.paletteUsage),
    motifUsage: normalizeUsageMap(obj.motifUsage),
    recentCollections: normalizeRecentCollections(obj.recentCollections),
  };
}

export function loadLearningHistory(): LearningHistory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LEARNING_HISTORY };
    return normalizeLearningHistory(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_LEARNING_HISTORY };
  }
}

export function saveLearningHistory(history: LearningHistory): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // storage unavailable — history just won't persist across reloads
  }
}

export function setLearningHistoryEnabled(history: LearningHistory, enabled: boolean): LearningHistory {
  return { ...history, enabled };
}

function bumpUsage(usage: Record<string, number>, id: string): Record<string, number> {
  return { ...usage, [id]: (usage[id] ?? 0) + 1 };
}

/** No-op (returns `history` unchanged) when `history.enabled` is false —
 * the real "disable" semantics the brief asks for: turning tracking off
 * genuinely stops new data from being recorded, not just hides a UI. */
export function recordStyleDnaUsage(history: LearningHistory, id: string): LearningHistory {
  if (!history.enabled) return history;
  return { ...history, styleDnaUsage: bumpUsage(history.styleDnaUsage, id) };
}

export function recordPaletteUsage(history: LearningHistory, id: string): LearningHistory {
  if (!history.enabled) return history;
  return { ...history, paletteUsage: bumpUsage(history.paletteUsage, id) };
}

export function recordMotifUsage(history: LearningHistory, id: string): LearningHistory {
  if (!history.enabled) return history;
  return { ...history, motifUsage: bumpUsage(history.motifUsage, id) };
}

/** Most-recent-first, deduped by id (a re-recorded id moves back to the
 * front instead of appearing twice), capped at `RECENT_COLLECTIONS_LIMIT`. */
export function recordCollectionGenerated(history: LearningHistory, ref: RecentCollectionRef): LearningHistory {
  if (!history.enabled) return history;
  const withoutDupe = history.recentCollections.filter((c) => c.id !== ref.id);
  return { ...history, recentCollections: [ref, ...withoutDupe].slice(0, RECENT_COLLECTIONS_LIMIT) };
}

function topNByCount(usage: Record<string, number>, topN: number): string[] {
  return Object.entries(usage)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([id]) => id);
}

export function getFrequentStyleDna(history: LearningHistory, topN = 5): string[] {
  return topNByCount(history.styleDnaUsage, topN);
}

export function getFrequentPalettes(history: LearningHistory, topN = 5): string[] {
  return topNByCount(history.paletteUsage, topN);
}

export function getFrequentMotifs(history: LearningHistory, topN = 5): string[] {
  return topNByCount(history.motifUsage, topN);
}

export function getRecentCollections(history: LearningHistory, topN = 10): RecentCollectionRef[] {
  return history.recentCollections.slice(0, topN);
}

/** Resets usage counts and recent collections but preserves the caller's
 * current `enabled` choice — clearing data shouldn't silently re-enable
 * tracking a user turned off, or silently disable tracking for a user who
 * just wanted a clean slate. */
export function clearLearningHistory(history: LearningHistory): LearningHistory {
  return { ...DEFAULT_LEARNING_HISTORY, enabled: history.enabled };
}

export function serializeLearningHistory(history: LearningHistory): string {
  return JSON.stringify(history, null, 2);
}

export function parseLearningHistoryJson(json: string): LearningHistory {
  const parsed: unknown = JSON.parse(json);
  return normalizeLearningHistory(parsed);
}
