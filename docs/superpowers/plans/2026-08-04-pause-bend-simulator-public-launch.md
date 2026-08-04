# Pause Bend Simulator Public Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the paused bend simulator from customer-facing discovery surfaces while preserving its direct route, and replace its bilingual homepage card with the existing laser cutting speed reference.

**Architecture:** Keep `industryTools` as the complete route registry and export a filtered `publicIndustryTools` list for public discovery surfaces. Continue resolving the bend simulator direct route from the complete registry, but mark it `noindex`; update only the existing homepage card data for the replacement.

**Tech Stack:** React 19, Vite, Node.js built-in test runner, ESLint

## Global Constraints

- Preserve all bend simulator implementation code, tests, and branches.
- Do not modify Worker, database, deployment, or Cloudflare configuration.
- Reuse the existing `laser-cutting-speed-reference` tool; do not create a new calculator.
- Keep the existing homepage 4/2/1 responsive layout and SAGEMRO visual system.
- Update English and Chinese together.

---

### Task 1: Define and enforce the paused tool visibility boundary

**Files:**
- Modify: `frontend/tests/industry-tools-calculations.test.mjs`
- Modify: `frontend/tests/brand-assets-contract.test.mjs`
- Modify: `frontend/tests/seo-contract.test.mjs`
- Modify: `frontend/src/data/industryTools.js`
- Modify: `frontend/src/components/Tools/IndustryToolsPage.jsx`
- Modify: `frontend/src/components/Tools/IndustryToolsModal.jsx`

**Interfaces:**
- Consumes: the existing complete `industryTools` registry and `getToolBySlug(slug)` route lookup.
- Produces: `publicIndustryTools`, an array containing every public tool except the item whose `id` is `bend-simulator`.

- [ ] **Step 1: Write failing public-visibility tests**

Update the calculation test import to include `publicIndustryTools`, then assert the full registry still contains ten tools while the public registry contains nine and excludes the bend simulator:

```js
assert.equal(industryTools.length, 10);
assert.equal(publicIndustryTools.length, 9);
assert.equal(publicIndustryTools.some((tool) => tool.id === 'bend-simulator'), false);
assert.equal(getToolBySlug('bend-simulator').id, 'bend-simulator');
```

Add source-contract assertions in the brand and SEO contract tests that `IndustryToolsPage.jsx` and `IndustryToolsModal.jsx` consume `publicIndustryTools`, and that the page applies `noindex,nofollow,noarchive` to the paused bend simulator route.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
cd frontend
node --test tests/industry-tools-calculations.test.mjs tests/brand-assets-contract.test.mjs
```

Expected: FAIL because `publicIndustryTools` does not exist and public components still consume `industryTools`.

- [ ] **Step 3: Implement the minimal visibility boundary**

After the complete `industryTools` array, export the filtered public registry:

```js
export const publicIndustryTools = industryTools.filter((tool) => tool.id !== 'bend-simulator');
```

Import and use `publicIndustryTools` in the tools hub, tools modal, and related-tools list. Keep `industryTools` only where the complete registry is required. In `IndustryToolsPage`, identify the paused route and include it in the existing robots exclusion:

```js
const isPausedTool = selectedTool?.id === 'bend-simulator';
robots: isMissing || isPausedTool ? 'noindex,nofollow,noarchive' : 'index,follow',
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
cd frontend
node --test tests/industry-tools-calculations.test.mjs tests/brand-assets-contract.test.mjs
```

Expected: PASS with zero failures.

- [ ] **Step 5: Commit the visibility boundary**

```bash
git add frontend/tests/industry-tools-calculations.test.mjs frontend/tests/brand-assets-contract.test.mjs frontend/src/data/industryTools.js frontend/src/components/Tools/IndustryToolsPage.jsx frontend/src/components/Tools/IndustryToolsModal.jsx
git commit -m "fix(tools): pause bend simulator public discovery"
```

### Task 2: Replace the bilingual homepage card

**Files:**
- Modify: `frontend/tests/brand-assets-contract.test.mjs`
- Modify: `frontend/src/components/Chat/WelcomePage.jsx`

**Interfaces:**
- Consumes: the existing `/tools/laser-cutting-speed-reference` public route.
- Produces: one English and one Chinese homepage resource card linking to that route.

- [ ] **Step 1: Write the failing homepage contract**

Replace the homepage bend-link assertion with these requirements:

```js
assert.doesNotMatch(welcome, /href: '\/tools\/bend-simulator'/);
assert.match(welcome, /href: '\/tools\/laser-cutting-speed-reference'/);
assert.match(welcome, /label: 'Laser Cutting Speed'/);
assert.match(welcome, /label: '激光切割速度参考'/);
```

Keep the existing assertions for the other three links and the absence of Insights.

- [ ] **Step 2: Run the homepage contract and verify RED**

Run:

```bash
cd frontend
node --test tests/brand-assets-contract.test.mjs
```

Expected: FAIL because the homepage still links to the bend simulator.

- [ ] **Step 3: Replace only the first bilingual card**

Use the following English card:

```js
{ icon: Calculator, label: 'Laser Cutting Speed', desc: 'Compare planning speed ranges by material, thickness, gas, and laser power', href: '/tools/laser-cutting-speed-reference' }
```

Use the following Chinese card:

```js
{ icon: Calculator, label: '激光切割速度参考', desc: '按材料、厚度、辅助气体和激光功率对比切割速度范围', href: '/tools/laser-cutting-speed-reference' }
```

Do not change the remaining three cards or the existing grid classes.

- [ ] **Step 4: Run the homepage contract and verify GREEN**

Run:

```bash
cd frontend
node --test tests/brand-assets-contract.test.mjs
```

Expected: PASS with zero failures.

- [ ] **Step 5: Run the complete frontend verification**

Run:

```bash
cd frontend
npm test
npm run lint
npm run build
```

Expected: all tests pass, ESLint reports zero errors, and Vite completes the production build.

- [ ] **Step 6: Commit the homepage replacement and design documents**

```bash
git add frontend/tests/brand-assets-contract.test.mjs frontend/src/components/Chat/WelcomePage.jsx docs/superpowers/specs/2026-08-04-pause-bend-simulator-public-launch-design.md docs/superpowers/plans/2026-08-04-pause-bend-simulator-public-launch.md
git commit -m "feat(frontend): replace paused bend homepage tool"
```
