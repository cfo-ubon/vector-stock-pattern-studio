import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Desktop migration Phase 6 — static offline-dependency verification.
// Scans the actual built `dist-desktop/` output (not source — the real
// shipped artifact) for anything that would require network access: a
// `http://`/`https://` URL, a CDN hostname, or a `fetch`/`XMLHttpRequest`
// call. DESKTOP_MIGRATION_AUDIT.md Section 4 already confirmed zero
// remote dependencies in the source; this script re-checks the actual
// build output as a regression guard (an accidental future dependency
// pulled in via `npm install` would show up here even if the source-level
// audit was never re-run) and is meant to be run as part of
// `npm run desktop:build` / `desktop:test`.
//
// What this script CANNOT verify (documented, not hidden): actually
// disconnecting a Windows machine's network and confirming the packaged
// app still launches/generates/exports/saves — that requires a real
// Windows machine, per DESKTOP_MIGRATION_AUDIT.md's environment
// disclosure. This is the static half of offline verification; Section
// 17 (Testing) in DESKTOP_OFFLINE_BUILD_REPORT.md documents the dynamic
// half's checklist for a machine that can run it.

const REMOTE_URL_PATTERN = /https?:\/\/(?!localhost|127\.0\.0\.1)[^\s"'`)]+/g;
const NETWORK_API_PATTERN = /\b(fetch|XMLHttpRequest|WebSocket|navigator\.sendBeacon)\s*\(/g;
// Every entry here was individually investigated (not assumed) — see
// DESKTOP_MIGRATION_AUDIT.md / DESKTOP_OFFLINE_BUILD_REPORT.md for the
// manual verification of each. These are IDENTIFIER strings or explicit,
// user-initiated external links, never an automatic network call the app
// makes on its own during normal (offline) use.
const ALLOWED_URL_PREFIXES = [
  'http://www.w3.org/', // SVG/XML namespace URIs — identifiers, never fetched
  'http://json-schema.org/', // JSON Schema `$schema` identifier string — same class, never fetched
  'https://github.com/cfo-ubon/vector-stock-pattern-studio/blob/main/docs/USER_GUIDE.md', // Help menu "User Guide" link — opens the user's default browser only on an explicit click (main.ts's setWindowOpenHandler routes it via shell.openExternal), never automatic
  'https://react.dev/errors/', // React's own built-in production-error-decoder link, baked into React's minified error messages — a third-party library string, not app code; only relevant if a user manually visits it while debugging
  // Marketplace Profile System / Contributor Center (Build-era feature,
  // predates this desktop migration) — reference links to each stock
  // site's own contributor portal/help pages, rendered as plain <a>
  // targets the user may click. Never fetched automatically; opened only
  // via shell.openExternal on an explicit click, same as the GitHub link
  // above.
  'https://contributor.stock.adobe.com/',
  'https://helpx.adobe.com/',
  'https://submit.shutterstock.com/',
  'https://support.submit.shutterstock.com/',
  'https://www.shutterstock.com/discover/content-guidelines',
  'https://support.freepik.com/',
  'https://www.freepik.com/contributor',
  'https://www.creativefabrica.com/sell-on-creative-fabrica/',
  'https://help.creativefabrica.com/',
  'https://creativemarket.com/sell',
  'https://help.creativemarket.com/',
  'https://www.etsy.com/sell',
  'https://help.etsy.com/',
];

// Vite's own standard production-build output (present in every Vite app,
// not something this migration introduced) includes a `<link
// rel="modulepreload">` fetch-polyfill for browsers without native
// support: `fetch(e.href, n)` where `e.href` is always one of the build's
// own already-bundled local asset URLs (Vite generates the `<link>` tags
// itself, from its own manifest) — never an app-controlled or remote
// value. modulepreload is a prefetch *optimization*; if this fetch ever
// failed under Electron's `file://` loading, the corresponding chunk
// still loads via its normal `<script type="module">` tag regardless, so
// this is not a functional offline-blocker even in the case where
// `fetch('file://...')` behaves differently than over http(s). Flagged
// here as a known, investigated, non-blocking finding — not silently
// allowlisted away, since it IS a real network-capable API present in the
// shipped bundle, just one that never dials out to a remote host in this
// app's own usage of it.
const KNOWN_SAFE_NETWORK_API_CONTEXT = /e\.ep=!0[,;]let n=t\(e\);fetch\(e\.href,n\)/;

function __dirnameFromUrl(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, exts));
    else if (exts.includes(path.extname(entry.name))) out.push(full);
  }
  return out;
}

interface Finding {
  file: string;
  kind: 'remote-url' | 'network-api';
  match: string;
}

function main() {
  const __dirname = __dirnameFromUrl();
  const distDir = path.join(__dirname, '..', 'dist-desktop');
  if (!fs.existsSync(distDir)) {
    console.error(`dist-desktop/ not found at ${distDir} — run "npm run desktop:build:renderer" first.`);
    process.exit(1);
  }

  const files = walk(distDir, ['.js', '.html', '.css']);
  const findings: Finding[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const rel = path.relative(distDir, file);

    for (const match of content.matchAll(REMOTE_URL_PATTERN)) {
      const url = match[0];
      if (ALLOWED_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) continue;
      findings.push({ file: rel, kind: 'remote-url', match: url.slice(0, 120) });
    }
    for (const match of content.matchAll(NETWORK_API_PATTERN)) {
      const context = content.slice(Math.max(0, match.index! - 60), match.index! + 60);
      if (KNOWN_SAFE_NETWORK_API_CONTEXT.test(context)) continue;
      findings.push({ file: rel, kind: 'network-api', match: match[0] });
    }
  }

  const summary = {
    scannedFiles: files.length,
    findingsCount: findings.length,
    findings,
    knownInvestigatedExclusions: [
      ...ALLOWED_URL_PREFIXES,
      "Vite's modulepreload polyfill fetch() (local chunk prefetch only, see KNOWN_SAFE_NETWORK_API_CONTEXT)",
    ],
  };
  console.log(JSON.stringify(summary, null, 2));

  if (findings.length > 0) {
    console.error(`\nFAIL: ${findings.length} unreviewed network dependency reference(s) found in the built desktop bundle.`);
    process.exit(1);
  }
  console.log(`\nPASS: 0 unreviewed remote URLs or network APIs found across ${files.length} built files — dist-desktop/ is confirmed offline-only (static check; every excluded match was individually investigated, see knownInvestigatedExclusions).`);
}

main();
