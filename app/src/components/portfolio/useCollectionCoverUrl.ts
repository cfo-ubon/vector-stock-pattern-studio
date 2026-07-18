import { useEffect, useState } from 'react';
import { getPortfolioAsset, getPortfolioFile } from '../../catalog/storage/portfolioStore';

/** Portfolio Manager P2 Stage 2 — resolves a collection's `coverAssetId`
 * (an *asset* id, not a file id) to a renderable Blob URL, following the
 * same lazy-load-with-cleanup shape as `usePreviewUrl.ts` (Section 22:
 * "reuse the existing Blob URL lifecycle pattern"). A cover asset that no
 * longer exists (Rule 13 staleness — the asset was deleted after being
 * set as cover) or has no preview file resolves to `broken: true` so the
 * caller shows a safe fallback instead of a broken `<img>` or a console
 * error — never throws. */
export function useCollectionCoverUrl(coverAssetId: string | null): { url: string | null; broken: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setUrl(null);
    setBroken(false);
    if (!coverAssetId) return;

    getPortfolioAsset(coverAssetId)
      .then(async (asset) => {
        if (cancelled) return;
        if (!asset || !asset.previewReference) {
          setBroken(true);
          return;
        }
        const file = await getPortfolioFile(asset.previewReference);
        if (cancelled) return;
        if (!file) {
          setBroken(true);
          return;
        }
        objectUrl = URL.createObjectURL(file.blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setBroken(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [coverAssetId]);

  return { url, broken };
}
