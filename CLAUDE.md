# Repo guide for Claude

## Layout
- `/index.html`, `/js`, `/css` — original vanilla-JS static site (independent; do not break)
- `/app` — React + TypeScript + Vite pattern generator (main app)
- `/studio` — committed production build of `/app`, served by GitHub Pages at
  https://cfo-ubon.github.io/vector-stock-pattern-studio/studio/
- `/docs/USER_GUIDE.md` — Thai user guide for the app

## Rules for every change to /app (required, user-requested)
1. **Update `/docs/USER_GUIDE.md`** — reflect any new/changed feature in the
   relevant section AND add an entry to the "บันทึกการอัปเดต" (changelog)
   section at the bottom, in Thai, with a version bump.
2. **Rebuild the published site**: run `npm run build` inside `/app`
   (outputs to `/studio` with the correct GitHub Pages base path) and commit
   the updated `/studio` together with the source changes.
3. Verify with `npm run lint` and a browser check before pushing.

GitHub Pages deploys the `main` branch as static files (no build step), so
`/studio` must always be the current build.
