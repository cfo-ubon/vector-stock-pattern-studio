# Submission Package Builder — Build 026

`app/src/catalog/submission/submissionPackageBuilder.ts`

## What it does

`buildSubmissionPackage({ asset, files, submission, existingSubmissions })`
assembles one ready-to-upload marketplace ZIP for a single
`(PortfolioAsset, SubmissionRecord)` pair, combining:

- The asset's own verified source files, reusing
  `services/exportAsset.ts`'s `buildAssetZipEntries` — the same
  hash-integrity check every other catalog export already gets. No new
  file-serialization logic was written for this.
- `manifest.json` — marketplace id/label, asset id + `productionAssetId`,
  and the submission's own snapshot fields (title/description/keywords/
  category/status/version).
- `title.txt`, `description.txt`, `keywords.txt` — drawn from the
  submission's own snapshot fields, **never regenerated**. A
  contributor's edited title must survive into the package unchanged.
- `SHA-256SUMS.txt` — one hash line per asset file, so a contributor (or
  the marketplace) can verify nothing was altered after packaging.
- `submission-checklist.json` — `submissionValidation.ts`'s existing,
  unmodified readiness report, so any missing requirement is visible
  before upload rather than discovered as a rejection afterward.
- `duplicate-warning-report.json` — `submissionDuplicateDetection.ts`'s
  existing, unmodified result (see `docs/SUBMISSION_TRACKER.md`), so a
  conflicting prior submission is visible before upload too.

This module introduces no new scoring, SEO, or duplicate-detection logic
of its own — only assembly of what already exists elsewhere.

## Security: `sanitizeZipEntryName`

Every entry name — from the asset's stored `filename`, or from the
literal string constants this module writes — passes through
`sanitizeZipEntryName` before being added to the archive:

```ts
function sanitizeZipEntryName(name: string): string {
  const stripped = name
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..')
    .join('/');
  const withoutControlChars = stripped.replace(/[\x00-\x1f]/g, '');
  return withoutControlChars || 'unnamed-file';
}
```

This strips path separators, `..` traversal segments, and control
characters before a name is allowed into the zip — defense in depth on
top of `buildAssetZipEntries`'s own dedup logic. A stored file's
`filename` is technically attacker-reachable data (an imported file
could have been named `../../evil.txt` before it ever entered the
catalog), so this is the single point that guarantees no entry can
escape the archive root regardless of where its name came from. See
`docs/SECURITY_AND_PRIVACY.md` for the full security posture.

`sanitizeZipEntries` also de-duplicates names (appending `-2`, `-3`, ...)
so two files that sanitize to the same name never silently overwrite
each other inside the archive.

## Errors

`SubmissionPackageError` is thrown if the submission's `marketplaceId`
isn't a registered `MarketplaceProfile` — a package can't be built for an
unknown marketplace's rules.

## Filename

The built ZIP's own filename is
`${marketplaceId}-${displayName}-${assetId}-package.zip`, with both
`marketplaceId` and `displayName` passed through
`safeFilenameFragment` (non-alphanumeric → `-`, trimmed, lowercased) so
the filename itself is always filesystem-safe.
