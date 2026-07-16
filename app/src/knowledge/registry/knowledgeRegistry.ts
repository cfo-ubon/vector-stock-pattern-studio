import type { StyleDna } from '../../engine/styleDna';
import { BOTANICAL_SPECIES, BOTANICAL_FAMILIES, type BotanicalFamily, type BotanicalSpeciesProfile } from '../../generators/botanicalFamilies';
import schemaVersionData from '../schema_version.json';
import { STYLE_SCHEMA_VERSION } from './styleSchema';
import { STYLE_RAW_RECORDS } from './styleData';
import { loadStyleRecords, formatStyleLoadIssues, type StyleLoadIssue } from './styleLoader';

// Build 008A, Section 2 (Knowledge Registry) — the one reusable loading/
// validation/caching/versioning layer future builds (Species, Products,
// Marketplace, Collections — see the brief's own closing framing) can add
// a domain to without redesigning this class. Today only the `style`
// domain has real migrated data (`styleData.ts`); `getSpecies()` exists
// now as a real, working accessor over the still-hardcoded
// `BOTANICAL_SPECIES` table (Build 007) so the call-site contract is
// already in place for whenever Species itself gets a real JSON+schema
// migration (Build 008B, per BUILD_008A_AUDIT.md's recommendation) --
// nothing about `botanicalFamilies.ts` is touched or restructured.

export interface KnowledgeSchemaVersion {
  knowledgeVersion: string;
  styleSchema: string;
  speciesSchema: string;
}

export interface KnowledgeDiagnostics {
  /** The declared version from `knowledge/schema_version.json`. */
  declaredVersion: KnowledgeSchemaVersion;
  /** The version this build's loader code actually implements — compared
   * against `declaredVersion.styleSchema` at load time; a mismatch is a
   * real, rejected load (Section 6: "reject... wrong schema versions"). */
  implementedStyleSchemaVersion: string;
  styleCount: number;
  speciesCount: number;
  /** Wall-clock time the registry's cache was last (re)populated, ms since
   * epoch — 0 if never loaded (lazy: nothing is loaded until first use). */
  lastLoadedAt: number;
}

/** Thrown when the Knowledge Registry fails to load — always carries a
 * readable, multi-issue message (Section 6's own requirement) rather than
 * a generic "invalid data" string. Callers that want the structured list
 * instead of just the message can read `.loadIssues`. */
export class KnowledgeValidationError extends Error {
  loadIssues: StyleLoadIssue[];
  constructor(message: string, loadIssues: StyleLoadIssue[]) {
    super(message);
    this.name = 'KnowledgeValidationError';
    this.loadIssues = loadIssues;
  }
}

class KnowledgeRegistryImpl {
  private styleCache: Map<string, StyleDna> | null = null;
  private lastLoadedAt = 0;

  /** Loads (or returns the already-cached) style map. Real caching: the
   * JSON imports + validation pass run at most once per process lifetime
   * (module-level singleton, see the exported `KnowledgeRegistry` below),
   * not once per `getStyle`/`list` call. */
  private ensureStylesLoaded(): Map<string, StyleDna> {
    if (this.styleCache) return this.styleCache;

    const declaredVersion = (schemaVersionData as KnowledgeSchemaVersion).styleSchema;
    if (declaredVersion !== STYLE_SCHEMA_VERSION) {
      throw new KnowledgeValidationError(
        `Knowledge Registry: schema_version.json declares styleSchema "${declaredVersion}" but the loader implements "${STYLE_SCHEMA_VERSION}". Update one to match the other before loading.`,
        [],
      );
    }

    const result = loadStyleRecords(STYLE_RAW_RECORDS);
    if (!result.styles) {
      const message = `Knowledge Registry: ${result.issues.length} style record(s) failed validation:\n${formatStyleLoadIssues(result.issues)}`;
      throw new KnowledgeValidationError(message, result.issues);
    }

    this.styleCache = result.styles;
    this.lastLoadedAt = Date.now();
    return this.styleCache;
  }

  /** Resolves one style by id, or `undefined` if no such style exists —
   * never throws for an unknown id (matches `engine/styleDna.ts`'s own
   * pre-existing `getStyleDna`-style lookup convention), only a genuinely
   * broken data load throws. */
  getStyle(id: string): StyleDna | undefined {
    return this.ensureStylesLoaded().get(id);
  }

  /** Real per-species accessor over the existing `BOTANICAL_SPECIES` table
   * (Build 004/005/007) — species data itself is NOT migrated this build
   * (see BUILD_008A_AUDIT.md §2), this just gives future callers the same
   * `KnowledgeRegistry.getSpecies(...)` shape they'll keep using once it is. */
  getSpecies(family: BotanicalFamily): BotanicalSpeciesProfile | undefined {
    return BOTANICAL_SPECIES[family];
  }

  /** Lists every loaded record for a domain. Only `'style'` has real
   * migrated data this build; `'species'` reads the same fixed real
   * taxonomy `getSpecies` does. */
  list(domain: 'style'): StyleDna[];
  list(domain: 'species'): BotanicalSpeciesProfile[];
  list(domain: 'style' | 'species'): StyleDna[] | BotanicalSpeciesProfile[] {
    if (domain === 'style') return [...this.ensureStylesLoaded().values()];
    return BOTANICAL_FAMILIES.map((f) => BOTANICAL_SPECIES[f]);
  }

  /** Re-runs validation over the currently-loaded style records (or loads
   * them fresh if not yet cached) and returns a non-throwing report —
   * unlike `ensureStylesLoaded`, this never throws, so a caller (a
   * diagnostics panel, a test) can inspect problems without crashing. */
  validate(): { valid: boolean; issues: StyleLoadIssue[] } {
    const result = loadStyleRecords(STYLE_RAW_RECORDS);
    return { valid: result.styles !== null, issues: result.issues };
  }

  /** Real, computed diagnostics — every field here is either read
   * straight from `schema_version.json`, counted from the actually-loaded
   * data, or a real timestamp; nothing estimated. */
  diagnostics(): KnowledgeDiagnostics {
    const styles = this.ensureStylesLoaded();
    return {
      declaredVersion: schemaVersionData as KnowledgeSchemaVersion,
      implementedStyleSchemaVersion: STYLE_SCHEMA_VERSION,
      styleCount: styles.size,
      speciesCount: BOTANICAL_FAMILIES.length,
      lastLoadedAt: this.lastLoadedAt,
    };
  }

  /** Test-only escape hatch: drops the cache so the next call re-loads
   * from scratch. Production code never needs this (the data is static
   * for the lifetime of the app); tests use it to verify load-vs-cache
   * behavior without sharing state across test cases. */
  _resetCacheForTests(): void {
    this.styleCache = null;
    this.lastLoadedAt = 0;
  }
}

export const KnowledgeRegistry = new KnowledgeRegistryImpl();
