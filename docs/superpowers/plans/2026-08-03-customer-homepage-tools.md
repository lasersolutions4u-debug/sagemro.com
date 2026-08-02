# Customer Homepage Public Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the customer homepage's mixed public-resource links with four responsive tool entries, led by the bend simulator and without an Insights entry.

**Architecture:** Keep the existing `WelcomePage` data-driven resource array and existing card markup. Change only the homepage copy/data and responsive grid classes; route links point to the already registered public industry-tool slugs. Extend the existing static contract test so the intended four links and the absence of the homepage Insights link are verified without changing the Insights route or tool-center pages.

**Tech Stack:** React, JSX, Tailwind utility classes, Node.js built-in test runner, ESLint, Vite.

## Global Constraints

- Desktop shows four cards in one row; tablet shows two columns; mobile shows one column.
- Homepage public resources contain tools only; do not remove the `/insights` route or Insights page.
- Use existing SAGEMRO colors, borders, icons, and card interaction styles.
- Use existing tool slugs and do not add duplicate tool definitions.
- Preserve the existing untracked `e2e/` directory and do not include it in commits.

### Task 1: Update the homepage resource contract test

**Files:**
- Modify: `frontend/tests/brand-assets-contract.test.mjs:78-94`
- Test: `frontend/tests/brand-assets-contract.test.mjs`

**Interfaces:**
- Consumes: `frontend/src/components/Chat/WelcomePage.jsx` source text.
- Produces: Assertions that define the four homepage tool links and reject the old homepage Insights link.

- [ ] **Step 1: Replace the old two-resource assertions with the new contract**

Update the existing `WelcomePage` contract assertions to require:

```js
assert.match(welcome, /Useful public resources/);
assert.match(welcome, /href: '\/tools\/bend-simulator'/);
assert.match(welcome, /href: '\/tools\/metal-weight-calculator'/);
assert.match(welcome, /href: '\/tools\/laser-cutting-cost-calculator'/);
assert.match(welcome, /href: '\/tools\/steel-price-watch'/);
assert.doesNotMatch(welcome, /href: '\/insights'/);
assert.doesNotMatch(welcome, /Insights/);
```

Keep the existing headline, intro, and non-sales-copy assertions unchanged.

- [ ] **Step 2: Run the focused test and verify it fails against the old homepage**

Run:

```bash
cd frontend && node --test tests/brand-assets-contract.test.mjs
```

Expected: the WelcomePage contract fails because the old source still contains `/tools`, `/insights`, `Calculators`, and `Insights` rather than the four direct tool slugs.

### Task 2: Replace homepage Insights with four public tools

**Files:**
- Modify: `frontend/src/components/Chat/WelcomePage.jsx:1-35`
- Test: `frontend/tests/brand-assets-contract.test.mjs`

**Interfaces:**
- Consumes: existing industry-tool route slugs and the existing `WelcomePage` `copy` object.
- Produces: localized four-item `resources` arrays and a responsive four-card grid.

- [ ] **Step 1: Update imports and localized resource data**

Remove the unused `BookOpen` import. Keep `Calculator` for the tool cards and `ShieldCheck` for the page eyebrow. Replace both resource arrays with these exact links and localized labels:

```jsx
resources: [
  { icon: Calculator, label: 'Bend Simulator', desc: 'Preview bend sequence, tooling fit, and process risks', href: '/tools/bend-simulator' },
  { icon: Calculator, label: 'Material Weight', desc: 'Estimate sheet, tube, angle, channel, and profile weight', href: '/tools/metal-weight-calculator' },
  { icon: Calculator, label: 'Laser Cutting Cost', desc: 'Estimate cutting time, machine cost, gas, and setup', href: '/tools/laser-cutting-cost-calculator' },
  { icon: Calculator, label: 'Steel Price Budget', desc: 'Plan material budget from weight and reference price', href: '/tools/steel-price-watch' },
],
```

Use the corresponding Chinese labels/descriptions:

```jsx
resources: [
  { icon: Calculator, label: '折弯模拟器', desc: '预览折弯顺序、模具匹配和工艺风险', href: '/tools/bend-simulator' },
  { icon: Calculator, label: '材料重量计算器', desc: '估算板材、管材、角钢、槽钢和型材重量', href: '/tools/metal-weight-calculator' },
  { icon: Calculator, label: '激光切割成本估算', desc: '估算切割时间、设备成本、气体和调机费用', href: '/tools/laser-cutting-cost-calculator' },
  { icon: Calculator, label: '钢材价格预算', desc: '按理论重量和参考价格规划材料预算', href: '/tools/steel-price-watch' },
],
```

Change the English `resourceTitle` to `Useful shop-floor tools`; keep the Chinese `resourceTitle` as `公开工具`.

- [ ] **Step 2: Make the resource grid responsive at 4/2/1 columns**

Change the resource grid class from `grid gap-2 sm:grid-cols-2` to:

```jsx
<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
```

Keep the existing card styling and link behavior unchanged.

- [ ] **Step 3: Run the focused contract test and verify it passes**

Run:

```bash
cd frontend && node --test tests/brand-assets-contract.test.mjs
```

Expected: all tests in `brand-assets-contract.test.mjs` pass, including the new four-tool homepage assertions.

- [ ] **Step 4: Run the complete frontend verification**

Run each command from `frontend/`:

```bash
npm test
npm run lint
npm run build
```

Expected: 0 test failures, ESLint exits 0, and Vite reports a successful production build.

- [ ] **Step 5: Review the diff and commit only the homepage/test changes**

Run:

```bash
git diff --check
git status --short
git add frontend/src/components/Chat/WelcomePage.jsx frontend/tests/brand-assets-contract.test.mjs
git commit -m "feat(frontend): make customer resources tool focused"
```

Do not stage `e2e/` or unrelated files.
