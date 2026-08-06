# Task 6 Report: Reduce Public-Page Bootstrap Cost

## Delivered

- Enabled Vite's production manifest (`dist/.vite/manifest.json`).
- Added a build-output contract that rejects eager Markdown or bend-simulator entry imports and requires the compact SVG favicon.
- Kept the public tools and insights routes lazy; moved the chat surface behind its existing app-level lazy boundary so its Markdown renderer is not loaded by the bootstrap entry.
- Removed broad and dependency-merging manual vendor buckets. With Vite 8/Rolldown, keeping those named buckets caused `react-markdown` to be promoted into the entry's preload graph.
- Switched customer header marks and the browser favicon to the existing 2,253-byte SVG. The PNG remains available for schema and social-preview metadata.

## TDD evidence

1. RED: `npm run build && node --test tests/public-bundle-contract.test.mjs` failed because the manifest did not exist and public HTML still referenced the PNG favicon.
2. GREEN: after enabling the manifest, lazy-loading ChatArea, and removing the dependency-merging manual vendor buckets, the bundle contract passed.

## Verification

```text
npm test                         # 302 passed
npm run lint                     # passed
npm run build                    # passed; public HTML generated
node --test tests/public-bundle-contract.test.mjs  # 2 passed
```

## Self-review

- `git diff --check` passed.
- The entry manifest imports only the runtime, icons, and React chunks; `IndustryToolsPage`, `InsightsPage`, and `ChatArea` remain dynamic imports.
- No workflow, nginx, Worker, admin, dependency, or unrelated UI changes were made.
