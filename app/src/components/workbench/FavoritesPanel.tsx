import { TREND_PACK_LIST } from '../../trend/trendPacks';
import { listStyleDna } from '../../services/styleDnaService';
import { listPalettes } from '../../services/colorRoleService';
import { listMarketplaces } from '../../services/marketplaceService';
import type { WorkbenchFavorites, WorkbenchMotifCollection } from '../../workbench/workbenchFavorites';
import type { DesignSpecification } from '../../trend/designSpecTypes';

// Design Workbench Section 8 ("Favorites") — star toggles for the 4 id-
// keyed kinds, plus the Motif Collection list (built via "Save current
// motifs as a collection" in the toolbar and applied back with one click).

interface Props {
  favorites: WorkbenchFavorites;
  onToggleTrendPack: (id: string) => void;
  onToggleStyleDna: (id: string) => void;
  onTogglePalette: (id: string) => void;
  onToggleMarketplace: (id: string) => void;
  onApplyMotifCollection: (collection: WorkbenchMotifCollection) => void;
  onRemoveMotifCollection: (id: string) => void;
  onSaveCurrentMotifsAsCollection: () => void;
  spec: DesignSpecification | null;
}

function StarButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className={`workbench-star${active ? ' active' : ''}`} onClick={onClick} aria-pressed={active} aria-label={label}>
      {active ? '★' : '☆'}
    </button>
  );
}

export function FavoritesPanel({
  favorites,
  onToggleTrendPack,
  onToggleStyleDna,
  onTogglePalette,
  onToggleMarketplace,
  onApplyMotifCollection,
  onRemoveMotifCollection,
  onSaveCurrentMotifsAsCollection,
  spec,
}: Props) {
  return (
    <div className="workbench-favorites-panel">
      <details open>
        <summary>Trend Packs</summary>
        <ul className="workbench-favorites-list">
          {TREND_PACK_LIST.map((p) => (
            <li key={p.id}>
              <StarButton active={favorites.trendPackIds.includes(p.id)} onClick={() => onToggleTrendPack(p.id)} label={`Favorite ${p.label}`} />
              {p.label}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>Style DNA</summary>
        <ul className="workbench-favorites-list">
          {listStyleDna().map((s) => (
            <li key={s.id}>
              <StarButton active={favorites.styleDnaIds.includes(s.id)} onClick={() => onToggleStyleDna(s.id)} label={`Favorite ${s.label}`} />
              {s.label}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>Palettes</summary>
        <ul className="workbench-favorites-list">
          {listPalettes().map((p) => (
            <li key={p.id}>
              <StarButton active={favorites.paletteIds.includes(p.id)} onClick={() => onTogglePalette(p.id)} label={`Favorite ${p.label}`} />
              {p.label}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>Marketplace Profiles</summary>
        <ul className="workbench-favorites-list">
          {listMarketplaces().map((m) => (
            <li key={m.id}>
              <StarButton active={favorites.marketplaceIds.includes(m.id)} onClick={() => onToggleMarketplace(m.id)} label={`Favorite ${m.label}`} />
              {m.label}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>Motif Collections</summary>
        <button type="button" className="btn" onClick={onSaveCurrentMotifsAsCollection} disabled={!spec}>
          💾 Save current motifs as collection
        </button>
        <ul className="workbench-favorites-list">
          {favorites.motifCollections.length === 0 && <li className="metadata-hint">No saved motif collections yet.</li>}
          {favorites.motifCollections.map((c) => (
            <li key={c.id}>
              <span>{c.name}</span>
              <span className="workbench-snapshot-actions">
                <button type="button" className="btn" onClick={() => onApplyMotifCollection(c)}>
                  Apply
                </button>
                <button type="button" className="btn" onClick={() => onRemoveMotifCollection(c.id)}>
                  🗑
                </button>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
