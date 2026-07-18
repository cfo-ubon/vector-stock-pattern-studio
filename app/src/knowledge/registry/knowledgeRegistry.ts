import type { StyleDna } from '../../engine/styleDna';
import type { BotanicalFamily } from '../../generators/botanicalFamilies';
import schemaVersionData from '../schema_version.json';
import { STYLE_SCHEMA_VERSION } from './styleSchema';
import { STYLE_RAW_RECORDS } from './styleData';
import { loadStyleRecords, formatStyleLoadIssues, type StyleLoadIssue } from './styleLoader';
import type { BotanicalSpeciesRecord } from './speciesSchema';
import { SPECIES_SCHEMA_VERSION } from './speciesSchema';
import { SPECIES_RAW_RECORDS } from './speciesData';
import { loadSpeciesRecords, formatSpeciesLoadIssues, type SpeciesLoadIssue } from './speciesLoader';

// Build 008A, Section 2 (Knowledge Registry) — the one reusable loading/
// validation/caching/versioning layer future builds (Species, Products,
// Marketplace, Collections — see the brief's own closing framing) can add
// a domain to without redesigning this class. Build 008B, Section 1 adds
// the second real domain: `species` now loads/validates/caches real JSON
// records (`speciesData.ts`/`speciesLoader.ts`) exactly like `style` does
// — `generators/botanicalFamilies.ts`'s `BOTANICAL_SPECIES` is built FROM
// `KnowledgeRegistry.list('species')`, so only a type-only import of
// `BotanicalFamily` remains here (no runtime circularity).

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
  private speciesCache: Map<string, BotanicalSpeciesRecord> | null = null;
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

  /** Loads (or returns the already-cached) species map — same real
   * load-validate-cache-once pattern as `ensureStylesLoaded` (Build 008B,
   * Section 1). */
  private ensureSpeciesLoaded(): Map<string, BotanicalSpeciesRecord> {
    if (this.speciesCache) return this.speciesCache;

    const declaredVersion = (schemaVersionData as KnowledgeSchemaVersion).speciesSchema;
    if (declaredVersion !== SPECIES_SCHEMA_VERSION) {
      throw new KnowledgeValidationError(
        `Knowledge Registry: schema_version.json declares speciesSchema "${declaredVersion}" but the loader implements "${SPECIES_SCHEMA_VERSION}". Update one to match the other before loading.`,
        [],
      );
    }

    const result = loadSpeciesRecords(SPECIES_RAW_RECORDS);
    if (!result.species) {
      const message = `Knowledge Registry: ${result.issues.length} species record(s) failed validation:\n${formatSpeciesLoadIssues(result.issues)}`;
      throw new KnowledgeValidationError(message, []);
    }

    this.speciesCache = result.species;
    this.lastLoadedAt = Date.now();
    return this.speciesCache;
  }

  /** Resolves one species record by botanical family id, or `undefined` if
   * unknown — reads from the real, loaded-and-validated species cache
   * (Build 008B), no longer a direct proxy to a hardcoded table. */
  getSpecies(family: BotanicalFamily): BotanicalSpeciesRecord | undefined {
    return this.ensureSpeciesLoaded().get(family);
  }

  /** Lists every loaded record for a domain — both `'style'` and
   * `'species'` are real, loaded, validated, cached data (Build 008A +
   * 008B). */
  list(domain: 'style'): StyleDna[];
  list(domain: 'species'): BotanicalSpeciesRecord[];
  list(domain: 'style' | 'species'): StyleDna[] | BotanicalSpeciesRecord[] {
    if (domain === 'style') return [...this.ensureStylesLoaded().values()];
    return [...this.ensureSpeciesLoaded().values()];
  }

  /** Re-runs validation over the currently-loaded style and species
   * records (or loads them fresh if not yet cached) and returns a
   * non-throwing report — unlike `ensureStylesLoaded`/`ensureSpeciesLoaded`,
   * this never throws, so a caller (a diagnostics panel, a test) can
   * inspect problems without crashing. */
  validate(): { valid: boolean; issues: StyleLoadIssue[]; speciesIssues: SpeciesLoadIssue[] } {
    const styleResult = loadStyleRecords(STYLE_RAW_RECORDS);
    const speciesResult = loadSpeciesRecords(SPECIES_RAW_RECORDS);
    return {
      valid: styleResult.styles !== null && speciesResult.species !== null,
      issues: styleResult.issues,
      speciesIssues: speciesResult.issues,
    };
  }

  /** Real, computed diagnostics — every field here is either read
   * straight from `schema_version.json`, counted from the actually-loaded
   * data, or a real timestamp; nothing estimated. */
  diagnostics(): KnowledgeDiagnostics {
    const styles = this.ensureStylesLoaded();
    const species = this.ensureSpeciesLoaded();
    return {
      declaredVersion: schemaVersionData as KnowledgeSchemaVersion,
      implementedStyleSchemaVersion: STYLE_SCHEMA_VERSION,
      styleCount: styles.size,
      speciesCount: species.size,
      lastLoadedAt: this.lastLoadedAt,
    };
  }

  /** Test-only escape hatch: drops the cache so the next call re-loads
   * from scratch. Production code never needs this (the data is static
   * for the lifetime of the app); tests use it to verify load-vs-cache
   * behavior without sharing state across test cases. */
  _resetCacheForTests(): void {
    this.styleCache = null;
    this.speciesCache = null;
    this.lastLoadedAt = 0;
  }
}

export const KnowledgeRegistry = new KnowledgeRegistryImpl();
