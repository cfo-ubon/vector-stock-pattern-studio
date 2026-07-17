import { useEffect, useState } from 'react';
import { getPortfolioFile } from '../../catalog/storage/portfolioStore';

// Sprint P1, Section 9 (Thumbnail and Preview Rules): loads a stored
// file's Blob lazily (only when this hook is actually mounted — the grid
// only mounts visible cards, which is this app's existing "lazy loading"
// pattern, see `ProjectExplorer.tsx`'s pagination) and exposes it as an
// object URL. Browsers render an SVG document natively from a blob URL,
// so this same hook covers the SVG/PNG/JPG preview cases — "safely
// rendered SVG" needs no rasterization step, just `<img src={url}>`.

export function usePreviewUrl(fileId: string | null): { url: string | null; broken: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setUrl(null);
    setBroken(false);
    if (!fileId) return;

    getPortfolioFile(fileId)
      .then((record) => {
        if (cancelled) return;
        if (!record) {
          setBroken(true);
          return;
        }
        objectUrl = URL.createObjectURL(record.blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setBroken(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  return { url, broken };
}
