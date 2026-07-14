import { useEffect, useMemo, useState } from 'react';
import type { Project } from '../../project/projectTypes';
import { extractAssetsFromCollection } from '../../assets/extraction';
import { deriveAssetRelationships, relationshipsForAsset } from '../../assets/relationships';
import { applyVariant } from '../../assets/variants';
import { searchAssets } from '../../assets/search';
import { recommendCompatibleAssets } from '../../assets/recommendation';
import { evaluateAssetQuality } from '../../assets/qualityScore';
import { loadAssetFavorites, saveAssetFavorites, toggleFavoriteAsset } from '../../assets/library';
import { loadAssets, bulkPutAssets } from '../../storage/assetStore';
import { ASSET_VARIANT_TYPES, type Asset, type AssetKind, type AssetLibraryFavorites, type AssetVariantType } from '../../assets/types';

// Asset Ecosystem Engine (Phase 9) — the UI surface for `assets/*`. This
// component contains no extraction/scoring/relationship logic of its
// own: every asset, score, and relationship below comes straight from a
// real `assets/*` module call. "Extract Assets" only ever reads the
// active Project's most recently generated collection (never generates
// artwork itself) and persists the real extracted `Asset` records to the
// IndexedDB Asset Library (`storage/assetStore.ts`) so they survive
// across sessions and future collections.

const KIND_LABELS: Record<AssetKind, string> = {
  heroMotif: '⭐ Hero Motif', leaf: '🍃 Leaf', flower: '🌸 Flower', branch: '🌿 Branch', texture: '🧵 Texture',
  border: '➖ Border', frame: '🖼 Frame', icon: '🔖 Icon', decorativeShape: '✨ Decorative Shape',
};

function scoreClass(value: number): string {
  if (value >= 80) return 'workbench-score--good';
  if (value >= 60) return 'workbench-score--ok';
  return 'workbench-score--low';
}

interface Props {
  activeProject: Project | null;
}

