import { useMemo, useState } from 'react';
import type { Project } from '../../project/projectTypes';
import type { TrendPack } from '../../trend/trendPacks';
import { TREND_PACK_LIST } from '../../trend/trendPacks';
import { searchWorkbench, type GlobalSearchResult } from '../../workbench/globalSearch';

// Design Workbench Section 9 ("Global Search"). A single header-level
// search box over `workbench/globalSearch.ts`'s real lookup. Picking a
// result performs the one sensible real action for its type — a Project
// or a Collection result switches to that Project (`onSwitchProject`,
// the same callback Project Explorer uses); a Trend Pack result applies
// it to the current spec (`onApplyTrendPack`, the same
// `applyTrendPackToSpec` flow Import/Export and Project Explorer's
// drag-and-drop already use). Motif and Marketplace Profile results are
// informational only — there is no existing "jump to and select this
// motif/marketplace" affordance to reuse without inventing new state, so
// this honestly shows them without pretending to navigate anywhere.

const TYPE_LABELS: Record<GlobalSearchResult['type'], string> = {
  project: '📁 Project',
  collection: '🏭 Collection',
  motif: '🌿 Motif',
  trendPack: '📈 Trend Pack',
  marketplace: '🏬 Marketplace',
};

interface Props {
  projects: Project[];
  onSwitchProject: (id: string) => void;
  onApplyTrendPack: (pack: TrendPack) => void;
}

export function GlobalSearchBar({ projects, onSwitchProject, onApplyTrendPack }: Props) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchWorkbench(query, projects), [query, projects]);

  function handlePick(result: GlobalSearchResult) {
    if (result.type === 'project') onSwitchProject(result.id);
    else if (result.type === 'collection' && result.projectId) onSwitchProject(result.projectId);
    else if (result.type === 'trendPack') {
      const pack = TREND_PACK_LIST.find((p) => p.id === result.id);
      if (pack) onApplyTrendPack(pack);
    }
    setQuery('');
  }

  return (
    <div className="workbench-global-search">
      <input
        type="search"
        placeholder="🔎 Search projects, collections, motifs, trend packs, marketplaces…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Global search"
      />
      {results.length > 0 && (
        <ul className="workbench-global-search-results">
          {results.slice(0, 30).map((r) => (
            <li key={`${r.type}-${r.id}`}>
              <button type="button" onClick={() => handlePick(r)}>
                <span className="workbench-global-search-type">{TYPE_LABELS[r.type]}</span>
                <span>{r.label}</span>
                <span className="metadata-hint">{r.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && results.length === 0 && <p className="metadata-hint">No matches for "{query}".</p>}
    </div>
  );
}
