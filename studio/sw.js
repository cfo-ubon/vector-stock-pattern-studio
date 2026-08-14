// AI-SBOS Multi-Version Release, Part 12 (Service Worker Isolation).
//
// Two jobs, both scoped ONLY to this exact path (/studio/), never to
// /studio/v1/ or /studio/v2/ — those have their own, fully independent
// Workbox service workers with their own scopes and cache names.
//
// 1. Offline support for the Version Selector itself (Part 11/16 — the
//    Selector must work offline too): a tiny, hand-written, single-file
//    precache. Deliberately NOT Workbox-generated, so its behavior here
//    is fully auditable in one file instead of a bundled/minified one.
//
// 2. Safe migration for any returning visitor whose browser still has the
//    OLD, pre-multi-version root-scoped Workbox service worker installed
//    (it used to serve the whole v2 app directly from /studio/, before
//    that app moved to /studio/v2/). Browsers automatically re-fetch and
//    byte-compare a scope's sw.js on navigation, so this new file
//    replacing the old one is enough to trigger an update check — the
//    `activate` handler below then removes ONLY that old SW's own
//    precache/runtime caches (derived from `self.registration.scope`,
//    which for this SW is always exactly ".../studio/" — never a
//    substring match against ".../studio/v1/" or ".../studio/v2/", so
//    this can never touch v1's or v2's caches).
const SELECTOR_CACHE = 'aisbos-selector-v1';
const SELECTOR_URL = self.registration.scope; // e.g. https://.../studio/

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SELECTOR_CACHE);
      await cache.add(SELECTOR_URL);
      self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Remove any pre-existing cache whose name embeds this exact scope
      // (the old root Workbox SW's own precache/runtime caches) but is
      // not this SW's own current cache and does not belong to a v1/v2
      // sub-scope.
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name !== SELECTOR_CACHE)
          .filter((name) => name.includes(SELECTOR_URL))
          .filter((name) => !name.includes(`${SELECTOR_URL}v1/`) && !name.includes(`${SELECTOR_URL}v2/`))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only ever respond for exactly this Selector's own path — anything
  // under /studio/v1/ or /studio/v2/ (or anywhere else) is left
  // completely untouched, so those apps' own service workers (or the
  // network) handle it normally. This is the one rule that keeps this
  // SW's scope from ever shadowing v1's or v2's navigation.
  if (url.pathname !== new URL(SELECTOR_URL).pathname && url.pathname !== `${new URL(SELECTOR_URL).pathname}index.html`) {
    return;
  }
  event.respondWith(
    (async () => {
      const cache = await caches.open(SELECTOR_CACHE);
      const cached = await cache.match(SELECTOR_URL);
      try {
        const fresh = await fetch(event.request);
        cache.put(SELECTOR_URL, fresh.clone());
        return fresh;
      } catch {
        return cached || Response.error();
      }
    })(),
  );
});
