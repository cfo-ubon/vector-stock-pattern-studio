import type { Collection } from '../../catalog/domain/collection';
import { useCollectionCoverUrl } from './useCollectionCoverUrl';

interface Props {
  collection: Collection;
  assetCount: number;
  hasIntegrityIssue: boolean;
  selected: boolean;
  onSelect: (collectionId: string) => void;
}

/** Portfolio Manager P2 Stage 2, Section 4 — one card in the Collection
 * list grid. Every number shown (`assetCount`) comes from the real,
 * currently-loaded asset list (counted by the caller) — never a
 * hard-coded or cached figure, matching Section 4's "no fake statistics"
 * requirement and P1's own dashboard convention. */
export function CollectionCard({ collection, assetCount, hasIntegrityIssue, selected, onSelect }: Props) {
  const { url, broken } = useCollectionCoverUrl(collection.coverAssetId);
  const showPlaceholder = !url || broken;

  return (
    <button
      type="button"
      className={`portfolio-thumb collection-card${selected ? ' portfolio-thumb--selected' : ''}`}
      onClick={() => onSelect(collection.id)}
      aria-pressed={selected}
    >
      <div className="portfolio-thumb-preview">
        {!showPlaceholder && url ? (
          <img src={url} alt="" loading="lazy" />
        ) : (
          <div className="portfolio-thumb-placeholder" aria-hidden="true">
            📁
          </div>
        )}
      </div>
      <div className="portfolio-thumb-meta">
        <div className="portfolio-thumb-name" title={collection.name}>
          {collection.name}
        </div>
        <div className="collection-card-count">{assetCount} ชิ้นงาน</div>
        <div className="portfolio-thumb-badges">
          {collection.isArchived && <span className="portfolio-badge portfolio-badge--archived">เก็บถาวร</span>}
          {hasIntegrityIssue && (
            <span className="portfolio-badge portfolio-badge--warning" title="พบปัญหาความถูกต้องของข้อมูล">
              ⚠ ตรวจสอบข้อมูล
            </span>
          )}
        </div>
        <div className="portfolio-thumb-date">อัปเดตล่าสุด {new Date(collection.updatedAt).toLocaleDateString('th-TH')}</div>
      </div>
    </button>
  );
}
