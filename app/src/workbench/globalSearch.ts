import type { Project } from '../project/projectTypes';
import { TREND_PACK_LIST } from '../trend/trendPacks';
import { listMotifGrammars } from '../services/motifGrammarService';
import { listMarketplaces } from '../services/marketplaceService';

// Design Workbench Section 9 ("Global Search — Projects, Collections,
// Motifs, Trend Packs, Marketplace Profiles"). Pure lookup over data this
// component tree already has: `projects` is passed in (it's App.tsx's own
// state, same as Project Explorer receives); Trend Packs, Motif Grammars,
// and Marketplace Profiles come straight from their existing registries
// (`trend/trendPacks.ts`, `services/motifGrammarService.ts`,
// `services/marketplaceService.ts`) — nothing new is indexed or cached, so
// results are always current with zero staleness risk.

export type GlobalSearchResultType = 'project' | 'collection' | 'motif' | 'trendPack' | 'marketplace';

export interface GlobalSearchResult {
  type: GlobalSearchResultType;
  id: string;
  label: string;
  detail: string;
  /** Set only for 'collection' results — the parent Project's id, so a
   * caller can jump to the right project when a collection is picked. */
  projectId?: string;
}

function includesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query);
}

/** Case-insensitive substring match across all 5 named categories. Returns
 * `[]` for an empty/whitespace-only query rather than every item, so an
 * empty search box shows no results instead of a giant unfiltered dump. */
export function searchWorkbench(query: string, projects: Project[]): GlobalSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: GlobalSearchResult[] = [];

  for (const project of projects) {
    if (includesQuery(project.name, q)) {
      results.push({
        type: 'project',
        id: project.id,
        label: project.name,
        detail: `${project.collections.length} collection(s) · ${project.designSpecs.length} design spec(s)`,
      });
    }
    for (const entry of project.collections) {
      if (includesQuery(entry.collection.manifest.collectionName, q)) {
        results.push({
          type: 'collection',
          id: entry.id,
          label: entry.collection.manifest.collectionName,
          detail: `in ${project.name} · ${entry.collection.assets.length} asset(s)`,
          projectId: project.id,
        });
      }
    }
  }

  for (const grammar of listMotifGrammars()) {
    if (includesQuery(grammar.label, q) || includesQuery(grammar.id, q)) {
      results.push({ type: 'motif', id: grammar.id, label: grammar.label, detail: `${grammar.family} family` });
    }
  }

  for (const pack of TREND_PACK_LIST) {
    if (includesQuery(pack.label, q) || includesQuery(pack.theme, q)) {
      results.push({ type: 'trendPack', id: pack.id, label: pack.label, detail: pack.theme });
    }
  }

  for (const marketplace of listMarketplaces()) {
    if (includesQuery(marketplace.label, q) || includesQuery(marketplace.id, q)) {
      results.push({ type: 'marketplace', id: marketplace.id, label: marketplace.label, detail: marketplace.future ? 'coming soon' : 'available' });
    }
  }

  return results;
}
