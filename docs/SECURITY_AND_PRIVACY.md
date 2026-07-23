# Security & Privacy — Build 026

Build 026 adds two new attacker-reachable input paths (a user-built ZIP
of submission files; a user-imported CSV of marketplace results) plus a
new local database surface. This doc states what protects each, and what
this build deliberately never stores.

## 1. ZIP path-traversal protection

`app/src/catalog/submission/submissionPackageBuilder.ts`'s
`sanitizeZipEntryName`:

```ts
export function sanitizeZipEntryName(name: string): string {
  const stripped = name
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..')
    .join('/');
  const withoutControlChars = stripped.replace(/[\x00-\x1f]/g, '');
  return withoutControlChars || 'unnamed-file';
}
```

Every entry name that goes into a built submission ZIP — whether it's
one of this module's own literal string constants (`'manifest.json'`,
etc.) or a stored file's recorded `filename` — passes through this
first. A stored `filename` is technically attacker-reachable data (an
imported file could have been named `../../evil.txt` before it ever
entered the catalog, e.g. via a crafted historical-import folder), so
this is the single point that guarantees no entry can ever escape the
archive root regardless of where its name originated. `sanitizeZipEntries`
additionally de-duplicates sanitized names so two files that sanitize to
the same string never silently overwrite one another inside the
archive.

This is defense in depth on top of `buildAssetZipEntries`'s own existing
dedup logic (reused unmodified from `services/exportAsset.ts`) — no
change was needed there.

## 2. CSV formula-injection protection

`app/src/catalog/import/marketplaceResultImport.ts`'s `sanitizeCsvCell`
(pre-existing in this codebase, reused unmodified for Build 026's bulk
import path):

```ts
export function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}
```

Any cell value beginning with `=`, `+`, `-`, `@`, a tab, or a carriage
return is prefixed with a leading `'` before being placed on a mapped
import row. This is the standard mitigation for CSV/spreadsheet formula
injection: without it, a malicious cell like `=HYPERLINK("http://evil","x")`
imported from a marketplace's own downloadable report (or a manually
edited CSV) could execute as a live formula if that data were ever
re-exported and opened in Excel/Sheets by the user or anyone they share
a file with.

## 3. No credentials, ever

Per the brief's explicit rules — **do not require marketplace API keys,
do not automate marketplace login or upload, do not store marketplace
passwords, do not scrape protected contributor dashboards** — three
things are true by construction, not just by policy:

- `MarketplaceRegistration` (`marketplaceRegistration.ts`) has exactly
  three user-facing fields: `marketplaceId`, `contributorAccountLabel`,
  `notes`. There is no password, token, session cookie, or API-key field
  anywhere on the type — verified by an explicit test in
  `marketplaceRegistration.test.ts`.
- Nothing in `submissionPackageBuilder.ts`, `historicalPortfolioImport.ts`,
  or `marketplaceResultImport.ts` makes an HTTP request, opens a browser
  tab, or touches any marketplace's real API — "marketplace" throughout
  Build 026 means a local profile of rules and a place to record what a
  human already did, never a live integration.
- No paid API is called anywhere in this build — the Commercial Feedback
  Engine, Production Recommendations, and Sales & Revenue Tracking all
  operate purely on data the user recorded or imported themselves.

## 4. No destructive silent actions

Backup restore (`productionBackup.ts`) is upsert-only — it can add or
overwrite a record by its own primary key, but the underlying
`restoreProductionBackup` function never deletes a store's existing
contents first, and refuses to write anything at all if the archive
fails validation (see `docs/BACKUP_AND_RESTORE.md`). The historical
importer never modifies or deletes anything at its source location — the
browser `File` API it reads through has no write capability by
construction, so this holds regardless of how the module is called.

## 5. Local-only data

Everything Build 026 adds — submissions, sales events, rejection
records, quality snapshots, queue items, batches, import history,
marketplace registrations — lives in the browser's own IndexedDB
(`storage/db.ts`, see `docs/DATABASE_SCHEMA.md`). None of it is
transmitted anywhere by this application. Exporting a submission package
or a backup archive is an explicit, user-initiated file download, never
an automatic upload.
