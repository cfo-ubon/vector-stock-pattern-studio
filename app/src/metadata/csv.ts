import type { SavedItem } from '../components/SavedPanel';
import { buildSiteMetadata } from './shutterstock';

// Batch-metadata CSV builders. Both Shutterstock and Adobe Stock accept a
// metadata CSV alongside a batch of uploaded files, matching rows to files
// by filename — so a whole library's worth of titles/keywords/categories
// can be attached in one go instead of copy-pasting form fields per image.
// Filenames use the .eps extension because that's the file actually
// uploaded to these two sites (converted from our SVG in Affinity with the
// same base name).

function esc(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

/** One metadata computation per item, then cheap field lookups. */
function fieldLookup(item: SavedItem): (siteId: string, label: string) => string {
  const sites = buildSiteMetadata(item.tileData);
  return (siteId, label) => sites.find((s) => s.id === siteId)?.fields.find((f) => f.label === label)?.value ?? '';
}

/** Shutterstock's official CSV template columns. The "Description" column
 * is the image's display text (Shutterstock has no separate title field). */
export function buildShutterstockCsv(items: SavedItem[], filenameFor: (item: SavedItem) => string): string {
  const rows = ['Filename,Description,Keywords,Categories,Editorial,Mature content,Illustration'];
  for (const item of items) {
    const field = fieldLookup(item);
    rows.push(
      [
        esc(filenameFor(item)),
        esc(field('shutterstock', 'Description')),
        esc(field('shutterstock', 'Keywords')),
        esc(field('shutterstock', 'Categories')),
        'no',
        'no',
        'no',
      ].join(','),
    );
  }
  return rows.join('\r\n');
}

/** Adobe Stock CSV columns. Category is Adobe's numeric id — vector
 * patterns belong to Graphic Resources (8). */
export function buildAdobeStockCsv(items: SavedItem[], filenameFor: (item: SavedItem) => string): string {
  const rows = ['Filename,Title,Keywords,Category,Releases'];
  for (const item of items) {
    const field = fieldLookup(item);
    rows.push(
      [esc(filenameFor(item)), esc(field('adobestock', 'Title')), esc(field('adobestock', 'Keywords')), '8', ''].join(','),
    );
  }
  return rows.join('\r\n');
}