export function AssetLibraryPanel({ activeProject }: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [favorites, setFavorites] = useState<AssetLibraryFavorites>(() => loadAssetFavorites());
  const [extracting, setExtracting] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [kindFilter, setKindFilter] = useState<AssetKind | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    loadAssets().then(setAssets);
  }, []);

  const latestCollection = activeProject && activeProject.collections.length > 0 ? activeProject.collections[0].collection : null;

  function handleExtract() {
    if (!latestCollection) return;
    setExtracting(true);
    setTimeout(() => {
      const extracted = extractAssetsFromCollection(latestCollection);
      setAssets((prev) => {
        const byId = new Map(prev.map((a) => [a.metadata.id, a]));
        for (const asset of extracted) byId.set(asset.metadata.id, asset);
        return [...byId.values()];
      });
      bulkPutAssets(extracted);
      setExtracting(false);
    }, 0);
  }

  const filtered = useMemo(
    () => searchAssets(assets, { keyword: keyword || undefined, kind: kindFilter || undefined }),
    [assets, keyword, kindFilter],
  );

  const relationships = useMemo(() => deriveAssetRelationships(assets), [assets]);
  const selected = assets.find((a) => a.metadata.id === selectedId) ?? null;
  const selectedQuality = selected ? evaluateAssetQuality(selected) : null;
  const selectedRelationships = selected ? relationshipsForAsset(relationships, selected.metadata.id) : [];
  const selectedRecommendations = selected ? recommendCompatibleAssets(selected, assets, 6) : [];

  function updateFavorites(next: AssetLibraryFavorites) {
    setFavorites(next);
    saveAssetFavorites(next);
  }

  function handleApplyVariant(type: AssetVariantType) {
    if (!selected) return;
    const variant = applyVariant(selected, type);
    setAssets((prev) => [variant, ...prev]);
    bulkPutAssets([variant]);
    setSelectedId(variant.metadata.id);
  }

  return (
    <div className="workbench-asset-library-panel">
      <p className="metadata-hint">
        Extracts real, editable vector assets (hero motifs, leaves, flowers, branches, borders, frames, textures, icons, decorative shapes) from a generated Collection into a persistent, cross-project
        Asset Library.
      </p>

      <div className="trend-studio-actions">
        <button type="button" className="btn btn--primary" onClick={handleExtract} disabled={!latestCollection || extracting}>
          {extracting ? '⏳ Extracting…' : '🗃 Extract Assets from Latest Collection'}
        </button>
      </div>
      {!latestCollection && <p className="metadata-hint">Generate a Collection into this Project first.</p>}

      <div className="workbench-evolution-config">
        <label>
          Search
          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="name, category, pattern type…" />
        </label>
        <label>
          Kind
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as AssetKind | '')}>
            <option value="">All kinds</option>
            {Object.entries(KIND_LABELS).map(([kind, label]) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="metadata-hint">
        {filtered.length} of {assets.length} asset(s) in the library.
      </p>

      <ul className="workbench-asset-list">
        {filtered.map((asset) => (
          <li key={asset.metadata.id} className={`workbench-asset-row${asset.metadata.id === selectedId ? ' workbench-asset-row--active' : ''}`}>
            <button type="button" className="workbench-asset-row-button" onClick={() => setSelectedId(asset.metadata.id)}>
              {KIND_LABELS[asset.metadata.kind]} — {asset.metadata.name}
            </button>
            <button
              type="button"
              className={`workbench-panel-chip${favorites.assetIds.includes(asset.metadata.id) ? '' : ' workbench-panel-chip--hidden'}`}
              title={favorites.assetIds.includes(asset.metadata.id) ? 'Unfavorite' : 'Favorite'}
              onClick={() => updateFavorites(toggleFavoriteAsset(favorites, asset.metadata.id))}
            >
              ★
            </button>
          </li>
        ))}
      </ul>

      {selected && selectedQuality && (
        <details open className="workbench-collapsible">
          <summary>
            🔍 {selected.metadata.name} — {selectedQuality.overall}/100
          </summary>
          <div className="workbench-quality-scores">
            {(
              [
                ['reusability', 'Reusability'],
                ['complexity', 'Complexity'],
                ['commercialUsefulness', 'Commercial Usefulness'],
                ['compatibility', 'Compatibility'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className={`workbench-quality-score ${scoreClass(selectedQuality[key])}`}>
                <span>{label}</span>
                <strong>{selectedQuality[key]}</strong>
              </div>
            ))}
          </div>
          <p className="metadata-hint">
            Family: {selected.metadata.family} · Category: {selected.metadata.categoryId} · Version: {selected.metadata.version}
            {selected.metadata.styleDnaId ? ` · Style DNA: ${selected.metadata.styleDnaId}` : ''}
          </p>

          <details className="workbench-collapsible">
            <summary>🎨 Variants</summary>
            <div className="workbench-evolution-timeline">
              {ASSET_VARIANT_TYPES.map((type) => (
                <button key={type} type="button" className="workbench-evolution-generation-chip" onClick={() => handleApplyVariant(type)}>
                  {type}
                </button>
              ))}
            </div>
          </details>

          <details className="workbench-collapsible">
            <summary>🔗 Relationships ({selectedRelationships.length})</summary>
            {selectedRelationships.length === 0 && <p className="metadata-hint">No derived relationships for this asset yet.</p>}
            <ul className="workbench-diff-list">
              {selectedRelationships.map((rel, i) => (
                <li key={i} className="workbench-diff-entry">
                  {rel.type}: {rel.fromAssetId === selected.metadata.id ? rel.toAssetId : rel.fromAssetId} — {rel.note}
                </li>
              ))}
            </ul>
          </details>

          <details className="workbench-collapsible">
            <summary>💡 Recommended pairings ({selectedRecommendations.length})</summary>
            {selectedRecommendations.length === 0 && <p className="metadata-hint">No strong matches found in the current library.</p>}
            <ul className="workbench-diff-list">
              {selectedRecommendations.map((rec) => (
                <li key={rec.metadata.id} className="workbench-diff-entry">
                  {KIND_LABELS[rec.metadata.kind]} — {rec.metadata.name}
                </li>
              ))}
            </ul>
          </details>
        </details>
      )}
    </div>
  );
}
