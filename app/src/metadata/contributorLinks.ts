import type { StockSiteId } from './shutterstock';
import { MARKETPLACE_LIST } from './marketplaceProfiles';
import type { MarketplaceLinks } from '../marketplaces';

// Contributor Center — quick links straight to each stock site's own
// contributor/upload area, so the workflow after exporting a pattern is
// "click the site's button, drop the files" instead of hunting down the
// right URL every time. Derived from `marketplaceProfiles.ts`'s
// `MARKETPLACE_LIST` (itself loaded from the real editable JSON under
// `src/marketplaces/`, Section 9) rather than its own separate hardcoded
// array — one source of truth, not two that can drift.

export interface ContributorLink {
  id: StockSiteId;
  label: string;
  url: string;
  /** True for a URL that's been a stable, well-known contributor-portal
   * domain for years (Adobe Stock, Shutterstock) — false for a best-effort
   * general "become a contributor" landing page used where the exact
   * upload-dashboard URL wasn't confidently known at authoring time
   * (Freepik, Creative Fabrica, Creative Market, Etsy). Unverified entries
   * are flagged in the UI so they get checked/corrected in the marketplace's
   * own JSON file under `src/marketplaces/` — that's the single place to
   * fix any of them now. */
  verified: boolean;
}

/** Backward-compatible single-URL list (the Contributor Portal link only)
 * — every existing caller (components/StockSubmissionCenter.tsx) keeps
 * working unchanged. */
export const CONTRIBUTOR_LINKS: ContributorLink[] = MARKETPLACE_LIST.map((p) => ({
  id: p.id,
  label: `${p.label} Contributor`,
  url: p.links.portal.url,
  verified: p.links.portal.verified,
}));

/** Section 6, "Contributor Center" — the full 6-link set (Portal,
 * Submission, Analytics, Help, Guidelines, Support) per marketplace, real
 * data straight from the marketplace's own JSON profile. */
export interface MarketplaceLinkSet {
  id: StockSiteId;
  label: string;
  links: MarketplaceLinks;
}

export const MARKETPLACE_LINK_SETS: MarketplaceLinkSet[] = MARKETPLACE_LIST.map((p) => ({
  id: p.id,
  label: p.label,
  links: p.links,
}));

/** Human-readable labels for each of the 6 link types, in display order —
 * for any UI that iterates `MarketplaceLinks`' keys generically instead of
 * hand-writing 6 separate buttons per marketplace. */
export const CONTRIBUTOR_LINK_TYPES: Array<{ key: keyof MarketplaceLinks; label: string }> = [
  { key: 'portal', label: 'Contributor Portal' },
  { key: 'submission', label: 'Submission' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'help', label: 'Help' },
  { key: 'guidelines', label: 'Guidelines' },
  { key: 'support', label: 'Support' },
];
