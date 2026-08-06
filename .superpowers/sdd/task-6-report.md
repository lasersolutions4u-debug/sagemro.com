# Task 6 Report: Reduce Public-Page Bootstrap Cost

## Delivered

- Enabled Vite's production manifest (`dist/.vite/manifest.json`).
- Added a build-output contract that rejects eager Markdown or bend-simulator entry imports and requires the compact SVG favicon.
- Kept the public tools and insights routes lazy; moved the chat surface behind its existing app-level lazy boundary so its Markdown renderer is not loaded by the bootstrap entry.
- Removed the broad `vendor-misc` bucket while retaining targeted Vite 8/Rolldown vendor boundaries with entry-aware grouping.
- Switched customer header marks and the browser favicon to the existing 2,253-byte SVG. The PNG remains available for schema and social-preview metadata.

## TDD evidence

1. RED: `npm run build && node --test tests/public-bundle-contract.test.mjs` failed because the manifest did not exist and public HTML still referenced the PNG favicon.
2. GREEN: after enabling the manifest, lazy-loading ChatArea, and restoring targeted entry-aware vendor boundaries, the bundle contract passed.

## Follow-up review correction

The original bundle assertion only looked for hashed output filename substrings, so it could pass after Markdown had been merged into the lazy ChatArea chunk. The corrected contract now follows manifest source-entry keys:

- `index.html` lists `ChatArea`, `IndustryToolsPage`, and `InsightsPage` as dynamic imports and excludes all three from its transitive static-import closure.
- Any manifest source entries matching the paused bend-simulator name are excluded from that closure.
- `vendor-markdown` must exist, be unreachable from `index.html`, and be reachable only from `src/components/Chat/ChatArea.jsx`.

The original manual `vendor-react`, `vendor-motion`, `vendor-icons`, and `vendor-markdown` boundaries are restored with Vite 8/Rolldown's `codeSplitting.groups`. The broad `vendor-misc` bucket remains removed. A first restore attempt used `includeDependenciesRecursively: false` alone and failed the corrected contract: `index.html` statically reached both `ChatArea` and `vendor-markdown` through shared vendor chunks. Adding `entriesAware: true` to each targeted group changed the manifest as follows:

```text
Before: index.html static closure included ChatArea and vendor-markdown.
After:  index.html imports runtime, index-specific motion/icons/react groups, API,
        feedback, and locale; ChatArea is dynamic and imports vendor-markdown~ChatArea.
```

The final correction creates `BendSimulatorPage` as a dynamic source entry from `IndustryToolsPage`. The direct paused route still renders the same component and remains noindex; it is no longer bundled into the general tools-page chunk.

## Verification

```text
npm test                         # 303 passed
npm run lint                     # passed
npm run build                    # passed; public HTML generated
node --test tests/public-bundle-contract.test.mjs  # 3 passed
```

Final review evidence: the strengthened contract first failed because `BendSimulatorPage` was not a manifest dynamic entry. After making that route component lazy, the build emitted `BendSimulatorPage-D3qN0cCN.js`, all three bundle-contract checks passed, and the focused bend/tool routing tests passed before the full suite.

## Self-review

- `git diff --check` passed.
- The entry static closure contains the runtime, entry-specific motion/icons/react groups, API, feedback, and locale. It excludes `IndustryToolsPage`, `InsightsPage`, `ChatArea`, `BendSimulatorPage`, and every Markdown boundary.
- No workflow, nginx, Worker, admin, dependency, or unrelated UI changes were made.
