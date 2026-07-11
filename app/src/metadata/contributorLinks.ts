import type { StockSiteId } from './shutterstock';

// Contributor Portal — quick links straight to each stock site's own
// contributor/upload area, so the workflow after exporting a pattern is
// "click the site's button, drop the files" instead of hunting down the
// right URL every time. One config file, easy to extend: adding a future
// site is one new object here, nothing else in the UI needs to change.

export interface ContributorLink {
  id: StockSiteId;
  label: string;
  url: string;
  /** True for a URL that's been a stable, well-known contributor-portal
   * domain for years (Adobe Stock, Shutterstock) — false for a best-effort
   * general "become a contributor" landing page used where the exact
   * upload-dashboard URL wasn't confidently known at authoring time
   * (Freepik, Creative Fabrica, Creative Market). Unverified entries are
   * flagged in the UI so they get checked/corrected here — this is the
   * single place to fix any of them. */
  verified: boolean;
}

export const CONTRIBUTOR_LINKS: ContributorLink[] = [
  { id: 'adobestock', label: 'Adobe Stock Contributor', url: 'https://contributor.stock.adobe.com/', verified: true },
  { id: 'shutterstock', label: 'Shutterstock Contributor', url: 'https://submit.shutterstock.com/', verified: true },
  { id: 'freepik', label: 'Freepik Contributor', url: 'https://www.freepik.com/contributor', verified: false },
  { id: 'creativefabrica', label: 'Creative Fabrica Contributor', url: 'https://www.creativefabrica.com/sell-on-creative-fabrica/', verified: false },
  { id: 'creativemarket', label: 'Creative Market Contributor', url: 'https://creativemarket.com/sell', verified: false },
];
