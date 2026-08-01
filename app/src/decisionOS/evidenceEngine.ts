import type { DecisionRequestContext, EvidenceBundle, EvidenceRecord, EvidenceFreshness, EvidenceSourceKind } from './domain/types';

// Build 031B, Part 2 & 13 — Evidence Engine. Every AI module reaches
// business data only through `EvidenceRecord`s built here, never by
// reading `context.data` directly inside a policy (see each
// `policies/*.ts` file) — this is the layer that turns "whatever the
// caller happened to load" into a typed, provenance-tracked, cacheable
// fact. Providers are pure functions of `(context) => EvidenceRecord[]`:
// they never touch IndexedDB themselves (the caller's existing loader
// already did that — see each `adapters/*.ts` file), matching this
// build's "reuse existing engines" instruction.

export type EvidenceProvider = (context: DecisionRequestContext) => EvidenceRecord[];

const PROVIDERS = new Map<EvidenceSourceKind, EvidenceProvider>();

export function registerEvidenceProvider(source: EvidenceSourceKind, provider: EvidenceProvider): void {
  PROVIDERS.set(source, provider);
}

export function resetEvidenceProvidersForTest(): void {
  PROVIDERS.clear();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Freshness is always computed here, from the record's own `timestamp`
 * vs "now" — never asserted by a provider — so two providers can never
 * disagree about what "fresh" means. A `timestamp` of 0 (no real
 * timestamp exists) always reports `UNKNOWN`, never a fabricated `LIVE`. */
export function classifyFreshness(timestamp: number, now: number): EvidenceFreshness {
  if (!timestamp || timestamp <= 0) return 'UNKNOWN';
  const age = now - timestamp;
  if (age < 0) return 'UNKNOWN';
  if (age <= 60 * 1000) return 'LIVE';
  if (age <= 7 * DAY_MS) return 'RECENT';
  return 'STALE';
}

/** Part 13 — a short-lived cache so a single top-level decision (which may
 * ask for the same evidence source more than once, e.g. one adapter
 * calling `gatherEvidence` for both a blocking check and a ranking pass)
 * never re-runs the same provider twice. Deliberately NOT a module-level
 * singleton with unbounded lifetime: callers create one `EvidenceCache`
 * per `runDecision` (or per batch of decisions sharing the same
 * already-loaded data) and let it go out of scope — this is a request-
 * scoped cache, not an app-wide one that could silently serve stale data
 * across unrelated decisions. */
export class EvidenceCache {
  private readonly entries = new Map<EvidenceSourceKind, EvidenceRecord[]>();
  private calls = 0;

  get callCount(): number {
    return this.calls;
  }

  gather(source: EvidenceSourceKind, context: DecisionRequestContext): EvidenceRecord[] {
    const cached = this.entries.get(source);
    if (cached) return cached;
    const provider = PROVIDERS.get(source);
    this.calls += 1;
    const records = provider ? provider(context) : [];
    this.entries.set(source, records);
    return records;
  }
}

/** Gathers evidence for exactly the sources a caller asks for (typically
 * the union of every enabled policy's `requiredEvidence` — see
 * `decisionEngine.ts`). Accepts an optional shared `EvidenceCache` so
 * multiple decisions evaluated back-to-back against the same underlying
 * data (e.g. ranking every asset in a portfolio) don't re-run providers
 * per item. */
export function gatherEvidence(context: DecisionRequestContext, sources: EvidenceSourceKind[], cache: EvidenceCache = new EvidenceCache()): EvidenceBundle {
  const records: EvidenceRecord[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const record of cache.gather(source, context)) {
      if (seen.has(record.id)) continue;
      seen.add(record.id);
      records.push(record);
    }
  }
  return { gatheredAt: context.now, records };
}
